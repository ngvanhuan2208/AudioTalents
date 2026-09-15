class StorageError extends Error {
  constructor(code, message, {operation} = {}) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.operation = operation;
  }
}

const NOT_FOUND_CODES = new Set(['NoSuchKey', 'NoSuchObject', 'NotFound', 'NotFoundError']);
const PRECONDITION_CODES = new Set(['PreconditionFailed', 'ConditionalRequestConflict']);

function storageError(code, operation) {
  const messages = {
    STORAGE_UNAVAILABLE: 'Media storage is unavailable',
    OBJECT_NOT_FOUND: 'Storage object was not found',
    OBJECT_VALIDATION_FAILED: 'Storage object validation failed',
    STORAGE_CONFIGURATION_ERROR: 'Media storage configuration is invalid',
  };
  return new StorageError(code, messages[code] || 'Media storage operation failed', {operation});
}

function isMissingObjectError(error) {
  return NOT_FOUND_CODES.has(error?.name) || NOT_FOUND_CODES.has(error?.Code) || NOT_FOUND_CODES.has(error?.code)
    || error?.$metadata?.httpStatusCode === 404;
}

function isPreconditionError(error) {
  return PRECONDITION_CODES.has(error?.name) || PRECONDITION_CODES.has(error?.Code) || PRECONDITION_CODES.has(error?.code)
    || error?.$metadata?.httpStatusCode === 412;
}

function mapStorageError(error, operation) {
  if (error instanceof StorageError) return error;
  if (isMissingObjectError(error)) return storageError('OBJECT_NOT_FOUND', operation);
  if (isPreconditionError(error)) return storageError('OBJECT_VALIDATION_FAILED', operation);
  return storageError('STORAGE_UNAVAILABLE', operation);
}

module.exports = {StorageError, storageError, mapStorageError, isMissingObjectError, isPreconditionError};
