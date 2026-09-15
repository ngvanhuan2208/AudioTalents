const {RepositoryError, mapMongoError} = require('../errors/mongoErrorMapper');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function mapIdentityError(error, duplicateCode) {
  const normalized = mapMongoError(error);
  if (normalized.code === 'DUPLICATE_KEY' && duplicateCode) {
    return new RepositoryError('A conflicting identity record already exists', {
      code: duplicateCode,
      status: 409,
      details: {},
    });
  }
  return normalized;
}

async function executeIdentityOperation(operation, duplicateCode) {
  try {
    return await operation();
  } catch (error) {
    throw mapIdentityError(error, duplicateCode);
  }
}

module.exports = {normalizeEmail, mapIdentityError, executeIdentityOperation};
