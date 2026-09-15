const {AppError} = require('../utils/AppError');
const HARD_MAX_AUDIO_BYTES = 500 * 1024 * 1024;
const DEFAULT_MAX_AUDIO_BYTES = 250 * 1024 * 1024;
const MAX_DURATION_SEC = 4 * 60 * 60;
// Creator-facing business limits are intentionally narrower than the
// infrastructure ceilings above. They are part of the Audio Story contract,
// not an environment-tunable storage setting.
const CREATOR_MAX_AUDIO_BYTES = 31_457_280;
const CREATOR_MAX_DURATION_SEC = 60 * 60;
const UPLOAD_TTL_SEC = 600;
const SUPPORTED_CONTENT_TYPES = new Set(['audio/mpeg', 'audio/mp4', 'audio/wav']);

function getMediaPolicy(source = process.env) {
  const raw = source.MEDIA_MAX_AUDIO_BYTES;
  const maxBytes = raw === undefined || raw === '' ? DEFAULT_MAX_AUDIO_BYTES : Number(raw);
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > HARD_MAX_AUDIO_BYTES) {
    throw new AppError('Media upload configuration is invalid', 500, 'STORAGE_CONFIGURATION_ERROR');
  }
  return {
    maxBytes,
    hardMaxBytes: HARD_MAX_AUDIO_BYTES,
    maxDurationSec: MAX_DURATION_SEC,
    creatorMaxBytes: CREATOR_MAX_AUDIO_BYTES,
    creatorMaxDurationSec: CREATOR_MAX_DURATION_SEC,
    uploadTtlSec: UPLOAD_TTL_SEC,
  };
}

module.exports = {getMediaPolicy, HARD_MAX_AUDIO_BYTES, DEFAULT_MAX_AUDIO_BYTES, MAX_DURATION_SEC, CREATOR_MAX_AUDIO_BYTES, CREATOR_MAX_DURATION_SEC, UPLOAD_TTL_SEC, SUPPORTED_CONTENT_TYPES};
