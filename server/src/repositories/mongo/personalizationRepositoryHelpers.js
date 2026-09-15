const {mapMongoError, RepositoryError} = require('../errors/mongoErrorMapper');

async function executePersonalizationOperation(operation, duplicateCode) {
  try {
    return await operation();
  } catch (error) {
    const normalized = mapMongoError(error);
    if (normalized.code === 'DUPLICATE_KEY' && duplicateCode) {
      throw new RepositoryError('A conflicting personalization record already exists', {code: duplicateCode, status: 409});
    }
    throw normalized;
  }
}

module.exports = {executePersonalizationOperation};
