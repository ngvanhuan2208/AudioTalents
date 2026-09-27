const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const authService = require('../src/modules/auth/authService');
const authorApplicationService = require('../src/modules/authorApplications/authorApplicationService');
const {
  UserMongoRepository,
  OtpTokenMongoRepository,
  AuthorApplicationMongoRepository,
  getIdentityRepositories,
  configureIdentityRepositoriesForTests,
  resetIdentityRepositoriesToProduction,
} = require('../src/repositories');
const {AUTHOR_STATUS, ROLES, ACCOUNT_STATUS} = require('../src/constants/roles');

function emptyProvider(overrides = {}) {
  return {
    user: {
      async findById() { return null; },
      async findByEmail() { return null; },
      async findForAuthenticationByEmail() { return null; },
      async createRegisteredUser() { return null; },
      async removeUnverifiedUser() { return false; },
      async setEmailVerified() { return null; },
      async setAuthorStatus() { return null; },
      async setPasswordHashAndIncrementTokenVersion() { return null; },
      async updateProfile() { return null; },
      ...overrides.user,
    },
    otpToken: {
      async findActiveByUserAndPurpose() { return null; },
      async invalidateActive() {},
      async createOtp() { return null; },
      async deleteIssuedOtp() { return false; },
      async findLatestForVerification() { return null; },
      async incrementAttempts() { return null; },
      async markUsed() { return null; },
      ...overrides.otpToken,
    },
    authorApplication: {
      async findById() { return null; },
      async findByUserId() { return null; },
      async findPendingByUserId() { return null; },
      async listPending() { return []; },
      async createPendingApplication() { return null; },
      async cancelPendingApplication() { return null; },
      async reviewApplication() { return null; },
      ...overrides.authorApplication,
    },
  };
}

test.afterEach(() => resetIdentityRepositoriesToProduction());

test('production identity wiring resolves Mongo repositories without a database operation', () => {
  resetIdentityRepositoriesToProduction();
  const repositories = getIdentityRepositories();
  assert.ok(repositories.user instanceof UserMongoRepository);
  assert.ok(repositories.otpToken instanceof OtpTokenMongoRepository);
  assert.ok(repositories.authorApplication instanceof AuthorApplicationMongoRepository);
  assert.equal(repositories.user.rawRepository, undefined);
});

test('login uses only the authentication-specific identity lookup and keeps passwordHash internal', async () => {
  const lookups = [];
  const loginAudits = [];
  const passwordHash = await bcrypt.hash('password123', 4);
  const authenticated = {id: 'user-1', username: 'User', email: 'user@example.com', passwordHash, role: ROLES.USER, authorStatus: AUTHOR_STATUS.NONE, accountStatus: ACCOUNT_STATUS.ACTIVE, emailVerified: true, tokenVersion: 0, profile: {bio: '', avatar: null}};
  configureIdentityRepositoriesForTests(emptyProvider({
    user: {
      async findByEmail() { throw new Error('generic lookup must not authenticate'); },
      async findForAuthenticationByEmail(email) {
        lookups.push(email);
        return {...authenticated, email};
      },
      async setLastLoginAt(id, lastLoginAt = new Date()) { loginAudits.push({id, lastLoginAt}); return {...authenticated, lastLoginAt}; },
    },
  }));

  const result = await authService.login({email: ' USER@EXAMPLE.COM ', password: 'password123'});
  assert.deepEqual(lookups, ['user@example.com']);
  assert.equal(loginAudits.length, 1);
  assert.equal(loginAudits[0].id, 'user-1');
  assert.ok(loginAudits[0].lastLoginAt instanceof Date);
  assert.equal(result.user.passwordHash, undefined);
  assert.ok(result.user.lastLoginAt);
  assert.ok(result.accessToken);
});

test('reset password verifies hash-only OTP then performs the targeted password/tokenVersion write', async () => {
  const writes = [];
  const code = '123456';
  configureIdentityRepositoriesForTests(emptyProvider({
    user: {
      async findByEmail() { return {id: 'user-2', email: 'reset@example.com', accountStatus: ACCOUNT_STATUS.ACTIVE, tokenVersion: 4}; },
      async setPasswordHashAndIncrementTokenVersion(id, passwordHash) { writes.push({id, passwordHash}); return {id}; },
    },
    otpToken: {
      async findLatestForVerification() {
        return {id: 'otp-1', codeHash: crypto.createHash('sha256').update(code).digest('hex'), attempts: 0, maxAttempts: 5, usedAt: null, invalidatedAt: null, expiresAt: new Date(Date.now() + 60_000)};
      },
      async markUsed(id) { writes.push({used: id}); return {id}; },
    },
  }));

  const result = await authService.resetPassword({email: 'reset@example.com', otp: code, password: 'newpassword123'});
  assert.deepEqual(result, {reset: true});
  assert.equal(writes[0].used, 'otp-1');
  assert.equal(writes[1].id, 'user-2');
  assert.notEqual(writes[1].passwordHash, 'newpassword123');
});

test('author submission coordinates pending application and user authorStatus through injected repositories', async () => {
  const calls = [];
  configureIdentityRepositoriesForTests(emptyProvider({
    user: {
      async findById() { return {id: 'user-3', emailVerified: true, authorStatus: AUTHOR_STATUS.NONE, profile: {}}; },
      async setAuthorStatus(id, status) { calls.push({id, status}); return {id, authorStatus: status}; },
    },
    authorApplication: {
      async findPendingByUserId() { return null; },
      async createPendingApplication(input) { calls.push({application: input}); return {id: 'application-1', ...input, status: 'PENDING'}; },
    },
  }));

  const application = await authorApplicationService.submit('user-3', {displayName: 'Writer', bio: 'Bio', copyrightAgreement: true});
  assert.equal(application.id, 'application-1');
  assert.equal(calls[0].application.status, undefined);
  assert.deepEqual(calls[1], {id: 'user-3', status: AUTHOR_STATUS.PENDING});
});

test('author submission compensates a newly-created application when User authorStatus persistence fails', async () => {
  const calls = [];
  configureIdentityRepositoriesForTests(emptyProvider({
    user: {
      async findById() { return {id: 'user-4', emailVerified: true, authorStatus: AUTHOR_STATUS.NONE, profile: {}}; },
      async setAuthorStatus() { throw new Error('simulated user persistence failure'); },
    },
    authorApplication: {
      async findPendingByUserId() { return null; },
      async createPendingApplication() { return {id: 'application-2'}; },
      async cancelPendingApplication(id, note) { calls.push({id, note}); return {id, status: 'CANCELLED'}; },
    },
  }));

  await assert.rejects(
    () => authorApplicationService.submit('user-4', {displayName: 'Writer', bio: 'Bio', copyrightAgreement: true}),
    /simulated user persistence failure/
  );
  assert.equal(calls[0].id, 'application-2');
  assert.match(calls[0].note, /compensation/i);
});
