import test from 'node:test';
import assert from 'node:assert/strict';
import {getAuthCompletionCopy, transitionAuthFlow, type AuthFlowState} from '../src/components/auth/authFlowState';
import {AUTH_ENDPOINTS} from '../src/services/authService';

test('register success enters email verification mode without a completion screen', () => {
  const initial: AuthFlowState = {mode: 'register', completion: null};
  assert.deepEqual(transitionAuthFlow(initial, {type: 'REGISTER_SUCCEEDED'}), {mode: 'verify', completion: null});
});

test('email verification has its own success state and switching to login clears it', () => {
  const verified = transitionAuthFlow({mode: 'verify', completion: null}, {type: 'VERIFY_EMAIL_SUCCEEDED'});
  assert.deepEqual(verified, {mode: 'verify', completion: 'VERIFY_EMAIL_SUCCESS'});
  assert.notEqual(verified.completion, 'RESET_PASSWORD_SUCCESS');
  assert.equal(getAuthCompletionCopy(verified.completion)?.title, 'Xác minh email thành công');
  assert.deepEqual(transitionAuthFlow(verified, {type: 'SWITCH_MODE', mode: 'login'}), {mode: 'login', completion: null});
});

test('forgot password enters reset mode without claiming reset completion', () => {
  const initial: AuthFlowState = {mode: 'forgot', completion: null};
  assert.deepEqual(transitionAuthFlow(initial, {type: 'FORGOT_PASSWORD_SUCCEEDED'}), {mode: 'reset', completion: null});
});

test('password reset completion is distinct from email verification completion', () => {
  const reset = transitionAuthFlow({mode: 'reset', completion: null}, {type: 'RESET_PASSWORD_SUCCEEDED'});
  assert.deepEqual(reset, {mode: 'reset', completion: 'RESET_PASSWORD_SUCCESS'});
  assert.notEqual(reset.completion, 'VERIFY_EMAIL_SUCCESS');
  assert.equal(getAuthCompletionCopy(reset.completion)?.title, 'Đặt lại mật khẩu thành công');
});

test('registration verification and password reset use purpose-specific endpoints', () => {
  assert.equal(AUTH_ENDPOINTS.verifyEmail, '/auth/verify-email');
  assert.equal(AUTH_ENDPOINTS.resetPassword, '/auth/reset-password');
  assert.notEqual(AUTH_ENDPOINTS.verifyEmail, AUTH_ENDPOINTS.resetPassword);
  assert.equal(AUTH_ENDPOINTS.resendVerification, '/auth/resend-verification');
  assert.equal(AUTH_ENDPOINTS.forgotPassword, '/auth/forgot-password');
});
