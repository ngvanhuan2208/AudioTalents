function validEmail(value) {
  return /^\S+@\S+\.\S+$/.test(String(value || '').trim());
}

function register(body) {
  const errors = [];
  if (!body.username || body.username.trim().length < 2) errors.push({field: 'username', message: 'Username must be at least 2 characters'});
  if (!validEmail(body.email)) errors.push({field: 'email', message: 'Valid email is required'});
  if (!body.password || body.password.length < 8) errors.push({field: 'password', message: 'Password must be at least 8 characters'});
  return errors;
}

function login(body) { return !body.email || !body.password ? [{field: 'email/password', message: 'Email and password are required'}] : []; }
function refresh(body) { return !body.refreshToken ? [{field: 'refreshToken', message: 'Refresh token is required'}] : []; }
function emailOtp(body) {
  const errors = [];
  if (!validEmail(body.email)) errors.push({field: 'email', message: 'Valid email is required'});
  if (!/^\d{6}$/.test(String(body.otp || ''))) errors.push({field: 'otp', message: 'OTP must be 6 digits'});
  return errors;
}
function emailOnly(body) { return validEmail(body.email) ? [] : [{field: 'email', message: 'Valid email is required'}]; }
function resetPassword(body) {
  const errors = emailOtp(body);
  if (!body.password || body.password.length < 8) errors.push({field: 'password', message: 'Password must be at least 8 characters'});
  return errors;
}

module.exports = {register, login, refresh, emailOtp, emailOnly, resetPassword};
