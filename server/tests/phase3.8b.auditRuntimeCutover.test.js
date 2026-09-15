const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const adminController = require('../src/modules/admin/adminController');
const auditLogService = require('../src/services/auditLogService').auditLogService;
const {
  AuditLogMongoRepository,
  getAuditRepositories, configureAuditRepositoriesForTests, resetAuditRepositoriesToProduction,
  configureContentRepositoriesForTests, resetContentRepositoriesToProduction,
  getIdentityRepositories, getCommunityRepositories,
} = require('../src/repositories');
const {trustedAuditAppend} = require('../src/repositories/mongo/AuditLogMongoRepository');
const {RepositoryError} = require('../src/repositories/errors/mongoErrorMapper');

function objectId() { return new mongoose.Types.ObjectId(); }
function responseCapture() {
  return {statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }};
}
function contentProvider(story = {}) {
  return {
    runtime: 'TEST', genre: {},
    story: {
      async findById(id) { return {id, creatorId: 'owner'}; },
      async reviewModeration(id, input) { return {id, ...input}; },
      ...story,
    },
    chapter: {async findById() { return null; }},
    audio: {async findById() { return null; }},
  };
}

test.afterEach(() => {
  resetAuditRepositoriesToProduction();
  resetContentRepositoriesToProduction();
});

test('production Audit provider resolves append-only Mongo while every prior runtime remains Mongo', () => {
  const audit = getAuditRepositories();
  assert.equal(audit.runtime, 'MONGO');
  assert.ok(audit.auditLog instanceof AuditLogMongoRepository);
  assert.equal(getIdentityRepositories().user.constructor.name, 'UserMongoRepository');
  assert.equal(getCommunityRepositories().runtime, 'MONGO');
  assert.equal(require('../src/services/auditLogService').auditLogRepository, undefined);
});

test('Audit service forwards only trusted canonical input to the injected append-only provider and keeps metadata sanitized', async () => {
  const actorId = objectId();
  const targetId = objectId();
  let persisted;
  configureAuditRepositoriesForTests({runtime: 'TEST', auditLog: {
    async append(input) { persisted = trustedAuditAppend(input); return {id: 'audit-1', ...persisted}; },
    async listRecent() { return {items: [], pagination: {page: 1, limit: 20, total: 0}}; },
  }});
  await auditLogService.record({
    actorId, action: 'STORY_APPROVED', targetType: 'STORY', targetId,
    metadata: {safe: true, auth: {accessToken: 'dummy-token'}, password: 'dummy-password'},
    ipAddress: '127.0.0.1', userAgent: 'Unit Test Agent', updatedAt: new Date(),
  });
  assert.equal(persisted.actorId.toString(), actorId.toString());
  assert.equal(persisted.targetId.toString(), targetId.toString());
  assert.deepEqual(persisted.metadata, {safe: true, auth: {}});
  assert.equal(persisted.updatedAt, undefined);
  assert.equal(persisted.ipAddress, '127.0.0.1');
  assert.equal(persisted.userAgent, 'Unit Test Agent');
});

test('existing Admin Story moderation uses authenticated Admin actor, preserves action/target, and does not trust body actorId', async () => {
  const captured = [];
  configureContentRepositoriesForTests(contentProvider());
  configureAuditRepositoriesForTests({runtime: 'TEST', auditLog: {
    async append(input) { captured.push(input); return {id: 'audit-1', ...input}; },
    async listRecent() { return {items: [], pagination: {}}; },
  }});
  const req = {params: {id: 'story-target'}, user: {id: 'admin-authenticated', role: 'ADMIN'}, body: {actorId: 'attacker', password: 'not-audit-metadata'}};
  const res = responseCapture();
  await adminController.approveStory(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(captured.length, 1);
  assert.deepEqual(captured[0], {
    actorId: 'admin-authenticated', action: 'STORY_APPROVED', targetType: 'STORY', targetId: 'story-target', metadata: {},
  });
});

test('all eleven existing Admin producer action names remain awaited and no new producer is introduced', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/modules/admin/adminController.js'), 'utf8');
  const actions = [...source.matchAll(/action: '([^']+)'/g)].map(match => match[1]);
  assert.deepEqual(actions, [
    'AUTHOR_APPLICATION_APPROVED', 'AUTHOR_APPLICATION_REJECTED',
    'STORY_APPROVED', 'STORY_REJECTED', 'STORY_REVISION_REQUIRED',
    'CHAPTER_APPROVED', 'CHAPTER_REJECTED', 'CHAPTER_REVISION_REQUIRED',
    'AUDIO_APPROVED', 'AUDIO_REJECTED', 'AUDIO_REVISION_REQUIRED',
  ]);
  assert.equal((source.match(/await auditLogService\.record\(/g) || []).length, actions.length);
});

test('Audit append failure is controlled after the existing business mutation, without fallback, recursion, or invented compensation', async () => {
  let moderationCalls = 0;
  configureContentRepositoriesForTests(contentProvider({
    async reviewModeration(id, input) { moderationCalls += 1; return {id, ...input}; },
  }));
  configureAuditRepositoriesForTests({runtime: 'TEST', auditLog: {
    async append() { throw new RepositoryError('Audit persistence failed', {code: 'PERSISTENCE_ERROR', status: 500}); },
    async listRecent() { return {items: [], pagination: {}}; },
  }});
  await assert.rejects(
    () => adminController.approveStory({params: {id: 'story-target'}, user: {id: 'admin', role: 'ADMIN'}, body: {}}, responseCapture()),
    error => error.code === 'PERSISTENCE_ERROR'
  );
  assert.equal(moderationCalls, 1);
});
