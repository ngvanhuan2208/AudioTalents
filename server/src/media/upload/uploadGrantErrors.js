class UploadGrantError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'UploadGrantError';
    this.code = code;
  }
}

function uploadGrantError(code) {
  const messages = {
    INVALID_UPLOAD_TOKEN: 'Upload grant is invalid',
    UPLOAD_EXPIRED: 'Upload grant has expired',
    UPLOAD_GRANT_CONFIGURATION_ERROR: 'Upload grant configuration is invalid',
  };
  return new UploadGrantError(code, messages[code] || 'Upload grant failed');
}

module.exports = {UploadGrantError, uploadGrantError};
