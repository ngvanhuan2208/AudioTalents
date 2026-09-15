const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {success: false, message: 'Too many requests', error: {code: 'TOO_MANY_REQUESTS', details: {}}}
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {success: false, error: {code: 'TOO_MANY_REQUESTS', message: 'Too many authentication requests', details: {}}}
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {success: false, error: {code: 'TOO_MANY_REQUESTS', message: 'Too many OTP requests', details: {}}}
});

module.exports = {apiLimiter, authLimiter, otpLimiter};
