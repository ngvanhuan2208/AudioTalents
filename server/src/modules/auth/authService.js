const bcrypt = require('bcryptjs');
const {AppError} = require('../../utils/AppError');
const {signAccessToken, signRefreshToken, verifyToken} = require('../../utils/jwt');
const {ROLES, AUTHOR_STATUS, ACCOUNT_STATUS} = require('../../constants/roles');
const {getIdentityRepositories} = require('../../repositories/identityRuntime');
const otpService = require('../../services/otpService');

function publicUser(user) {
  const {passwordHash, tokenVersion, ...safeUser} = user;
  return safeUser;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function register({username, email, password}) {
  const normalizedEmail = normalizeEmail(email);
  const repositories = getIdentityRepositories();
  const existingUser = await repositories.user.findByEmail(normalizedEmail);
  if (existingUser) {
    if (existingUser.emailVerified) throw new AppError('Email is already registered', 409, 'EMAIL_ALREADY_REGISTERED');
    try {
      const verification = await otpService.issue({userId: existingUser.id, email: existingUser.email, purpose: otpService.PURPOSES.EMAIL_VERIFICATION});
      return {user: publicUser(existingUser), emailVerificationRequired: true, verificationExpiresAt: verification.expiresAt};
    } catch (error) {
      if (error.code !== 'OTP_RESEND_COOLDOWN') throw error;
      const activeToken = await repositories.otpToken.findActiveByUserAndPurpose(existingUser.id, otpService.PURPOSES.EMAIL_VERIFICATION);
      return {user: publicUser(existingUser), emailVerificationRequired: true, verificationExpiresAt: activeToken?.expiresAt};
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await repositories.user.createRegisteredUser({
    username: username.trim(), email: normalizedEmail, passwordHash,
    role: ROLES.USER, authorStatus: AUTHOR_STATUS.NONE, emailVerified: false,
    accountStatus: ACCOUNT_STATUS.ACTIVE, tokenVersion: 0, profile: {bio: '', avatar: null},
  });
  try {
    const verification = await otpService.issue({userId: user.id, email: user.email, purpose: otpService.PURPOSES.EMAIL_VERIFICATION});
    return {user: publicUser(user), emailVerificationRequired: true, verificationExpiresAt: verification.expiresAt};
  } catch (error) {
    await repositories.user.removeUnverifiedUser(user.id);
    throw error;
  }
}

async function login({email, password}) {
  const repositories = getIdentityRepositories();
  const user = await repositories.user.findForAuthenticationByEmail(normalizeEmail(email));
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  if (user.accountStatus === ACCOUNT_STATUS.SUSPENDED) throw new AppError('Account is suspended', 403, 'ACCOUNT_SUSPENDED');
  if (user.accountStatus !== ACCOUNT_STATUS.ACTIVE) throw new AppError('Account is deactivated', 403, 'ACCOUNT_DEACTIVATED');
  if (!user.emailVerified) throw new AppError('Email verification is required', 403, 'EMAIL_NOT_VERIFIED');
  const updated = await repositories.user.setLastLoginAt(user.id);
  return issueTokens(updated || user);
}

function issueTokens(user) {
  return {user: publicUser(user), accessToken: signAccessToken(user), refreshToken: signRefreshToken(user)};
}

async function verifyEmail(email, otp) {
  const repositories = getIdentityRepositories();
  const user = await repositories.user.findByEmail(normalizeEmail(email));
  if (!user) throw new AppError('Invalid verification code', 400, 'INVALID_OTP');
  await otpService.verify({userId: user.id, purpose: otpService.PURPOSES.EMAIL_VERIFICATION, code: otp});
  const updated = await repositories.user.setEmailVerified(user.id, true);
  return {user: publicUser(updated)};
}

async function resendVerification(email) {
  const user = await getIdentityRepositories().user.findByEmail(normalizeEmail(email));
  if (!user) return {sent: true};
  if (user.emailVerified) throw new AppError('Email is already verified', 409, 'EMAIL_ALREADY_VERIFIED');
  const verification = await otpService.issue({userId: user.id, email: user.email, purpose: otpService.PURPOSES.EMAIL_VERIFICATION});
  return {sent: true, expiresAt: verification.expiresAt};
}

async function forgotPassword(email) {
  const user = await getIdentityRepositories().user.findByEmail(normalizeEmail(email));
  if (user && user.accountStatus === ACCOUNT_STATUS.ACTIVE) {
    try {
      await otpService.issue({userId: user.id, email: user.email, purpose: otpService.PURPOSES.PASSWORD_RESET});
    } catch (error) {
      if (error.code !== 'SMTP_NOT_CONFIGURED') throw error;
    }
  }
  return {sent: true};
}

async function resetPassword({email, otp, password}) {
  const repositories = getIdentityRepositories();
  const user = await repositories.user.findByEmail(normalizeEmail(email));
  if (!user) throw new AppError('Invalid verification code', 400, 'INVALID_OTP');
  await otpService.verify({userId: user.id, purpose: otpService.PURPOSES.PASSWORD_RESET, code: otp});
  const passwordHash = await bcrypt.hash(password, 12);
  await repositories.user.setPasswordHashAndIncrementTokenVersion(user.id, passwordHash);
  return {reset: true};
}

async function refresh(refreshToken) {
  try {
    const payload = verifyToken(refreshToken);
    if (payload.type !== 'refresh') throw new Error('Wrong token type');
    const user = await getIdentityRepositories().user.findById(payload.sub);
    if (!user || user.accountStatus !== ACCOUNT_STATUS.ACTIVE || !user.emailVerified) throw new AppError('User is not authorized', 401, 'UNAUTHORIZED');
    if ((payload.tv || 0) !== (user.tokenVersion || 0)) throw new AppError('User is not authorized', 401, 'UNAUTHORIZED');
    return {accessToken: signAccessToken(user)};
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Invalid or expired refresh token', 401, 'UNAUTHORIZED');
  }
}

module.exports = {register, login, verifyEmail, resendVerification, forgotPassword, resetPassword, refresh, publicUser};
