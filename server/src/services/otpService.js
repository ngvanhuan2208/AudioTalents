const crypto = require('crypto');
const {AppError} = require('../utils/AppError');
const emailService = require('./emailService');
const {getIdentityRepositories} = require('../repositories/identityRuntime');

const PURPOSES = Object.freeze({EMAIL_VERIFICATION: 'EMAIL_VERIFICATION', PASSWORD_RESET: 'PASSWORD_RESET'});
const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function createCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(OTP_LENGTH, '0');
}

function isExpired(token) {
  return Date.now() >= new Date(token.expiresAt).getTime();
}

async function issue({userId, email, purpose}) {
  const repository = getIdentityRepositories().otpToken;
  const current = await repository.findActiveByUserAndPurpose(userId, purpose);
  if (current && Date.now() - new Date(current.createdAt).getTime() < RESEND_COOLDOWN_MS) {
    throw new AppError('Please wait before requesting another code', 429, 'OTP_RESEND_COOLDOWN', {retryAfterSeconds: Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - new Date(current.createdAt).getTime())) / 1000)});
  }

  await repository.invalidateActive(userId, purpose);
  const code = createCode();
  const now = Date.now();
  const token = await repository.createOtp({
    userId,
    email,
    codeHash: hashCode(code),
    purpose,
    expiresAt: new Date(now + OTP_TTL_MS),
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    usedAt: null,
  });

  try {
    if (purpose === PURPOSES.PASSWORD_RESET) await emailService.sendPasswordResetOtp(email, code);
    else await emailService.sendVerificationOtp(email, code);
  } catch (error) {
    await repository.deleteIssuedOtp(token.id);
    throw error;
  }

  return {expiresAt: token.expiresAt};
}

async function verify({userId, purpose, code}) {
  const repository = getIdentityRepositories().otpToken;
  const token = await repository.findLatestForVerification(userId, purpose);
  if (!token) throw new AppError('Invalid verification code', 400, 'INVALID_OTP');
  if (token.invalidatedAt) throw new AppError('Invalid verification code', 400, 'INVALID_OTP');
  if (token.usedAt) {
    if (hashCode(code) === token.codeHash) throw new AppError('Verification code has already been used', 400, 'OTP_ALREADY_USED');
    throw new AppError('Invalid verification code', 400, 'INVALID_OTP');
  }
  if (isExpired(token)) throw new AppError('Verification code has expired', 400, 'OTP_EXPIRED');
  if (token.attempts >= token.maxAttempts) throw new AppError('Too many verification attempts', 429, 'OTP_MAX_ATTEMPTS');

  if (hashCode(code) !== token.codeHash) {
    const updated = await repository.incrementAttempts(token.id);
    if ((updated?.attempts || 0) >= token.maxAttempts) throw new AppError('Too many verification attempts', 429, 'OTP_MAX_ATTEMPTS');
    throw new AppError('Invalid verification code', 400, 'INVALID_OTP');
  }

  return repository.markUsed(token.id);
}

function getPolicy() {
  return {otpLength: OTP_LENGTH, expiresInMinutes: OTP_TTL_MS / 60000, resendCooldownSeconds: RESEND_COOLDOWN_MS / 1000, maxAttempts: MAX_ATTEMPTS};
}

const exported = {PURPOSES, issue, verify, getPolicy};
Object.defineProperty(exported, 'otpTokenRepository', {
  enumerable: true,
  get: () => getIdentityRepositories().otpToken.rawRepository,
});

module.exports = exported;
