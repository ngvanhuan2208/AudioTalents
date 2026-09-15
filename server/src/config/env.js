const port = Number(process.env.PORT) || 5000;
const jwtSecret = process.env.JWT_SECRET || 'development-only-change-me';

if (process.env.NODE_ENV === 'production' && jwtSecret === 'development-only-change-me') {
  throw new Error('JWT_SECRET must be configured in production');
}

const env = {
  port,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  mongodbUri: process.env.MONGODB_URI || '',
  mailHost: process.env.MAIL_HOST || '',
  mailPort: Number(process.env.MAIL_PORT || 587),
  mailUser: process.env.MAIL_USER || '',
  mailFrom: process.env.MAIL_FROM || '',
  mailPassword: process.env.MAIL_PASSWORD || ''
};

module.exports = {env};
