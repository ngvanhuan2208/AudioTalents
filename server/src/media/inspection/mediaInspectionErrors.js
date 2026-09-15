class MediaInspectionError extends Error {
  constructor(code, message = 'Media inspection failed') {
    super(message);
    this.name = 'MediaInspectionError';
    this.code = code;
  }
}

function mediaInspectionError(code) {
  const messages = {
    UNSUPPORTED_MEDIA: 'Uploaded media is not supported',
    OBJECT_VALIDATION_FAILED: 'Uploaded media could not be validated',
    MEDIA_TOO_LARGE: 'Uploaded media exceeds the hard size limit',
  };
  return new MediaInspectionError(code, messages[code]);
}

function normalizeInspectionError(error) {
  if (error instanceof MediaInspectionError) return error;
  return mediaInspectionError('OBJECT_VALIDATION_FAILED');
}

module.exports = {MediaInspectionError, mediaInspectionError, normalizeInspectionError};
