const path = require('node:path');
const dotenv = require('dotenv');
const {parseStorageConfig} = require('../../src/media/storage/storageConfig');

const EXPECTED_DATABASE = 'audiotalents_phase41d1_test';
const EXPECTED_BUCKET = 'audiotalents-phase41d1-test';
const EXPECTED_ORIGINS = new Set(['http://127.0.0.1:9000', 'http://localhost:9000']);
const REQUIRED_VARIABLES = Object.freeze([
  'MONGODB_TEST_URI',
  'MEDIA_STORAGE_PROVIDER',
  'MEDIA_STORAGE_ENDPOINT',
  'MEDIA_STORAGE_BUCKET',
  'MEDIA_STORAGE_REGION',
  'MEDIA_STORAGE_FORCE_PATH_STYLE',
  'MEDIA_STORAGE_ACCESS_KEY_ID',
  'MEDIA_STORAGE_SECRET_ACCESS_KEY',
  'MEDIA_UPLOAD_TOKEN_SECRET',
]);

function environmentError(message) {
  return new Error(`PHASE41D1_ENVIRONMENT_SAFETY_ERROR: ${message}`);
}

function databaseName(uri) {
  if (!uri) throw environmentError('MONGODB_TEST_URI is required');
  try {
    const name = decodeURIComponent(new URL(uri).pathname).split('/').filter(Boolean)[0];
    if (name !== EXPECTED_DATABASE) throw environmentError('MONGODB_TEST_URI must target the approved isolated database');
    return name;
  } catch (error) {
    if (error.message.startsWith('PHASE41D1_ENVIRONMENT_SAFETY_ERROR:')) throw error;
    throw environmentError('MONGODB_TEST_URI is invalid');
  }
}

function loadPhase41d1Environment() {
  const file = path.resolve(__dirname, '../../.env.phase41d1.local');
  const result = dotenv.config({path: file, override: true, quiet: true});
  if (result.error) throw environmentError('dedicated local environment file is required');
  for (const name of REQUIRED_VARIABLES) {
    if (!process.env[name]) throw environmentError(`${name} is required`);
  }
  const name = databaseName(process.env.MONGODB_TEST_URI);
  if (process.env.MEDIA_STORAGE_PROVIDER !== 'minio') throw environmentError('storage provider must be minio');
  if (process.env.MEDIA_STORAGE_BUCKET !== EXPECTED_BUCKET) throw environmentError('storage bucket must be the approved D1 test bucket');
  let origin;
  try { origin = new URL(process.env.MEDIA_STORAGE_ENDPOINT).origin; } catch { throw environmentError('storage endpoint is invalid'); }
  if (!EXPECTED_ORIGINS.has(origin)) throw environmentError('storage endpoint must be local MinIO on port 9000');
  const storage = parseStorageConfig(process.env);
  if (storage.mode !== 'minio' || storage.bucket !== EXPECTED_BUCKET || !EXPECTED_ORIGINS.has(storage.endpoint)) {
    throw environmentError('storage configuration failed D1 safety validation');
  }
  return {file, databaseName: name, storage};
}

async function assertMinioHealthy(storage) {
  let response;
  try {
    response = await fetch(`${storage.endpoint}/minio/health/live`, {signal: AbortSignal.timeout(5_000)});
  } catch {
    throw environmentError('local MinIO health endpoint is unreachable');
  }
  if (!response.ok) throw environmentError('local MinIO health check failed');
}

function assertApprovedDatabase(name) {
  if (name !== EXPECTED_DATABASE) throw environmentError('refusing database write or drop outside approved D1 database');
}

module.exports = {
  EXPECTED_DATABASE,
  EXPECTED_BUCKET,
  loadPhase41d1Environment,
  assertMinioHealthy,
  assertApprovedDatabase,
};
