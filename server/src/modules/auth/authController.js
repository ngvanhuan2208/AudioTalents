const {success} = require('../../utils/response');
const authService = require('./authService');

async function register(req, res) { return success(res, 'Registration successful', await authService.register(req.body), 201); }
async function login(req, res) { return success(res, 'Login successful', await authService.login(req.body)); }
function logout(req, res) { return success(res, 'Logout successful', {}); }
async function refresh(req, res) { return success(res, 'Token refreshed', await authService.refresh(req.body.refreshToken)); }
function me(req, res) { return success(res, 'Current user', {user: authService.publicUser(req.user)}); }
async function verifyEmail(req, res) { return success(res, 'Email verified', await authService.verifyEmail(req.body.email, req.body.otp)); }
async function resendVerification(req, res) { return success(res, 'Verification email requested', await authService.resendVerification(req.body.email)); }
async function forgotPassword(req, res) { return success(res, 'If the email is valid, reset instructions will be sent', await authService.forgotPassword(req.body.email)); }
async function resetPassword(req, res) { return success(res, 'Password reset successful', await authService.resetPassword(req.body)); }

module.exports = {register, login, logout, refresh, me, verifyEmail, resendVerification, forgotPassword, resetPassword};
