const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const {isValidObjectId} = require('../../repositories/adapters/objectId');
const {playbackGrantError} = require('./playbackGrantErrors');

const PLAYBACK_AUDIENCE = 'media-playback';
const PLAYBACK_PURPOSE = 'AUDIO_PLAYBACK';
const PLAYBACK_ALGORITHM = 'HS256';
const PLAYBACK_TTL_SEC = 90;

function assertId(value) { if (typeof value !== 'string' || !isValidObjectId(value)) throw playbackGrantError('INVALID_PLAYBACK_TOKEN'); return String(value); }
function assertSecret(secret) { if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32) throw playbackGrantError('PLAYBACK_GRANT_CONFIGURATION_ERROR'); return secret; }
function normalizeClaims(input) { return {aud: PLAYBACK_AUDIENCE, purpose: PLAYBACK_PURPOSE, audioId: assertId(input?.audioId), actorId: assertId(input?.actorId)}; }

class PlaybackGrantService {
  constructor({secret = process.env.MEDIA_PLAYBACK_TOKEN_SECRET, jwtImplementation = jwt, uuid = crypto.randomUUID} = {}) { this.secret = assertSecret(secret); this.jwt = jwtImplementation; this.uuid = uuid; }
  issue(input) {
    const claims = normalizeClaims(input); const jti = this.uuid();
    if (typeof jti !== 'string' || !jti) throw playbackGrantError('PLAYBACK_GRANT_CONFIGURATION_ERROR');
    try {
      const token = this.jwt.sign({...claims, jti}, this.secret, {algorithm: PLAYBACK_ALGORITHM, expiresIn: PLAYBACK_TTL_SEC});
      const decoded = this.jwt.decode(token);
      if (!Number.isInteger(decoded?.exp)) throw playbackGrantError('PLAYBACK_GRANT_CONFIGURATION_ERROR');
      return {token, expiresAt: new Date(decoded.exp * 1000)};
    } catch (error) { if (error?.code === 'PLAYBACK_GRANT_CONFIGURATION_ERROR') throw error; throw playbackGrantError('PLAYBACK_GRANT_CONFIGURATION_ERROR'); }
  }
  verify(token) {
    let payload;
    try { payload = this.jwt.verify(token, this.secret, {algorithms: [PLAYBACK_ALGORITHM], audience: PLAYBACK_AUDIENCE}); }
    catch (error) { if (error?.name === 'TokenExpiredError') throw playbackGrantError('PLAYBACK_EXPIRED'); throw playbackGrantError('INVALID_PLAYBACK_TOKEN'); }
    try {
      if (!payload || payload.aud !== PLAYBACK_AUDIENCE || payload.purpose !== PLAYBACK_PURPOSE || !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp) || payload.exp <= payload.iat || payload.exp - payload.iat > PLAYBACK_TTL_SEC || typeof payload.jti !== 'string' || !payload.jti) throw playbackGrantError('INVALID_PLAYBACK_TOKEN');
      return {...normalizeClaims(payload), iat: payload.iat, exp: payload.exp, jti: payload.jti};
    } catch (error) { if (error?.code === 'INVALID_PLAYBACK_TOKEN') throw error; throw playbackGrantError('INVALID_PLAYBACK_TOKEN'); }
  }
}

module.exports = {PlaybackGrantService, PLAYBACK_AUDIENCE, PLAYBACK_PURPOSE, PLAYBACK_ALGORITHM, PLAYBACK_TTL_SEC, normalizeClaims};
