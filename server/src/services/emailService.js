const nodemailer = require('nodemailer');
const {AppError} = require('../utils/AppError');

const OTP_EXPIRY_MINUTES = 5;
let testDelivery = null;

function mailConfig() {
  return {
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT || 587),
    user: process.env.MAIL_USER,
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
    password: process.env.MAIL_PASSWORD,
  };
}

function assertConfigured() {
  const config = mailConfig();
  if (!config.host || !config.user || !config.password || !config.from) {
    throw new AppError('Email service is not configured', 503, 'SMTP_NOT_CONFIGURED');
  }
  return config;
}

function buildMessage(purpose, code) {
  const isReset = purpose === 'PASSWORD_RESET';
  return {
    subject: isReset ? 'Mã đặt lại mật khẩu AudioTalents' : 'Xác thực tài khoản AudioTalents',
    text: [
      'AudioTalents',
      'Audio Platform',
      '',
      isReset ? 'Bạn đã yêu cầu đặt lại mật khẩu.' : 'Cảm ơn bạn đã đăng ký tài khoản.',
      `Mã xác thực của bạn là: ${code}`,
      `Mã có hiệu lực trong ${OTP_EXPIRY_MINUTES} phút.`,
      'Không chia sẻ mã này với bất kỳ ai.',
      'Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email này.',
    ].join('\n'),
  };
}

async function sendOtp({to, purpose, code}) {
  if (testDelivery) {
    await testDelivery({to, purpose, code});
    return;
  }

  const config = assertConfigured();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {user: config.user, pass: config.password},
  });
  const message = buildMessage(purpose, code);
  await transporter.sendMail({from: config.from, to, subject: message.subject, text: message.text});
}

function sendVerificationOtp(to, code) {
  return sendOtp({to, purpose: 'EMAIL_VERIFICATION', code});
}

function sendPasswordResetOtp(to, code) {
  return sendOtp({to, purpose: 'PASSWORD_RESET', code});
}

function setTestDelivery(delivery) {
  testDelivery = delivery;
}

function clearTestDelivery() {
  testDelivery = null;
}

module.exports = {sendOtp, sendVerificationOtp, sendPasswordResetOtp, setTestDelivery, clearTestDelivery, assertConfigured, OTP_EXPIRY_MINUTES};
