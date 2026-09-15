const mongoose = require('mongoose');
const {RepositoryError} = require('../errors/mongoErrorMapper');

function isValidObjectId(value) {
  return mongoose.isObjectIdOrHexString(value);
}

function normalizeObjectId(value, field = 'id') {
  if (!isValidObjectId(value)) {
    throw new RepositoryError(`Invalid ${field}`, {code: 'INVALID_ID', status: 400, details: {field}});
  }
  return String(value);
}

function toObjectId(value, field = 'id') {
  return new mongoose.Types.ObjectId(normalizeObjectId(value, field));
}

function toRuntimeId(value) {
  return value == null ? null : normalizeObjectId(value);
}

module.exports = {isValidObjectId, normalizeObjectId, toObjectId, toRuntimeId};
