const AuditLog = require('../../models/AuditLog');
const {toObjectId} = require('../adapters/objectId');
const {toRuntimeObject} = require('../adapters/persistenceMappers');
const {RepositoryError, mapMongoError} = require('../errors/mongoErrorMapper');

const FORBIDDEN_METADATA_KEY = /(password|otp|token|authorization|cookie|secret|credential|api.?key|codehash|session|headers|request|response|stack|error)/i;

function nonEmptyString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new RepositoryError(`${field} is required`, {code: 'PERSISTENCE_VALIDATION_ERROR', status: 422, details: {field}});
  }
  return value.trim();
}

function sanitizeValue(value, depth = 0) {
  if (depth > 8 || value === undefined || typeof value === 'function' || typeof value === 'symbol') return undefined;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) return value.map(item => sanitizeValue(item, depth + 1)).filter(item => item !== undefined);
  if (Object.getPrototypeOf(value) !== Object.prototype) return undefined;
  const result = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (FORBIDDEN_METADATA_KEY.test(key) || key.startsWith('$') || key.includes('.')) continue;
    const sanitized = sanitizeValue(nestedValue, depth + 1);
    if (sanitized !== undefined) result[key] = sanitized;
  }
  return result;
}

function sanitizeMetadata(metadata) {
  if (metadata === undefined || metadata === null) return {};
  if (Array.isArray(metadata) || Object.getPrototypeOf(metadata) !== Object.prototype) {
    throw new RepositoryError('metadata must be a plain object', {code: 'PERSISTENCE_VALIDATION_ERROR', status: 422, details: {field: 'metadata'}});
  }
  return sanitizeValue(metadata) || {};
}

function optionalString(value, field) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new RepositoryError(`${field} must be a string`, {code: 'PERSISTENCE_VALIDATION_ERROR', status: 422, details: {field}});
  return value;
}

function trustedAuditAppend(input) {
  const result = {
    actorId: toObjectId(input?.actorId, 'actorId'),
    action: nonEmptyString(input?.action, 'action'),
    targetType: nonEmptyString(input?.targetType, 'targetType'),
    targetId: toObjectId(input?.targetId, 'targetId'),
    metadata: sanitizeMetadata(input?.metadata),
  };
  const ipAddress = optionalString(input?.ipAddress, 'ipAddress');
  const userAgent = optionalString(input?.userAgent, 'userAgent');
  if (ipAddress !== undefined) result.ipAddress = ipAddress;
  if (userAgent !== undefined) result.userAgent = userAgent;
  return result;
}

function pageOptions({page, limit} = {}) {
  const parse = (value, fallback, maximum) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
  };
  const normalizedPage = parse(page, 1, Number.MAX_SAFE_INTEGER);
  const normalizedLimit = parse(limit, 20, 100);
  return {page: normalizedPage, limit: normalizedLimit, skip: (normalizedPage - 1) * normalizedLimit};
}

async function executeAuditOperation(operation) {
  try { return await operation(); }
  catch (error) { throw mapMongoError(error); }
}

// Deliberately does not extend MongooseRepository: AuditLog must not inherit
// generic mutation primitives. Its public surface is append plus read-only queries.
class AuditLogMongoRepository {
  #model;

  constructor(model = AuditLog) { this.#model = model; }

  async append(input) {
    return executeAuditOperation(async () => toRuntimeObject(await this.#model.create(trustedAuditAppend(input))));
  }

  async findById(id) {
    return executeAuditOperation(async () => toRuntimeObject(await this.#model.findById(toObjectId(id)).lean().exec()));
  }

  async listRecent(options = {}) { return this.#list({}, options); }
  async listByActor(actorId, options = {}) { return this.#list({actorId: toObjectId(actorId, 'actorId')}, options); }
  async listByTarget(targetType, targetId, options = {}) {
    return this.#list({targetType: nonEmptyString(targetType, 'targetType'), targetId: toObjectId(targetId, 'targetId')}, options);
  }

  async #list(filter, options) {
    const pagination = pageOptions(options);
    return executeAuditOperation(async () => {
      const [documents, total] = await Promise.all([
        this.#model.find(filter).sort({createdAt: -1}).skip(pagination.skip).limit(pagination.limit).lean().exec(),
        this.#model.countDocuments(filter),
      ]);
      return {items: documents.map(toRuntimeObject), pagination: {page: pagination.page, limit: pagination.limit, total}};
    });
  }
}

module.exports = {AuditLogMongoRepository, trustedAuditAppend, sanitizeMetadata, pageOptions};
