class RepositoryError extends Error {
  constructor(message, {code = 'PERSISTENCE_ERROR', status = 500, details = {}} = {}) {
    super(message);
    this.name = 'RepositoryError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function duplicateMetadata(error) {
  return {
    keyPattern: error?.keyPattern || {},
    keyValue: error?.keyValue || {},
  };
}

function mapMongoError(error) {
  if (error instanceof RepositoryError) return error;
  if (error?.code === 11000 || error?.codeName === 'DuplicateKey') {
    return new RepositoryError('A record with this value already exists', {
      code: 'DUPLICATE_KEY', status: 409, details: duplicateMetadata(error),
    });
  }
  if (error?.name === 'ValidationError') {
    return new RepositoryError('Persistence validation failed', {code: 'PERSISTENCE_VALIDATION_ERROR', status: 422});
  }
  if (error?.name === 'CastError') {
    return new RepositoryError('Invalid identifier', {code: 'INVALID_ID', status: 400});
  }
  return new RepositoryError('Persistence operation failed');
}

module.exports = {RepositoryError, mapMongoError, duplicateMetadata};
