const {storageError} = require('./storageErrors');

const STORAGE_MODES = Object.freeze({R2: 'r2', MINIO: 'minio'});

function requiredString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === '') return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw storageError('STORAGE_CONFIGURATION_ERROR', 'createStorageProvider');
}

function parseStorageConfig(source = process.env) {
  const mode = String(source.MEDIA_STORAGE_PROVIDER || '').trim().toLowerCase();
  if (!Object.values(STORAGE_MODES).includes(mode)) {
    throw storageError('STORAGE_CONFIGURATION_ERROR', 'createStorageProvider');
  }

  const endpoint = requiredString(source.MEDIA_STORAGE_ENDPOINT);
  const bucket = requiredString(source.MEDIA_STORAGE_BUCKET);
  const accessKeyId = requiredString(source.MEDIA_STORAGE_ACCESS_KEY_ID);
  const secretAccessKey = requiredString(source.MEDIA_STORAGE_SECRET_ACCESS_KEY);
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw storageError('STORAGE_CONFIGURATION_ERROR', 'createStorageProvider');
  }

  let endpointUrl;
  try { endpointUrl = new URL(endpoint); } catch { throw storageError('STORAGE_CONFIGURATION_ERROR', 'createStorageProvider'); }
  if (!['https:', 'http:'].includes(endpointUrl.protocol)) {
    throw storageError('STORAGE_CONFIGURATION_ERROR', 'createStorageProvider');
  }

  const region = requiredString(source.MEDIA_STORAGE_REGION) || (mode === STORAGE_MODES.R2 ? 'auto' : 'us-east-1');
  const forcePathStyle = parseBoolean(source.MEDIA_STORAGE_FORCE_PATH_STYLE, mode === STORAGE_MODES.MINIO);
  return {mode, endpoint: endpointUrl.toString().replace(/\/$/, ''), bucket, region, forcePathStyle, credentials: {accessKeyId, secretAccessKey}};
}

function toPublicStorageConfig(config) {
  return Object.freeze({mode: config.mode, endpoint: config.endpoint, bucket: config.bucket, region: config.region, forcePathStyle: config.forcePathStyle});
}

module.exports = {STORAGE_MODES, parseStorageConfig, toPublicStorageConfig};
