const {AppError} = require('../utils/AppError');
const {verifyToken} = require('../utils/jwt');
const {getIdentityRepositories} = require('../repositories/identityRuntime');

async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    const payload = verifyToken(token);
    if (payload.type !== 'access') throw new AppError('Invalid access token', 401, 'UNAUTHORIZED');
    const user = await getIdentityRepositories().user.findById(payload.sub);
    const accountStatus = user && user.accountStatus;
    if (!user || accountStatus !== 'ACTIVE') throw new AppError('User is not authorized', 401, 'UNAUTHORIZED');
    if ((payload.tv || 0) !== (user.tokenVersion || 0)) throw new AppError('User is not authorized', 401, 'UNAUTHORIZED');
    if (user.emailVerified === false) throw new AppError('Email verification is required', 403, 'EMAIL_NOT_VERIFIED');
    req.user = user;
    next();
  } catch (error) {
    next(error instanceof AppError ? error : new AppError('Invalid or expired token', 401, 'UNAUTHORIZED'));
  }
}

function requireAuthor(req, res, next) {
  if (!req.user || req.user.authorStatus !== 'APPROVED') return next(new AppError('Approved author permission is required', 403, 'FORBIDDEN'));
  next();
}

function requireAuthorOrAdmin(req, res, next) {
  if (req.user?.role === 'ADMIN' || req.user?.authorStatus === 'APPROVED') return next();
  next(new AppError('Approved author permission is required', 403, 'FORBIDDEN'));
}

function optionalAuth(req, res, next) {
  // Missing credentials mean anonymous access. A supplied (even empty)
  // Authorization header remains an authentication attempt and gets its
  // ordinary controlled 401 response.
  if (!Object.prototype.hasOwnProperty.call(req.headers, 'authorization')) return next();
  return authMiddleware(req, res, next);
}

module.exports = {authMiddleware, optionalAuth, requireAuthor, requireAuthorOrAdmin};
