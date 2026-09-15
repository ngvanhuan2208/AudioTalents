const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const app = require('../../app');
const {startServer} = require('../../server');
const {connectDatabase, disconnectDatabase, getDatabaseStatus} = require('../../src/config/database');
const {User, OtpToken, AuthorApplication} = require('../../src/models');
const {
  getIdentityRepositories,
  resetIdentityRepositoriesToProduction,
  UserMongoRepository,
  OtpTokenMongoRepository,
  AuthorApplicationMongoRepository,
} = require('../../src/repositories');
const authService = require('../../src/modules/auth/authService');
const emailService = require('../../src/services/emailService');
const {AUTHOR_STATUS, ROLES, ACCOUNT_STATUS} = require('../../src/constants/roles');

function testDatabaseName(uri) {
  if (!uri) throw new Error('TEST_DATABASE_SAFETY_ERROR: MONGODB_TEST_URI is required');
  let databaseName;
  try {
    databaseName = decodeURIComponent(new URL(uri).pathname).replace(/^\/+/, '').split('/')[0];
  } catch {
    throw new Error('TEST_DATABASE_SAFETY_ERROR: MONGODB_TEST_URI is invalid');
  }
  const normalized = databaseName.toLowerCase();
  if (!normalized || normalized === 'audiotalents' || !normalized.includes('test')) {
    throw new Error('TEST_DATABASE_SAFETY_ERROR: integration tests require a dedicated *test* database, never audiotalents');
  }
  return databaseName;
}

function assertConnectedToTestDatabase(expectedName) {
  const status = getDatabaseStatus();
  assert.equal(status.state, 'CONNECTED');
  assert.equal(status.database, expectedName);
  assert.notEqual(status.database, 'audiotalents');
}

async function closeServer(server) {
  if (server?.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

async function request(port, path, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
  return {status: response.status, body: await response.json()};
}

function latestCode(deliveries, email, purpose) {
  const delivery = [...deliveries].reverse().find(item => item.to === email && item.purpose === purpose);
  assert.ok(delivery, `Missing ${purpose} test delivery`);
  return delivery.code;
}

function assertNoPlaintextOtp(document) {
  for (const field of ['code', 'otp', 'otpCode', 'verificationCode']) assert.equal(document[field], undefined);
}

test('Identity Mongo persistence survives reconnect and preserves Auth contracts', {timeout: 60_000}, async () => {
  const testUri = process.env.MONGODB_TEST_URI;
  const databaseName = testDatabaseName(testUri);
  const deliveries = [];
  let startupServer;
  let apiServer;

  resetIdentityRepositoriesToProduction();
  emailService.setTestDelivery(async message => { deliveries.push(message); });

  try {
    // A real startup against an empty disposable DB must not create business records.
    await connectDatabase(testUri);
    assertConnectedToTestDatabase(databaseName);
    await User.db.dropDatabase();
    await disconnectDatabase();

    startupServer = await startServer({databaseUri: testUri, port: 0});
    assertConnectedToTestDatabase(databaseName);
    assert.equal(await User.countDocuments(), 0);
    assert.equal(await OtpToken.countDocuments(), 0);
    assert.equal(await AuthorApplication.countDocuments(), 0);
    await closeServer(startupServer);
    startupServer = null;
    await disconnectDatabase();

    await connectDatabase(testUri);
    assertConnectedToTestDatabase(databaseName);
    // Model initialization materializes only canonical indexes in the disposable test DB.
    await Promise.all([User.init(), OtpToken.init(), AuthorApplication.init()]);

    const repositories = getIdentityRepositories();
    assert.ok(repositories.user instanceof UserMongoRepository);
    assert.ok(repositories.otpToken instanceof OtpTokenMongoRepository);
    assert.ok(repositories.authorApplication instanceof AuthorApplicationMongoRepository);

    apiServer = http.createServer(app);
    await new Promise(resolve => apiServer.listen(0, resolve));
    const port = apiServer.address().port;
    const email = 'phase34c-primary@example.test';
    const password = 'password123';

    const registration = await request(port, '/api/auth/register', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: 'Phase 34C User', email, password, role: ROLES.ADMIN}),
    });
    assert.equal(registration.status, 201);
    assert.equal(registration.body.data.accessToken, undefined);
    assert.equal(registration.body.data.user.passwordHash, undefined);

    let persistedUser = await User.findOne({email}).select('+passwordHash').lean().exec();
    assert.ok(persistedUser);
    assert.equal(persistedUser.username, 'Phase 34C User');
    assert.equal(persistedUser.role, ROLES.USER);
    assert.equal(persistedUser.authorStatus, AUTHOR_STATUS.NONE);
    assert.equal(persistedUser.accountStatus, ACCOUNT_STATUS.ACTIVE);
    assert.equal(persistedUser.emailVerified, false);
    assert.equal(persistedUser.tokenVersion, 0);
    assert.ok(persistedUser.passwordHash);
    assert.notEqual(persistedUser.passwordHash, password);
    for (const field of ['password', 'status', 'displayName', 'bio', 'avatarUrl']) assert.equal(persistedUser[field], undefined);

    let verificationToken = await OtpToken.findOne({userId: persistedUser._id, purpose: 'EMAIL_VERIFICATION'}).select('+codeHash').lean().exec();
    assert.ok(verificationToken.codeHash);
    assert.equal(verificationToken.attempts, 0);
    assert.equal(verificationToken.maxAttempts, 5);
    assert.equal(verificationToken.usedAt, null);
    assert.equal(verificationToken.invalidatedAt, null);
    assert.ok(verificationToken.expiresAt);
    assertNoPlaintextOtp(verificationToken);

    const beforeVerifyLogin = await request(port, '/api/auth/login', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email, password}),
    });
    assert.equal(beforeVerifyLogin.status, 403);
    assert.equal(beforeVerifyLogin.body.error.code, 'EMAIL_NOT_VERIFIED');

    const verificationCode = latestCode(deliveries, email, 'EMAIL_VERIFICATION');
    const wrongCode = verificationCode === '000000' ? '111111' : '000000';
    const wrongVerification = await request(port, '/api/auth/verify-email', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email, otp: wrongCode}),
    });
    assert.equal(wrongVerification.status, 400);
    assert.equal(wrongVerification.body.error.code, 'INVALID_OTP');
    verificationToken = await OtpToken.findById(verificationToken._id).select('+codeHash').lean().exec();
    assert.equal(verificationToken.attempts, 1);
    assert.equal(await OtpToken.countDocuments({userId: persistedUser._id, purpose: 'EMAIL_VERIFICATION'}), 1);

    const verified = await request(port, '/api/auth/verify-email', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email, otp: verificationCode}),
    });
    assert.equal(verified.status, 200);
    assert.equal(verified.body.data.accessToken, undefined);
    assert.equal(verified.body.data.user.emailVerified, true);
    persistedUser = await User.findById(persistedUser._id).select('+passwordHash').lean().exec();
    verificationToken = await OtpToken.findById(verificationToken._id).select('+codeHash').lean().exec();
    assert.equal(persistedUser.emailVerified, true);
    assert.ok(verificationToken.usedAt);
    assert.equal((await repositories.user.findByEmail(email)).passwordHash, undefined);

    const login = await request(port, '/api/auth/login', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email, password}),
    });
    assert.equal(login.status, 200);
    assert.ok(login.body.data.accessToken);
    assert.equal(login.body.data.user.passwordHash, undefined);
    const me = await request(port, '/api/auth/me', {headers: {authorization: `Bearer ${login.body.data.accessToken}`}});
    assert.equal(me.status, 200);
    assert.equal(me.body.data.user.email, email);
    assert.equal(me.body.data.user.passwordHash, undefined);

    const forgot = await request(port, '/api/auth/forgot-password', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email}),
    });
    assert.equal(forgot.status, 200);
    const resetCode = latestCode(deliveries, email, 'PASSWORD_RESET');
    const resetToken = await OtpToken.findOne({userId: persistedUser._id, purpose: 'PASSWORD_RESET'}).select('+codeHash').lean().exec();
    assert.ok(resetToken.codeHash);
    assert.equal(verificationToken.invalidatedAt, null);
    assert.equal(resetToken.invalidatedAt, null);
    assertNoPlaintextOtp(resetToken);

    const newPassword = 'newpassword123';
    const reset = await request(port, '/api/auth/reset-password', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email, otp: resetCode, password: newPassword}),
    });
    assert.equal(reset.status, 200);
    persistedUser = await User.findById(persistedUser._id).select('+passwordHash').lean().exec();
    const consumedResetToken = await OtpToken.findById(resetToken._id).select('+codeHash').lean().exec();
    assert.equal(persistedUser.tokenVersion, 1);
    assert.notEqual(persistedUser.passwordHash, password);
    assert.notEqual(persistedUser.passwordHash, newPassword);
    assert.ok(consumedResetToken.usedAt);

    const oldPasswordLogin = await request(port, '/api/auth/login', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email, password}),
    });
    assert.equal(oldPasswordLogin.status, 401);
    const newPasswordLogin = await request(port, '/api/auth/login', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email, password: newPassword}),
    });
    assert.equal(newPasswordLogin.status, 200);

    const authorApplication = await request(port, '/api/author-applications', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', authorization: `Bearer ${newPasswordLogin.body.data.accessToken}`},
      body: JSON.stringify({displayName: 'Phase Writer', bio: 'Integration author bio', copyrightAgreement: true, contentTypes: ['NOVEL']}),
    });
    assert.equal(authorApplication.status, 201);
    const persistedApplication = await AuthorApplication.findOne({userId: persistedUser._id}).lean().exec();
    assert.equal(persistedApplication.status, AUTHOR_STATUS.PENDING);
    assert.equal(persistedApplication.displayName, 'Phase Writer');
    for (const field of ['handledBy', 'adminNote', 'resolvedAt']) assert.equal(persistedApplication[field], undefined);
    persistedUser = await User.findById(persistedUser._id).lean().exec();
    assert.equal(persistedUser.authorStatus, AUTHOR_STATUS.PENDING);

    const duplicateApplication = await request(port, '/api/author-applications', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', authorization: `Bearer ${newPasswordLogin.body.data.accessToken}`},
      body: JSON.stringify({displayName: 'Phase Writer', bio: 'Integration author bio', copyrightAgreement: true}),
    });
    assert.equal(duplicateApplication.status, 409);
    assert.equal(duplicateApplication.body.error.code, 'CONFLICT');

    await disconnectDatabase();
    await connectDatabase(testUri);
    assertConnectedToTestDatabase(databaseName);
    const reconnectedUser = await User.findOne({email}).lean().exec();
    const reconnectedApplication = await AuthorApplication.findOne({userId: reconnectedUser._id}).lean().exec();
    assert.equal(reconnectedUser.tokenVersion, 1);
    assert.equal(reconnectedUser.authorStatus, AUTHOR_STATUS.PENDING);
    assert.equal(reconnectedApplication.status, AUTHOR_STATUS.PENDING);

    const resendEmail = 'phase34c-resend@example.test';
    await authService.register({username: 'Resend User', email: resendEmail, password});
    const oldResendCode = latestCode(deliveries, resendEmail, 'EMAIL_VERIFICATION');
    await assert.rejects(() => authService.resendVerification(resendEmail), error => error.code === 'OTP_RESEND_COOLDOWN');
    const originalNow = Date.now;
    Date.now = () => originalNow() + 61_000;
    try {
      await authService.resendVerification(resendEmail);
    } finally {
      Date.now = originalNow;
    }
    const newResendCode = latestCode(deliveries, resendEmail, 'EMAIL_VERIFICATION');
    assert.notEqual(newResendCode, oldResendCode);
    const resendUser = await User.findOne({email: resendEmail}).lean().exec();
    const resendTokens = await OtpToken.find({userId: resendUser._id, purpose: 'EMAIL_VERIFICATION'}).sort({createdAt: 1}).lean().exec();
    assert.equal(resendTokens.length, 2);
    assert.ok(resendTokens[0].invalidatedAt);
    assert.equal(resendTokens[1].invalidatedAt, null);
    await assert.rejects(() => authService.verifyEmail(resendEmail, oldResendCode), error => error.code === 'INVALID_OTP');
    await authService.verifyEmail(resendEmail, newResendCode);

    const raceEmail = 'phase34c-race@example.test';
    const registrations = await Promise.allSettled([
      authService.register({username: 'Race One', email: raceEmail, password}),
      authService.register({username: 'Race Two', email: raceEmail, password}),
    ]);
    assert.equal(registrations.filter(result => result.status === 'fulfilled').length, 1);
    const duplicate = registrations.find(result => result.status === 'rejected')?.reason;
    assert.equal(duplicate?.code, 'EMAIL_ALREADY_REGISTERED');
    assert.notEqual(duplicate?.code, 11000);
  } finally {
    await closeServer(apiServer);
    await closeServer(startupServer);
    emailService.clearTestDelivery();
    if (getDatabaseStatus().state === 'CONNECTED') {
      assertConnectedToTestDatabase(databaseName);
      await User.db.dropDatabase();
      await disconnectDatabase();
    }
    resetIdentityRepositoriesToProduction();
  }
});
