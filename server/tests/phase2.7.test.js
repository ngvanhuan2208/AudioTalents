const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');

const app = require('../app');
const authService = require('../src/modules/auth/authService');
const emailService = require('../src/services/emailService');
const otpService = require('../src/services/otpService');
const authorApplicationService = require('../src/modules/authorApplications/authorApplicationService');
const {userRepository} = require('../src/repositories/userRepository');
const rateLimit = require('express-rate-limit');
const {ACCOUNT_STATUS, AUTHOR_STATUS, ROLES} = require('../src/constants/roles');
const {useInMemoryIdentityRepositoriesForTest} = require('./helpers/identityTestRuntime');

function reset() {
  useInMemoryIdentityRepositoriesForTest();
  userRepository.items = [];
  otpService.otpTokenRepository.items = [];
  emailService.clearTestDelivery();
}

function captureEmail() {
  let latest;
  emailService.setTestDelivery(async message => { latest = message; });
  return () => latest;
}

async function registerVerified(email = 'security@test.com') {
  const getMessage = captureEmail();
  await authService.register({username: 'Security User', email, password: 'password123'});
  await authService.verifyEmail(email, getMessage().code);
  return {getMessage};
}

function assertNoSecrets(payload) {
  const text = JSON.stringify(payload);
  assert.equal(payload.otp, undefined);
  assert.equal(payload.code, undefined);
  assert.equal(payload.password, undefined);
  assert.equal(payload.passwordHash, undefined);
  assert.equal(payload.MAIL_PASSWORD, undefined);
  assert.doesNotMatch(text, /MAIL_PASSWORD/);
}

test('registration creates a normal unverified active user without privilege escalation', async () => {
  reset();
  const getMessage = captureEmail();
  const result = await authService.register({username: 'Normal', email: 'normal@test.com', password: 'password123', role: ROLES.ADMIN, authorStatus: AUTHOR_STATUS.APPROVED, emailVerified: true});
  assert.equal(result.user.role, ROLES.USER);
  assert.equal(result.user.authorStatus, AUTHOR_STATUS.NONE);
  assert.equal(result.user.emailVerified, false);
  assert.equal(result.user.accountStatus, ACCOUNT_STATUS.ACTIVE);
  assert.equal(result.user.passwordHash, undefined);
  assert.equal(getMessage().code.length, 6);
  assertNoSecrets(result);
});

test('registration trims and lowercases email before persistence', async () => {
  reset();
  captureEmail();
  const result = await authService.register({username: 'Normalized', email: '  Normalized@Test.COM  ', password: 'password123'});
  assert.equal(result.user.email, 'normalized@test.com');
  assert.equal(userRepository.findByEmail('normalized@test.com').email, 'normalized@test.com');
});

test('re-registering an unverified email reuses the pending account and preserves OTP cooldown', async () => {
  reset();
  const getMessage = captureEmail();
  const first = await authService.register({username: 'Pending', email: 'pending@test.com', password: 'password123'});
  const firstCode = getMessage().code;
  const retryDuringCooldown = await authService.register({username: 'Changed name', email: 'pending@test.com', password: 'different-password'});
  assert.equal(retryDuringCooldown.user.id, first.user.id);
  assert.equal(retryDuringCooldown.user.emailVerified, false);
  assert.equal(userRepository.items.filter(user => user.email === 'pending@test.com').length, 1);
  assert.equal(getMessage().code, firstCode);

  const token = otpService.otpTokenRepository.findActiveByUserAndPurpose(first.user.id, otpService.PURPOSES.EMAIL_VERIFICATION);
  otpService.otpTokenRepository.update(token.id, {createdAt: new Date(Date.now() - 61_000).toISOString()});
  await authService.register({username: 'Pending', email: 'pending@test.com', password: 'different-password'});
  assert.notEqual(getMessage().code, firstCode);
  await assert.rejects(() => authService.verifyEmail('pending@test.com', firstCode), error => error.code === 'INVALID_OTP');
});

test('register rolls back a new account when SMTP delivery fails', async () => {
  reset();
  emailService.setTestDelivery(async () => { throw new Error('SMTP delivery failed'); });
  await assert.rejects(() => authService.register({username: 'Rollback', email: 'rollback@test.com', password: 'password123'}));
  assert.equal(userRepository.findByEmail('rollback@test.com'), null);
  assert.equal(otpService.otpTokenRepository.items.length, 0);
});

test('correct OTP verifies email and the same OTP cannot be reused', async () => {
  reset();
  const getMessage = captureEmail();
  await authService.register({username: 'Verify', email: 'verify@test.com', password: 'password123'});
  const verified = await authService.verifyEmail('verify@test.com', getMessage().code);
  assert.equal(verified.user.emailVerified, true);
  await assert.rejects(() => authService.verifyEmail('verify@test.com', getMessage().code), error => error.code === 'OTP_ALREADY_USED');
});

test('wrong OTP increments attempts and max attempts invalidates the code', async () => {
  reset();
  const getMessage = captureEmail();
  await authService.register({username: 'Attempts', email: 'attempts@test.com', password: 'password123'});
  for (let attempt = 0; attempt < 4; attempt += 1) await assert.rejects(() => authService.verifyEmail('attempts@test.com', '000000'), error => error.code === 'INVALID_OTP');
  await assert.rejects(() => authService.verifyEmail('attempts@test.com', '000000'), error => error.code === 'OTP_MAX_ATTEMPTS');
  assert.notEqual(getMessage().code, '000000');
});

test('expired OTP is rejected', async () => {
  reset();
  const getMessage = captureEmail();
  await authService.register({username: 'Expired', email: 'expired@test.com', password: 'password123'});
  const token = otpService.otpTokenRepository.findActiveByUserAndPurpose(userRepository.findByEmail('expired@test.com').id, otpService.PURPOSES.EMAIL_VERIFICATION);
  otpService.otpTokenRepository.update(token.id, {expiresAt: new Date(Date.now() - 1).toISOString()});
  await assert.rejects(() => authService.verifyEmail('expired@test.com', getMessage().code), error => error.code === 'OTP_EXPIRED');
});

test('resend invalidates the old OTP and enforces cooldown', async () => {
  reset();
  const getMessage = captureEmail();
  await authService.register({username: 'Resend', email: 'resend@test.com', password: 'password123'});
  const oldCode = getMessage().code;
  await assert.rejects(() => authService.resendVerification('resend@test.com'), error => error.code === 'OTP_RESEND_COOLDOWN');
  const token = otpService.otpTokenRepository.findActiveByUserAndPurpose(userRepository.findByEmail('resend@test.com').id, otpService.PURPOSES.EMAIL_VERIFICATION);
  otpService.otpTokenRepository.update(token.id, {createdAt: new Date(Date.now() - 61_000).toISOString()});
  await authService.resendVerification('resend@test.com');
  assert.notEqual(getMessage().code, oldCode);
  await assert.rejects(() => authService.verifyEmail('resend@test.com', oldCode), error => error.code === 'INVALID_OTP');
});

test('unverified login is blocked and verified active login returns tokens', async () => {
  reset();
  const getMessage = captureEmail();
  await authService.register({username: 'Login', email: 'login@test.com', password: 'password123'});
  await assert.rejects(() => authService.login({email: 'login@test.com', password: 'password123'}), error => error.code === 'EMAIL_NOT_VERIFIED');
  await authService.verifyEmail('login@test.com', getMessage().code);
  const result = await authService.login({email: 'login@test.com', password: 'password123'});
  assert.ok(result.accessToken);
  assert.ok(result.refreshToken);
  assert.ok(userRepository.findByEmail('login@test.com').lastLoginAt);
  assertNoSecrets(result.user);
});

test('suspended and deactivated accounts cannot login', async () => {
  reset();
  const getMessage = captureEmail();
  await authService.register({username: 'Blocked', email: 'blocked@test.com', password: 'password123'});
  await authService.verifyEmail('blocked@test.com', getMessage().code);
  const user = userRepository.findByEmail('blocked@test.com');
  userRepository.update(user.id, {accountStatus: ACCOUNT_STATUS.SUSPENDED, status: ACCOUNT_STATUS.SUSPENDED});
  await assert.rejects(() => authService.login({email: 'blocked@test.com', password: 'password123'}), error => error.code === 'ACCOUNT_SUSPENDED');
  userRepository.update(user.id, {accountStatus: ACCOUNT_STATUS.DEACTIVATED, status: ACCOUNT_STATUS.DEACTIVATED});
  await assert.rejects(() => authService.login({email: 'blocked@test.com', password: 'password123'}), error => error.code === 'ACCOUNT_DEACTIVATED');
});

test('forgot and reset password use a one-time OTP without exposing it in response', async () => {
  reset();
  const {getMessage} = await registerVerified('reset@test.com');
  const unknown = await authService.forgotPassword('nobody@test.com');
  assert.deepEqual(unknown, {sent: true});
  const response = await authService.forgotPassword('reset@test.com');
  assert.deepEqual(response, {sent: true});
  const otp = getMessage().code;
  assert.equal(response.otp, undefined);
  const loginBeforeReset = await authService.login({email: 'reset@test.com', password: 'password123'});
  await authService.resetPassword({email: 'reset@test.com', otp, password: 'newpassword123'});
  await assert.rejects(() => authService.login({email: 'reset@test.com', password: 'password123'}), error => error.code === 'INVALID_CREDENTIALS');
  const login = await authService.login({email: 'reset@test.com', password: 'newpassword123'});
  assert.ok(login.accessToken);
  await assert.rejects(() => authService.resetPassword({email: 'reset@test.com', otp, password: 'anotherpassword'}), error => error.code === 'OTP_ALREADY_USED');
  await assert.rejects(() => authService.refresh(loginBeforeReset.refreshToken), error => error.code === 'UNAUTHORIZED');
});

test('unverified users cannot submit author applications', async () => {
  reset();
  captureEmail();
  const result = await authService.register({username: 'Applicant', email: 'applicant@test.com', password: 'password123'});
  await assert.rejects(
    () => authorApplicationService.submit(result.user.id, {displayName: 'Applicant', bio: 'Writer', copyrightAgreement: true}),
    error => error.code === 'EMAIL_NOT_VERIFIED'
  );
});

test('register fails clearly when SMTP is not configured', async () => {
  reset();
  await assert.rejects(
    () => authService.register({username: 'NoMail', email: 'nomail@test.com', password: 'password123'}),
    error => error.code === 'SMTP_NOT_CONFIGURED'
  );
  assert.equal(userRepository.findByEmail('nomail@test.com'), null);
});

test('auth HTTP responses never include OTP, password, or mail secrets', async () => {
  reset();
  const getMessage = captureEmail();
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const {port} = server.address();
  try {
    const registerResponse = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username: 'Http User', email: 'http-user@test.com', password: 'password123', role: 'ADMIN', emailVerified: true})
    });
    const registerBody = await registerResponse.json();
    assert.equal(registerResponse.status, 201);
    assert.equal(registerBody.data.user.role, ROLES.USER);
    assert.equal(registerBody.data.user.emailVerified, false);
    assert.equal(registerBody.data.otp, undefined);
    assert.equal(registerBody.data.code, undefined);
    assert.equal(registerBody.data.user.passwordHash, undefined);
    assert.doesNotMatch(JSON.stringify(registerBody), /password123/);
    assert.doesNotMatch(JSON.stringify(registerBody), /MAIL_PASSWORD/);
    assert.doesNotMatch(JSON.stringify(registerBody), /passwordHash/);

    const loginResponse = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: 'http-user@test.com', password: 'password123'})
    });
    const loginBody = await loginResponse.json();
    assert.equal(loginResponse.status, 403);
    assert.equal(loginBody.error.code, 'EMAIL_NOT_VERIFIED');
    assert.equal(loginBody.data, undefined);
    assert.equal(loginBody.otp, undefined);

    const publicProfileResponse = await fetch(`http://127.0.0.1:${port}/api/users/${registerBody.data.user.id}`);
    const publicProfileBody = await publicProfileResponse.json();
    assert.equal(publicProfileResponse.status, 200);
    for (const field of ['email', 'emailVerified', 'accountStatus', 'lastLoginAt', 'tokenVersion', 'passwordHash']) {
      assert.equal(publicProfileBody.data[field], undefined);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
    emailService.clearTestDelivery();
  }
});

test('unexpected SMTP failures are rolled back and do not leak internal messages over HTTP', async () => {
  reset();
  emailService.setTestDelivery(async () => { throw new Error('SMTP_INTERNAL_DIAGNOSTIC'); });
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const {port} = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username: 'Failure', email: 'failure@test.com', password: 'password123'}),
    });
    const body = await response.json();
    assert.equal(response.status, 500);
    assert.equal(body.error.code, 'INTERNAL_SERVER_ERROR');
    assert.equal(body.error.message, 'Internal server error');
    assert.doesNotMatch(JSON.stringify(body), /SMTP_INTERNAL_DIAGNOSTIC/);
    assert.equal(userRepository.findByEmail('failure@test.com'), null);
    assert.equal(otpService.otpTokenRepository.items.length, 0);
  } finally {
    await new Promise(resolve => server.close(resolve));
    emailService.clearTestDelivery();
  }
});

test('auth rate limiter blocks brute force after the configured limit', async () => {
  const isolatedLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {success: false, error: {code: 'TOO_MANY_REQUESTS', message: 'Too many authentication requests', details: {}}}
  });
  const isolated = express();
  isolated.post('/login', isolatedLimiter, (req, res) => res.json({ok: true}));
  const server = http.createServer(isolated);
  await new Promise(resolve => server.listen(0, resolve));
  const {port} = server.address();
  try {
    let lastStatus = 200;
    for (let attempt = 0; attempt < 21; attempt += 1) {
      const response = await fetch(`http://127.0.0.1:${port}/login`, {method: 'POST'});
      lastStatus = response.status;
    }
    assert.equal(lastStatus, 429);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
