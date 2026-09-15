const {mapMongoError, RepositoryError} = require('../errors/mongoErrorMapper');

async function executeCommunityOperation(operation, duplicateCode) {
  try {
    return await operation();
  } catch (error) {
    const normalized = mapMongoError(error);
    if (normalized.code === 'DUPLICATE_KEY' && duplicateCode) {
      throw new RepositoryError('A conflicting community record already exists', {code: duplicateCode, status: 409});
    }
    throw normalized;
  }
}

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new RepositoryError(`${field} is required`, {code: 'PERSISTENCE_VALIDATION_ERROR', status: 422, details: {field}});
  }
  return value.trim();
}

function requireEnum(value, values, field) {
  if (!values.has(value)) {
    throw new RepositoryError(`Invalid ${field}`, {code: 'PERSISTENCE_VALIDATION_ERROR', status: 422, details: {field}});
  }
  return value;
}

module.exports = {executeCommunityOperation, requireNonEmptyString, requireEnum};
