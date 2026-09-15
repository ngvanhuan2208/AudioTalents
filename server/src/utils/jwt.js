const jwt = require('jsonwebtoken');
const {env} = require('../config/env');

function tokenVersion(user) {
  return user.tokenVersion || 0;
}

function signAccessToken(user) {
  return jwt.sign({sub: user.id, role: user.role, type: 'access', tv: tokenVersion(user)}, env.jwtSecret, {expiresIn: env.jwtExpiresIn});
}

function signRefreshToken(user) {
  return jwt.sign({sub: user.id, type: 'refresh', tv: tokenVersion(user)}, env.jwtSecret, {expiresIn: env.jwtRefreshExpiresIn});
}

function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

module.exports = {signAccessToken, signRefreshToken, verifyToken};
