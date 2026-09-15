const {RepositoryError, mapMongoError} = require('../errors/mongoErrorMapper');

function normalizeSlug(slug) {
  return String(slug || '').trim().toLowerCase();
}

function toPositiveInteger(value, fallback, maximum = 100) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

function pageOptions({page, limit} = {}) {
  const normalizedPage = toPositiveInteger(page, 1, Number.MAX_SAFE_INTEGER);
  const normalizedLimit = toPositiveInteger(limit, 20, 100);
  return {page: normalizedPage, limit: normalizedLimit, skip: (normalizedPage - 1) * normalizedLimit};
}

function mapContentError(error, duplicateCode) {
  const normalized = mapMongoError(error);
  if (normalized.code === 'DUPLICATE_KEY' && duplicateCode) {
    return new RepositoryError('A conflicting content record already exists', {code: duplicateCode, status: 409});
  }
  return normalized;
}

async function executeContentOperation(operation, duplicateCode) {
  try {
    return await operation();
  } catch (error) {
    throw mapContentError(error, duplicateCode);
  }
}

module.exports = {normalizeSlug, pageOptions, mapContentError, executeContentOperation};
