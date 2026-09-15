const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {Notification, Comment, Rating, Report} = require('../src/models');

function objectId() {
  return new mongoose.Types.ObjectId();
}

function indexFor(schema, keys) {
  return schema.indexes().find(([definition]) => JSON.stringify(definition) === JSON.stringify(keys));
}

async function validationError(document) {
  try {
    await document.validate();
    assert.fail('Expected schema validation to fail');
  } catch (error) {
    return error;
  }
}

test('Notification validates canonical type and target fields with unread defaults', async () => {
  const notification = new Notification({
    userId: objectId(),
    type: 'STORY_APPROVED',
    title: 'Story approved',
    message: 'Your story is approved.',
    targetType: 'STORY',
    targetId: objectId(),
  });
  await notification.validate();

  assert.equal(notification.isRead, false);
  assert.equal(notification.readAt, null);
  assert.ok(Notification.schema.path('createdAt'));
  assert.ok(Notification.schema.path('updatedAt'));
  assert.ok((await validationError(new Notification({...notification.toObject(), type: 'AUTHOR_APPLICATION_SUBMITTED'}))).errors.type);
  assert.ok((await validationError(new Notification({...notification.toObject(), targetType: 'USER'}))).errors.targetType);
  assert.deepEqual(indexFor(Notification.schema, {userId: 1, createdAt: -1})[1], {});
  assert.deepEqual(indexFor(Notification.schema, {userId: 1, isRead: 1})[1], {});
});

test('Comment uses status deletion, nullable context refs, and non-negative likeCount', async () => {
  const comment = new Comment({userId: objectId(), storyId: objectId(), content: '  Great chapter  '});
  await comment.validate();

  assert.equal(comment.content, 'Great chapter');
  assert.equal(comment.chapterId, null);
  assert.equal(comment.parentCommentId, null);
  assert.equal(comment.status, 'ACTIVE');
  assert.equal(comment.likeCount, 0);
  assert.equal(Comment.schema.path('deletedAt'), undefined);
  assert.equal(Comment.schema.path('deletedBy'), undefined);
  assert.ok((await validationError(new Comment({...comment.toObject(), status: 'REMOVED'}))).errors.status);
  assert.ok((await validationError(new Comment({...comment.toObject(), likeCount: -1}))).errors.likeCount);
  assert.deepEqual(indexFor(Comment.schema, {storyId: 1, createdAt: -1})[1], {});
  assert.deepEqual(indexFor(Comment.schema, {parentCommentId: 1})[1], {});
});

test('Rating accepts only integer one-to-five stars and defines one-rating-per-story', async () => {
  const rating = new Rating({userId: objectId(), storyId: objectId(), stars: 5});
  await rating.validate();

  assert.equal(rating.review, null);
  assert.ok((await validationError(new Rating({...rating.toObject(), stars: 1.5}))).errors.stars);
  assert.ok((await validationError(new Rating({...rating.toObject(), stars: 0}))).errors.stars);
  assert.ok((await validationError(new Rating({...rating.toObject(), stars: 6}))).errors.stars);
  assert.deepEqual(indexFor(Rating.schema, {userId: 1, storyId: 1})[1], {unique: true});
});

test('Report keeps canonical names, enums, timestamps, and target indexes', async () => {
  const report = new Report({
    reporterId: objectId(),
    targetType: 'AUDIO',
    targetId: objectId(),
    reportType: 'AUDIO_NOISE',
  });
  await report.validate();

  assert.equal(report.description, '');
  assert.equal(report.status, 'OPEN');
  assert.equal(report.reviewedBy, null);
  assert.equal(report.reviewedAt, null);
  assert.equal(report.resolutionNote, null);
  assert.ok(Report.schema.path('createdAt'));
  assert.ok(Report.schema.path('updatedAt'));
  for (const field of ['type', 'handledBy', 'resolvedAt', 'chapterId']) {
    assert.equal(Report.schema.path(field), undefined, `${field} must not be persisted`);
  }
  assert.ok((await validationError(new Report({...report.toObject(), targetType: 'SYSTEM'}))).errors.targetType);
  assert.ok((await validationError(new Report({...report.toObject(), reportType: 'SPAM'}))).errors.reportType);
  assert.ok((await validationError(new Report({...report.toObject(), status: 'CLOSED'}))).errors.status);
  assert.deepEqual(indexFor(Report.schema, {status: 1, createdAt: -1})[1], {});
  assert.deepEqual(indexFor(Report.schema, {targetType: 1, targetId: 1})[1], {});
});

test('community models compile without MongoDB connection or duplicate model registration', () => {
  assert.equal(mongoose.connection.readyState, 0);
  assert.equal(mongoose.models.Notification, Notification);
  assert.equal(mongoose.models.Comment, Comment);
  assert.equal(mongoose.models.Rating, Rating);
  assert.equal(mongoose.models.Report, Report);
});
