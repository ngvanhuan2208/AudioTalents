const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const {isValidObjectId} = require('../../repositories/adapters/objectId');
const {assertStorageKey} = require('../storage/storageKey');
const {MAX_MEDIA_BYTES} = require('../inspection/DefaultMediaInspector');
const {uploadGrantError} = require('./uploadGrantErrors');

const UPLOAD_AUDIENCE = 'media-upload';
const UPLOAD_PURPOSE = 'AUDIO_UPLOAD';
const UPLOAD_ALGORITHM = 'HS256';
const UPLOAD_TTL_SEC = 10 * 60;
const EXPECTED_PROCESSING_STATUSES = new Set(['PENDING', 'READY']);

function hasOwn(object, key) { return Object.prototype.hasOwnProperty.call(object, key); }

function assertObjectId(value) {
  if (typeof value !== 'string' || !isValidObjectId(value)) throw uploadGrantError('INVALID_UPLOAD_TOKEN');
  return String(value);
}

function assertPrefixedKey(value, prefix) {
  try {
    const key = assertStorageKey(value);
    if (!key.startsWith(prefix)) throw new Error('invalid prefix');
    return key;
  } catch { throw uploadGrantError('INVALID_UPLOAD_TOKEN'); }
}

function assertExpectedStorageKey(value) {
  if (value === null) return null;
  return assertPrefixedKey(value, 'audio/');
}

function assertIsoTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) throw uploadGrantError('INVALID_UPLOAD_TOKEN');
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) throw uploadGrantError('INVALID_UPLOAD_TOKEN');
  return value;
}

function assertContentTypeHint(value) {
  if (typeof value !== 'string' || !/^[^\s/;]+\/[^\s;]+(?:\s*;[^\r\n]+)?$/.test(value)) throw uploadGrantError('INVALID_UPLOAD_TOKEN');
  return value;
}

function assertMaxBytes(value) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_MEDIA_BYTES) throw uploadGrantError('INVALID_UPLOAD_TOKEN');
  return value;
}

function normalizeClaims(input) {
  if (!input || typeof input !== 'object' || !hasOwn(input, 'expectedStorageKey')) throw uploadGrantError('INVALID_UPLOAD_TOKEN');
  if (!EXPECTED_PROCESSING_STATUSES.has(input.expectedProcessingStatus)) throw uploadGrantError('INVALID_UPLOAD_TOKEN');
  return {
    aud: UPLOAD_AUDIENCE,
    purpose: UPLOAD_PURPOSE,
    audioId: assertObjectId(input.audioId),
    actorId: assertObjectId(input.actorId),
    pendingKey: assertPrefixedKey(input.pendingKey, 'uploads/pending/'),
    finalKey: assertPrefixedKey(input.finalKey, 'audio/'),
    expectedStorageKey: assertExpectedStorageKey(input.expectedStorageKey),
    expectedProcessingStatus: input.expectedProcessingStatus,
    expectedUpdatedAt: assertIsoTimestamp(input.expectedUpdatedAt),
    contentTypeHint: assertContentTypeHint(input.contentTypeHint),
    maxBytes: assertMaxBytes(input.maxBytes),
  };
}

function assertSecret(secret) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32) throw uploadGrantError('UPLOAD_GRANT_CONFIGURATION_ERROR');
  return secret;
}

class UploadGrantService {
  constructor({secret = process.env.MEDIA_UPLOAD_TOKEN_SECRET, jwtImplementation = jwt, uuid = crypto.randomUUID} = {}) {
    this.secret = assertSecret(secret);
    this.jwt = jwtImplementation;
    this.uuid = uuid;
  }

  issue(input) {
    const claims = normalizeClaims(input);
    const jti = this.uuid();
    if (typeof jti !== 'string' || !jti) throw uploadGrantError('UPLOAD_GRANT_CONFIGURATION_ERROR');
    try {
      const token = this.jwt.sign({...claims, jti}, this.secret, {algorithm: UPLOAD_ALGORITHM, expiresIn: UPLOAD_TTL_SEC});
      const decoded = this.jwt.decode(token);
      if (!Number.isInteger(decoded?.exp)) throw uploadGrantError('UPLOAD_GRANT_CONFIGURATION_ERROR');
      return {token, expiresAt: new Date(decoded.exp * 1000)};
    } catch (error) {
      if (error?.code === 'UPLOAD_GRANT_CONFIGURATION_ERROR') throw error;
      throw uploadGrantError('UPLOAD_GRANT_CONFIGURATION_ERROR');
    }
  }

  verify(token) {
    let payload;
    try {
      payload = this.jwt.verify(token, this.secret, {algorithms: [UPLOAD_ALGORITHM], audience: UPLOAD_AUDIENCE});
    } catch (error) {
      if (error?.name === 'TokenExpiredError') throw uploadGrantError('UPLOAD_EXPIRED');
      throw uploadGrantError('INVALID_UPLOAD_TOKEN');
    }
    try {
      if (!payload || payload.aud !== UPLOAD_AUDIENCE || payload.purpose !== UPLOAD_PURPOSE || !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)) {
        throw uploadGrantError('INVALID_UPLOAD_TOKEN');
      }
      if (payload.exp <= payload.iat || payload.exp - payload.iat > UPLOAD_TTL_SEC || typeof payload.jti !== 'string' || !payload.jti) {
        throw uploadGrantError('INVALID_UPLOAD_TOKEN');
      }
      return {...normalizeClaims(payload), iat: payload.iat, exp: payload.exp, jti: payload.jti};
    } catch (error) {
      if (error?.code === 'INVALID_UPLOAD_TOKEN') throw error;
      throw uploadGrantError('INVALID_UPLOAD_TOKEN');
    }
  }
}

module.exports = {UploadGrantService, UPLOAD_AUDIENCE, UPLOAD_PURPOSE, UPLOAD_ALGORITHM, UPLOAD_TTL_SEC, EXPECTED_PROCESSING_STATUSES, normalizeClaims};
