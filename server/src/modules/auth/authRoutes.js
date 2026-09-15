const express = require('express');
const {asyncHandler} = require('../../middleware/asyncHandler');
const {authMiddleware} = require('../../middleware/auth');
const {validate} = require('../../middleware/validate');
const controller = require('./authController');
const validation = require('./authValidation');
const {authLimiter, otpLimiter} = require('../../middleware/rateLimit');

const router = express.Router();
router.post('/register', authLimiter, validate(body => validation.register(body)), asyncHandler(controller.register));
router.post('/login', authLimiter, validate(body => validation.login(body)), asyncHandler(controller.login));
router.post('/logout', authMiddleware, controller.logout);
router.post('/refresh', validate(body => validation.refresh(body)), asyncHandler(controller.refresh));
router.post('/verify-email', otpLimiter, validate(body => validation.emailOtp(body)), asyncHandler(controller.verifyEmail));
router.post('/resend-verification', otpLimiter, validate(body => validation.emailOnly(body)), asyncHandler(controller.resendVerification));
router.post('/forgot-password', authLimiter, validate(body => validation.emailOnly(body)), asyncHandler(controller.forgotPassword));
router.post('/reset-password', otpLimiter, validate(body => validation.resetPassword(body)), asyncHandler(controller.resetPassword));
router.get('/me', authMiddleware, controller.me);

module.exports = router;
