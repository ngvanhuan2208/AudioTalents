const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {
  NotificationMongoRepository,
  CommentMongoRepository,
  RatingMongoRepository,
  ReportMongoRepository,
  getContentRepositories,
  getCommunityRepositories,
} = require('../src/repositories');
const {trustedNotification} = require('../src/repositories/mongo/NotificationMongoRepository');
const {trustedComment} = require('../src/repositories/mongo/CommentMongoRepository');
const {trustedRating, trustedRatingUpdate} = require('../src/repositories/mongo/RatingMongoRepository');
const {trustedReport} = require('../src/repositories/mongo/ReportMongoRepository');

function objectId() { return new mongoose.Types.ObjectId(); }
function query(value, captures = {}) {
  return {
    sort(sort) { captures.sort = sort; return this; },
    lean() { return {exec: async () => value}; },
  };
}

test('NotificationMongoRepository uses trusted canonical creation and user-scoped unread operations', async () => {
  const userId = objectId();
  const storyId = objectId();
  const notificationId = objectId();
  const captures = {};
  const model = {
    findById(id) { captures.findById = id; return query({_id: notificationId, userId}, captures); },
    find(filter) { captures.find = filter; return query([], captures); },
    countDocuments(filter) { captures.count = filter; return 3; },
    async create(input) { captures.create = input; return {_id: notificationId, ...input}; },
    findOneAndUpdate(filter, update, options) { captures.update = {filter, update, options}; return query({_id: notificationId, ...filter, ...update.$set}, captures); },
    async updateMany(filter, update, options) { captures.updateMany = {filter, update, options}; return {modifiedCount: 2}; },
  };
  const repository = new NotificationMongoRepository(model);
  await repository.createNotification({userId, type: 'STORY_APPROVED', title: ' Approved ', message: ' Published ', targetType: 'STORY', targetId: storyId, isRead: true, ignored: true});
  assert.equal(captures.create.userId.toString(), userId.toString());
  assert.equal(captures.create.targetId.toString(), storyId.toString());
  assert.equal(captures.create.title, 'Approved');
  assert.equal(captures.create.isRead, undefined);
  assert.equal(captures.create.ignored, undefined);
  await repository.listByUser(userId);
  assert.equal(captures.find.userId.toString(), userId.toString());
  assert.deepEqual(captures.sort, {createdAt: -1});
  await repository.listUnreadByUser(userId);
  assert.equal(captures.find.isRead, false);
  assert.equal(await repository.countUnread(userId), 3);
  assert.equal(captures.count.isRead, false);
  await repository.markRead(userId, notificationId, '2026-01-01T00:00:00.000Z');
  assert.equal(captures.update.filter.userId.toString(), userId.toString());
  assert.equal(captures.update.update.$set.isRead, true);
  await repository.markAllRead(userId, '2026-01-02T00:00:00.000Z');
  assert.equal(captures.updateMany.filter.isRead, false);
  assert.equal(captures.updateMany.update.$set.isRead, true);
  assert.equal(trustedNotification({userId, type: 'SYSTEM', title: 'System', message: 'Message', targetType: 'SYSTEM'}).targetId, null);
  assert.throws(() => trustedNotification({userId, type: 'STORY_APPROVED', title: 'x', message: 'x', targetType: 'STORY'}), error => error.code === 'PERSISTENCE_VALIDATION_ERROR');
  assert.throws(() => trustedNotification({userId, type: 'WELCOME', title: 'x', message: 'x', targetType: 'SYSTEM'}), error => error.code === 'PERSISTENCE_VALIDATION_ERROR');
});

test('CommentMongoRepository persists canonical context, restricts public listings, and deletes by status', async () => {
  const userId = objectId();
  const storyId = objectId();
  const chapterId = objectId();
  const parentCommentId = objectId();
  const commentId = objectId();
  const captures = {};
  const model = {
    findById(id) { captures.findById = id; return query({_id: commentId, userId, storyId, content: 'text'}, captures); },
    find(filter) { captures.find = filter; return query([], captures); },
    async create(input) { captures.create = input; return {_id: commentId, ...input}; },
    findByIdAndUpdate(id, update, options) { captures.update = {id, update, options}; return query({_id: commentId, ...update.$set}, captures); },
  };
  const repository = new CommentMongoRepository(model);
  await repository.createComment({userId, storyId, chapterId, parentCommentId, content: '  Nice  ', status: 'HIDDEN', likeCount: 99, deletedAt: new Date()});
  assert.equal(captures.create.userId.toString(), userId.toString());
  assert.equal(captures.create.storyId.toString(), storyId.toString());
  assert.equal(captures.create.chapterId.toString(), chapterId.toString());
  assert.equal(captures.create.parentCommentId.toString(), parentCommentId.toString());
  assert.equal(captures.create.content, 'Nice');
  assert.equal(captures.create.status, undefined);
  assert.equal(captures.create.likeCount, undefined);
  assert.equal(captures.create.deletedAt, undefined);
  await repository.listByStory(storyId);
  assert.deepEqual(captures.find.status, {$in: ['ACTIVE']});
  await repository.listByChapter(chapterId, {statuses: ['ACTIVE', 'DELETED']});
  assert.deepEqual(captures.find.status, {$in: ['ACTIVE', 'DELETED']});
  await repository.listReplies(parentCommentId);
  assert.equal(captures.find.parentCommentId.toString(), parentCommentId.toString());
  await repository.markDeleted(commentId);
  assert.deepEqual(captures.update.update, {$set: {status: 'DELETED'}});
  assert.throws(() => trustedComment({userId, storyId, chapterId: 'bad', content: 'x'}), error => error.code === 'INVALID_ID');
  await assert.rejects(() => repository.listByStory(storyId, {statuses: ['REMOVED']}), error => error.code === 'PERSISTENCE_VALIDATION_ERROR');
});

test('RatingMongoRepository enforces canonical rating fields, normalizes duplicate errors, and only aggregates Rating', async () => {
  const userId = objectId();
  const storyId = objectId();
  const ratingId = objectId();
  const captures = {};
  const model = {
    findById(id) { captures.findById = id; return query({_id: ratingId, userId, storyId, stars: 5}, captures); },
    findOne(filter) { captures.findOne = filter; return query({_id: ratingId, ...filter, stars: 4}, captures); },
    find(filter) { captures.find = filter; return query([], captures); },
    async create(input) { captures.create = input; return {_id: ratingId, ...input}; },
    findByIdAndUpdate(id, update, options) { captures.update = {id, update, options}; return query({_id: ratingId, ...update.$set}, captures); },
    findByIdAndDelete(id) { captures.delete = id; return query({_id: ratingId}, captures); },
    aggregate(pipeline) { captures.aggregate = pipeline; return {exec: async () => [{ratingCount: 2, ratingAverage: 4.5}]}; },
  };
  const repository = new RatingMongoRepository(model);
  await repository.createRating({userId, storyId, stars: 5, review: 'Great', ratingCount: 100, ratingAverage: 5});
  assert.equal(captures.create.userId.toString(), userId.toString());
  assert.equal(captures.create.storyId.toString(), storyId.toString());
  assert.equal(captures.create.ratingCount, undefined);
  assert.equal(captures.create.ratingAverage, undefined);
  await repository.findByUserAndStory(userId, storyId);
  assert.equal(captures.findOne.userId.toString(), userId.toString());
  assert.equal(captures.findOne.storyId.toString(), storyId.toString());
  await repository.updateRating(ratingId, {stars: 3, review: null, userId});
  assert.deepEqual(captures.update.update, {$set: {stars: 3, review: null}});
  await repository.deleteById(ratingId);
  assert.equal(captures.delete.toString(), ratingId.toString());
  assert.deepEqual(await repository.aggregateForStory(storyId), {ratingCount: 2, ratingAverage: 4.5});
  assert.equal(captures.aggregate[0].$match.storyId.toString(), storyId.toString());
  assert.throws(() => trustedRating({userId, storyId, stars: 2.5}), error => error.code === 'PERSISTENCE_VALIDATION_ERROR');
  assert.throws(() => trustedRating({userId, storyId, stars: 0}), error => error.code === 'PERSISTENCE_VALIDATION_ERROR');
  assert.throws(() => trustedRatingUpdate({ratingAverage: 4}), error => error.code === 'EMPTY_UPDATE');
  const duplicate = new RatingMongoRepository({async create() { throw {code: 11000}; }});
  await assert.rejects(() => duplicate.createRating({userId, storyId, stars: 5}), error => error.code === 'RATING_ALREADY_EXISTS');
  const zero = new RatingMongoRepository({aggregate() { return {exec: async () => []}; }});
  assert.deepEqual(await zero.aggregateForStory(storyId), {ratingCount: 0, ratingAverage: 0});
});

test('ReportMongoRepository maps legacy aliases once, keeps review writes targeted, and leaves target checks to services', async () => {
  const reporterId = objectId();
  const targetId = objectId();
  const reviewerId = objectId();
  const reportId = objectId();
  const captures = {};
  const model = {
    findById(id) { captures.findById = id; return query({_id: reportId}, captures); },
    find(filter) { captures.find = filter; return query([], captures); },
    async create(input) { captures.create = input; return {_id: reportId, ...input}; },
    findByIdAndUpdate(id, update, options) { captures.update = {id, update, options}; return query({_id: reportId, ...update.$set}, captures); },
  };
  const repository = new ReportMongoRepository(model);
  await repository.createReport({reporterId, targetType: 'CHAPTER', targetId, type: 'COPYRIGHT', description: 'Copied', status: 'RESOLVED', handledBy: reviewerId, resolvedAt: new Date()});
  assert.equal(captures.create.reporterId.toString(), reporterId.toString());
  assert.equal(captures.create.targetId.toString(), targetId.toString());
  assert.equal(captures.create.reportType, 'COPYRIGHT');
  assert.equal(captures.create.type, undefined);
  assert.equal(captures.create.status, undefined);
  assert.equal(captures.create.handledBy, undefined);
  assert.equal(captures.create.resolvedAt, undefined);
  assert.equal(captures.create.reviewedBy, undefined);
  await repository.listForAdmin({status: 'OPEN'});
  assert.deepEqual(captures.find, {status: 'OPEN'});
  await repository.listByTarget('CHAPTER', targetId);
  assert.equal(captures.find.targetType, 'CHAPTER');
  assert.equal(captures.find.targetId.toString(), targetId.toString());
  await repository.resolve(reportId, reviewerId, 'Resolved', '2026-01-03T00:00:00.000Z');
  assert.equal(captures.update.update.$set.status, 'RESOLVED');
  assert.equal(captures.update.update.$set.reviewedBy.toString(), reviewerId.toString());
  assert.equal(captures.update.update.$set.resolutionNote, 'Resolved');
  assert.throws(() => trustedReport({reporterId, targetType: 'SYSTEM', targetId, reportType: 'OTHER'}), error => error.code === 'PERSISTENCE_VALIDATION_ERROR');
  assert.throws(() => trustedReport({reporterId, targetType: 'AUDIO', targetId, reportType: 'PROMOTION'}), error => error.code === 'PERSISTENCE_VALIDATION_ERROR');
});

test('Community Mongo repositories are exported while AuditLog remains outside Phase 3.7 scope', () => {
  assert.equal(getContentRepositories().runtime, 'MONGO');
  assert.equal(getCommunityRepositories().runtime, 'MONGO');
  assert.ok(getCommunityRepositories().notification instanceof NotificationMongoRepository);
  assert.equal(require('../src/models').AuditLog !== undefined, true);
  assert.equal(typeof require('../src/repositories').AuditLogMongoRepository, 'function');
});
