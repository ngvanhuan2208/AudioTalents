const {RepositoryError} = require('../errors/mongoErrorMapper');

function serializeTranscript(input) {
  if (input == null) return '';
  if (!Array.isArray(input)) {
    throw new RepositoryError('Transcript must be a structured segment array', {
      code: 'INVALID_TRANSCRIPT', status: 422,
    });
  }
  return JSON.stringify(input);
}

function safeParseTranscript(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

module.exports = {serializeTranscript, safeParseTranscript};
