const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const models = require('../src/models');

const CANONICAL_MODEL_NAMES = [
  'User', 'OtpToken', 'AuthorApplication', 'Genre', 'Tag', 'TaxonomyProposal', 'Story', 'Chapter', 'Audio',
  'LibraryItem', 'ListenHistory', 'Playlist', 'Notification', 'Comment', 'Rating', 'Report', 'AuditLog',
];
const PAYMENT_EXTENSION_NAMES = ['Plan', 'PaymentAttempt', 'PaymentWebhookEvent', 'Subscription',
  'SubscriptionPeriod', 'UserEntitlement', 'RefundAttempt', 'SubscriptionReminder'];
const MUTABLE_MODEL_NAMES = CANONICAL_MODEL_NAMES.filter(name => name !== 'AuditLog');

function objectId() {
  return new mongoose.Types.ObjectId();
}

function legacyPathAudit(model, fields) {
  for (const field of fields) assert.equal(model.schema.path(field), undefined, `${model.modelName}.${field} must not persist`);
}

test('AuditLog is canonical, append-only in shape, createdAt-only, and flexibly targetable', async () => {
  const auditLog = new models.AuditLog({
    actorId: objectId(),
    action: 'STORY_APPROVED',
    targetType: 'FUTURE_DOMAIN_TYPE',
    targetId: objectId(),
    metadata: {reviewNote: 'Approved'},
  });
  await auditLog.validate();

  assert.deepEqual(auditLog.metadata, {reviewNote: 'Approved'});
  assert.equal(auditLog.ipAddress, null);
  assert.equal(auditLog.userAgent, null);
  assert.ok(AuditLogSchemaPath(auditLog, 'createdAt'));
  assert.equal(models.AuditLog.schema.path('updatedAt'), undefined);
  assert.notEqual(models.AuditLog.schema.options.versionKey, false);
  for (const field of ['status', 'deletedAt', 'deletedBy', 'reviewedAt']) {
    assert.equal(models.AuditLog.schema.path(field), undefined, `${field} must not be present`);
  }
  assert.deepEqual(models.AuditLog.schema.indexes(), [
    [{actorId: 1, createdAt: -1}, {}],
    [{targetType: 1, targetId: 1}, {}],
  ]);
});

function AuditLogSchemaPath(auditLog, path) {
  return auditLog.constructor.schema.path(path);
}

test('full registry contains Core V1, taxonomy and explicit Payment Core V2 extensions without connection side effects', () => {
  assert.equal(mongoose.connection.readyState, 0);
  const all = [...CANONICAL_MODEL_NAMES, ...PAYMENT_EXTENSION_NAMES];
  assert.deepEqual(Object.keys(models), all);
  assert.deepEqual(Object.keys(mongoose.models).sort(), [...all].sort());
  for (const name of all) assert.equal(mongoose.models[name], models[name]);
});

test('all model index definitions exactly match the Core V1 registry contract', () => {
  const expected = {
    User: [[{email: 1}, {unique: true}]],
    OtpToken: [[{expiresAt: 1}, {expireAfterSeconds: 0}], [{userId: 1, purpose: 1}, {}], [{email: 1, purpose: 1}, {}]],
    AuthorApplication: [[{userId: 1}, {unique: true, partialFilterExpression: {status: 'PENDING'}}], [{createdAt: -1}, {}]],
    Genre: [[{slug: 1}, {unique: true}], [{name: 1}, {}]],
    Tag: [[{normalizedName: 1}, {unique: true}], [{slug: 1}, {unique: true}], [{isActive: 1, name: 1}, {}]],
    TaxonomyProposal: [[{status: 1, createdAt: -1}, {}], [{proposerId: 1, storyId: 1, type: 1}, {}]],
    Story: [[{slug: 1}, {unique: true}], [{creatorId: 1}, {}], [{genreIds: 1}, {}], [{reviewStatus: 1, publishedAt: -1}, {}], [{createdAt: -1}, {}], [{title: 'text', description: 'text'}, {}]],
    Chapter: [[{storyId: 1, chapterNumber: 1}, {unique: true}], [{storyId: 1, status: 1}, {}]],
    Audio: [[{chapterId: 1}, {}], [{creatorId: 1, status: 1}, {}], [{chapterId: 1, status: 1, processingStatus: 1, isPrimary: 1}, {}], [{chapterId: 1, isPrimary: 1}, {unique: true, partialFilterExpression: {isPrimary: true, deletedAt: null}}], [{chapterId: 1, partNumber: 1}, {unique: true, partialFilterExpression: {partNumber: {$type: 'number'}}}]],
    LibraryItem: [[{userId: 1, storyId: 1}, {unique: true}], [{userId: 1, isFavorite: 1}, {}], [{userId: 1, followed: 1}, {}]],
    ListenHistory: [[{userId: 1, chapterId: 1}, {unique: true}], [{userId: 1, storyId: 1, lastListenedAt: -1}, {}]],
    Playlist: [[{userId: 1}, {}]],
    Notification: [[{userId: 1, createdAt: -1}, {}], [{userId: 1, isRead: 1}, {}]],
    Comment: [[{storyId: 1, createdAt: -1}, {}], [{parentCommentId: 1}, {}]],
    Rating: [[{userId: 1, storyId: 1}, {unique: true}]],
    Report: [[{status: 1, createdAt: -1}, {}], [{targetType: 1, targetId: 1}, {}]],
    AuditLog: [[{actorId: 1, createdAt: -1}, {}], [{targetType: 1, targetId: 1}, {}]],
  };

  for (const [name, indexes] of Object.entries(expected)) assert.deepEqual(models[name].schema.indexes(), indexes, name);
});

test('timestamp, enum namespace, reference, public filter, and legacy field audits pass', () => {
  for (const name of MUTABLE_MODEL_NAMES) {
    assert.ok(models[name].schema.path('createdAt'), `${name} must have createdAt`);
    assert.ok(models[name].schema.path('updatedAt'), `${name} must have updatedAt`);
  }
  assert.ok(models.AuditLog.schema.path('createdAt'));
  assert.equal(models.AuditLog.schema.path('updatedAt'), undefined);

  assert.deepEqual(models.Story.schema.path('status').enumValues, ['ONGOING', 'COMPLETED', 'PAUSED']);
  assert.deepEqual(models.Story.schema.path('reviewStatus').enumValues, ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED']);
  assert.deepEqual(models.Chapter.schema.path('status').enumValues, ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED']);
  assert.deepEqual(models.Audio.schema.path('status').enumValues, ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED']);
  assert.deepEqual(models.Audio.schema.path('processingStatus').enumValues, ['PENDING', 'PROCESSING', 'READY', 'FAILED']);
  assert.equal(models.AuditLog.schema.path('targetType').enumValues.length, 0);

  assert.equal(models.AuthorApplication.schema.path('reviewedBy').options.ref, 'User');
  assert.equal(models.Chapter.schema.path('storyId').options.ref, 'Story');
  assert.equal(models.Audio.schema.path('chapterId').options.ref, 'Chapter');
  assert.equal(models.ListenHistory.schema.path('audioId').options.ref, 'Audio');
  assert.equal(models.Comment.schema.path('parentCommentId').options.ref, 'Comment');
  assert.equal(models.Playlist.schema.path('userId').options.ref, 'User');

  assert.deepEqual(models.Story.PUBLIC_FILTER, {reviewStatus: 'APPROVED', visibility: 'PUBLIC', deletedAt: null});
  assert.deepEqual(models.Chapter.PUBLIC_FILTER, {status: 'APPROVED', deletedAt: null});
  assert.deepEqual(models.Audio.PUBLIC_FILTER, {status: 'APPROVED', processingStatus: 'READY', deletedAt: null});
  assert.deepEqual(models.Audio.DEFAULT_PLAYBACK_FILTER, {status: 'APPROVED', processingStatus: 'READY', deletedAt: null, isPrimary: true});

  legacyPathAudit(models.User, ['displayName', 'avatarUrl', 'bio', 'status']);
  legacyPathAudit(models.AuthorApplication, ['penName', 'introduction', 'portfolioLinks', 'adminNote']);
  legacyPathAudit(models.Story, ['contentStatus']);
  legacyPathAudit(models.Chapter, ['contentStatus', 'reviewStatus']);
  legacyPathAudit(models.Audio, ['contentStatus']);
  legacyPathAudit(models.LibraryItem, ['type']);
  legacyPathAudit(models.Report, ['type', 'handledBy', 'resolvedAt']);
});
