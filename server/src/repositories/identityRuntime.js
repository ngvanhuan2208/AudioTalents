const {UserMongoRepository} = require('./mongo/UserMongoRepository');
const {OtpTokenMongoRepository} = require('./mongo/OtpTokenMongoRepository');
const {AuthorApplicationMongoRepository} = require('./mongo/AuthorApplicationMongoRepository');
const {ROLES, AUTHOR_STATUS, ACCOUNT_STATUS} = require('../constants/roles');

function withoutPasswordHash(user) {
  if (!user) return null;
  const {passwordHash, ...safeUser} = user;
  return {...safeUser, profile: user.profile ? {...user.profile} : user.profile};
}

function createProductionIdentityRepositories() {
  return {
    user: new UserMongoRepository(),
    otpToken: new OtpTokenMongoRepository(),
    authorApplication: new AuthorApplicationMongoRepository(),
  };
}

// This adapter exists solely for explicit unit-test injection. Production never
// selects it and there is deliberately no environment-based fallback.
function createInMemoryIdentityRepositories({userRepository, otpTokenRepository, authorApplicationRepository}) {
  if (!userRepository || !otpTokenRepository || !authorApplicationRepository) {
    throw new Error('Explicit in-memory identity repositories are required for test injection');
  }

  return {
    user: {
      rawRepository: userRepository,
      async findById(id) { return withoutPasswordHash(userRepository.findById(id)); },
      async findByEmail(email) { return withoutPasswordHash(userRepository.findByEmail(String(email).trim().toLowerCase())); },
      async findForAuthenticationByEmail(email) { return userRepository.findByEmail(String(email).trim().toLowerCase()); },
      async createRegisteredUser(input) {
        return withoutPasswordHash(userRepository.create({
          username: input.username,
          email: String(input.email).trim().toLowerCase(),
          passwordHash: input.passwordHash,
          role: ROLES.USER,
          authorStatus: AUTHOR_STATUS.NONE,
          accountStatus: ACCOUNT_STATUS.ACTIVE,
          emailVerified: false,
          tokenVersion: 0,
          profile: input.profile || {bio: '', avatar: null},
          lastLoginAt: null,
        }));
      },
      async removeUnverifiedUser(id) {
        const user = userRepository.findById(id);
        return Boolean(user && !user.emailVerified && userRepository.delete(id));
      },
      async setEmailVerified(id, emailVerified = true) { return withoutPasswordHash(userRepository.update(id, {emailVerified: Boolean(emailVerified)})); },
      async setAuthorStatus(id, authorStatus) { return withoutPasswordHash(userRepository.update(id, {authorStatus})); },
      async setPasswordHashAndIncrementTokenVersion(id, passwordHash) {
        const user = userRepository.findById(id);
        return withoutPasswordHash(user && userRepository.update(id, {passwordHash, tokenVersion: (user.tokenVersion || 0) + 1}));
      },
      async updateProfile(id, input) {
        const user = userRepository.findById(id);
        if (!user) return null;
        const changes = {};
        if (input.username !== undefined) changes.username = input.username;
        if (input.profile !== undefined) changes.profile = input.profile;
        return withoutPasswordHash(userRepository.update(id, changes));
      },
      async setLastLoginAt(id, lastLoginAt = new Date()) { return withoutPasswordHash(userRepository.update(id, {lastLoginAt})); },
    },
    otpToken: {
      rawRepository: otpTokenRepository,
      async findActiveByUserAndPurpose(userId, purpose) {
        return otpTokenRepository.findMany(item => item.userId === userId && item.purpose === purpose && !item.usedAt && !item.invalidatedAt)
          .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))[0] || null;
      },
      async invalidateActive(userId, purpose, invalidatedAt = new Date().toISOString()) {
        otpTokenRepository.items = otpTokenRepository.items.map(item => (
          item.userId === userId && item.purpose === purpose && !item.usedAt && !item.invalidatedAt
            ? {...item, invalidatedAt, updatedAt: new Date().toISOString()}
            : item
        ));
      },
      async createOtp(input) {
        const token = otpTokenRepository.create({...input, invalidatedAt: null});
        const {codeHash, ...safeToken} = token;
        return safeToken;
      },
      async deleteIssuedOtp(id) { return otpTokenRepository.delete(id); },
      async findLatestForVerification(userId, purpose) {
        return otpTokenRepository.findLatestByUserAndPurpose(userId, purpose);
      },
      async incrementAttempts(id) {
        const token = otpTokenRepository.findById(id);
        return token && otpTokenRepository.update(id, {attempts: (token.attempts || 0) + 1});
      },
      async markUsed(id, usedAt = new Date().toISOString()) { return otpTokenRepository.update(id, {usedAt}); },
    },
    authorApplication: {
      rawRepository: authorApplicationRepository,
      async findById(id) { return authorApplicationRepository.findById(id); },
      async findByUserId(userId) { return authorApplicationRepository.findByUserId(userId); },
      async findPendingByUserId(userId) {
        return authorApplicationRepository.findOne(application => application.userId === userId && application.status === 'PENDING');
      },
      async listPending() { return authorApplicationRepository.findPending(); },
      async createPendingApplication(input) {
        return authorApplicationRepository.create({...input, status: 'PENDING', reviewedAt: null, reviewedBy: null, reviewNote: null});
      },
      async cancelPendingApplication(id, reviewNote) {
        return authorApplicationRepository.update(id, {status: 'CANCELLED', reviewedAt: new Date().toISOString(), reviewNote});
      },
      async reviewApplication(id, input) { return authorApplicationRepository.update(id, input); },
    },
  };
}

let activeRepositories = createProductionIdentityRepositories();

function getIdentityRepositories() {
  return activeRepositories;
}

function configureIdentityRepositoriesForTests(repositories) {
  if (!repositories?.user || !repositories?.otpToken || !repositories?.authorApplication) {
    throw new Error('All three identity repositories must be supplied explicitly');
  }
  activeRepositories = repositories;
}

function resetIdentityRepositoriesToProduction() {
  activeRepositories = createProductionIdentityRepositories();
}

module.exports = {
  createProductionIdentityRepositories,
  createInMemoryIdentityRepositories,
  getIdentityRepositories,
  configureIdentityRepositoriesForTests,
  resetIdentityRepositoriesToProduction,
};
