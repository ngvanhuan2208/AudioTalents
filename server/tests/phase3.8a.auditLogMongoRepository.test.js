const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {AuditLogMongoRepository, getCommunityRepositories, getAuditRepositories} = require('../src/repositories');
const {trustedAuditAppend, sanitizeMetadata, pageOptions} = require('../src/repositories/mongo/AuditLogMongoRepository');

function objectId() { return new mongoose.Types.ObjectId(); }
function query(value, captures = {}) {
  return {
    sort(sort) { captures.sort = sort; return this; },
    skip(skip) { captures.skip = skip; return this; },
    limit(limit) { captures.limit = limit; return this; },
    lean() { return {exec: async () => value}; },
  };
}

test('AuditLogMongoRepository exposes only append and read-only query primitives', () => {
  const repository = new AuditLogMongoRepository({});
  const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(repository));
  for (const forbidden of ['update', 'updateById', 'patch', 'replace', 'replaceById', 'upsert', 'delete', 'deleteById', 'remove', 'softDelete', 'restore', 'setStatus']) {
    assert.equal(methods.includes(forbidden), false, `${forbidden} must not be exposed`);
  }
  for (const allowed of ['append', 'findById', 'listRecent', 'listByActor', 'listByTarget']) assert.equal(methods.includes(allowed), true);
  assert.equal(Object.hasOwn(repository, 'model'), false);
});

test('AuditLogMongoRepository appends canonical fields only, preserves flexible targetType, and sanitizes metadata secrets', async () => {
  const actorId = objectId();
  const targetId = objectId();
  const auditId = objectId();
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const captures = {};
  const model = {
    async create(input) { captures.create = input; return {_id: auditId, ...input, createdAt}; },
    findById(id) { captures.findById = id; return query({_id: auditId, actorId, targetId, createdAt}, captures); },
    find(filter) { captures.find = filter; return query([], captures); },
    countDocuments(filter) { captures.count = filter; return 0; },
  };
  const repository = new AuditLogMongoRepository(model);
  const appended = await repository.append({
    actorId, action: 'STORY_APPROVED', targetType: 'FUTURE_DOMAIN_TYPE', targetId,
    metadata: {
      safe: 'value', nested: {reviewNote: 'accepted', accessToken: 'dummy-token', password: 'dummy-password'},
      otpCode: '123456', headers: {cookie: 'dummy-cookie'}, error: new Error('do not persist'),
    },
    ipAddress: '127.0.0.1', userAgent: 'Phase 3.8A test', updatedAt: new Date(), deletedAt: new Date(), ignored: true,
  });
  assert.equal(captures.create.actorId.toString(), actorId.toString());
  assert.equal(captures.create.targetId.toString(), targetId.toString());
  assert.equal(captures.create.targetType, 'FUTURE_DOMAIN_TYPE');
  assert.deepEqual(captures.create.metadata, {safe: 'value', nested: {reviewNote: 'accepted'}});
  for (const field of ['updatedAt', 'deletedAt', 'ignored']) assert.equal(captures.create[field], undefined);
  assert.equal(appended.id, auditId.toString());
  assert.equal(appended._id, undefined);
  assert.equal(appended.__v, undefined);
  assert.ok(appended.createdAt);
  assert.equal(appended.updatedAt, undefined);
  assert.deepEqual(sanitizeMetadata({auth: {refreshToken: 'x'}, list: [{cookie: 'x'}, {safe: true}]}), {auth: {}, list: [{}, {safe: true}]});
  assert.throws(() => sanitizeMetadata(new Error('unsafe')), error => error.code === 'PERSISTENCE_VALIDATION_ERROR');
});

test('AuditLogMongoRepository normalizes IDs, hardcodes safe query order, and maps persistence errors', async () => {
  const actorId = objectId();
  const targetId = objectId();
  const captures = {};
  const model = {
    findById(id) { captures.findById = id; return query(null, captures); },
    find(filter) { captures.find = filter; return query([], captures); },
    countDocuments(filter) { captures.count = filter; return 7; },
  };
  const repository = new AuditLogMongoRepository(model);
  const recent = await repository.listRecent({page: '2', limit: '500', sort: {$where: 'unsafe'}});
  assert.equal(captures.skip, 100);
  assert.equal(captures.limit, 100);
  assert.deepEqual(captures.sort, {createdAt: -1});
  assert.deepEqual(recent.pagination, {page: 2, limit: 100, total: 7});
  await repository.listByActor(actorId, {page: 1, limit: 5});
  assert.equal(captures.find.actorId.toString(), actorId.toString());
  await repository.listByTarget('AUDIT_SUBJECT', targetId);
  assert.equal(captures.find.targetType, 'AUDIT_SUBJECT');
  assert.equal(captures.find.targetId.toString(), targetId.toString());
  await assert.rejects(() => repository.findById('not-an-id'), error => error.code === 'INVALID_ID');
  assert.throws(() => trustedAuditAppend({actorId, action: 'x', targetType: 'x', targetId: 'bad'}), error => error.code === 'INVALID_ID');
  assert.deepEqual(pageOptions({page: 'bad', limit: -1}), {page: 1, limit: 20, skip: 0});

  const failing = new AuditLogMongoRepository({async create() { throw {name: 'ValidationError'}; }});
  await assert.rejects(
    () => failing.append({actorId, action: 'ACTION', targetType: 'TARGET', targetId}),
    error => error.code === 'PERSISTENCE_VALIDATION_ERROR' && error.message !== 'ValidationError'
  );
});

test('AuditLog Mongo repository remains exported after the runtime cutover', () => {
  assert.equal(typeof AuditLogMongoRepository, 'function');
  assert.equal(getCommunityRepositories().runtime, 'MONGO');
  assert.equal(getAuditRepositories().runtime, 'MONGO');
});
