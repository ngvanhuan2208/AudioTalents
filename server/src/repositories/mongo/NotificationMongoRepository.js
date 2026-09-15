const Notification = require('../../models/Notification');
const {MongooseRepository} = require('../base/MongooseRepository');
const {toObjectId} = require('../adapters/objectId');
const {toRuntimeObject} = require('../adapters/persistenceMappers');
const {RepositoryError} = require('../errors/mongoErrorMapper');
const {executeCommunityOperation, requireNonEmptyString, requireEnum} = require('./communityRepositoryHelpers');

const NOTIFICATION_TYPES = new Set([
  'AUTHOR_APPLICATION_APPROVED', 'AUTHOR_APPLICATION_REJECTED',
  'STORY_APPROVED', 'STORY_REJECTED', 'STORY_REVISION_REQUIRED',
  'CHAPTER_APPROVED', 'CHAPTER_REJECTED', 'AUDIO_APPROVED', 'AUDIO_REJECTED',
  'NEW_CHAPTER', 'SYSTEM',
]);
const TARGET_TYPES = new Set(['STORY', 'CHAPTER', 'AUDIO', 'AUTHOR_APPLICATION', 'SYSTEM']);

function trustedNotification(input) {
  const targetType = requireEnum(input?.targetType, TARGET_TYPES, 'targetType');
  const result = {
    userId: toObjectId(input?.userId, 'userId'),
    type: requireEnum(input?.type, NOTIFICATION_TYPES, 'type'),
    title: requireNonEmptyString(input?.title, 'title'),
    message: requireNonEmptyString(input?.message, 'message'),
    targetType,
  };
  if (targetType === 'SYSTEM') {
    result.targetId = input?.targetId == null ? null : toObjectId(input.targetId, 'targetId');
  } else {
    if (input?.targetId == null) {
      throw new RepositoryError('targetId is required for non-SYSTEM notifications', {code: 'PERSISTENCE_VALIDATION_ERROR', status: 422, details: {field: 'targetId'}});
    }
    result.targetId = toObjectId(input.targetId, 'targetId');
  }
  return result;
}

class NotificationMongoRepository extends MongooseRepository {
  constructor(model = Notification) { super(model); }

  async findById(id) {
    return executeCommunityOperation(async () => toRuntimeObject(await this.model.findById(toObjectId(id)).lean().exec()));
  }

  async listByUser(userId) { return this.#list({userId: toObjectId(userId, 'userId')}); }
  async listUnreadByUser(userId) { return this.#list({userId: toObjectId(userId, 'userId'), isRead: false}); }

  async countUnread(userId) {
    const filter = {userId: toObjectId(userId, 'userId'), isRead: false};
    return executeCommunityOperation(async () => this.model.countDocuments(filter));
  }

  async createNotification(input) {
    return executeCommunityOperation(async () => toRuntimeObject(await this.model.create(trustedNotification(input))));
  }

  async markRead(userId, id, readAt = new Date()) {
    const filter = {_id: toObjectId(id), userId: toObjectId(userId, 'userId')};
    return executeCommunityOperation(async () => toRuntimeObject(await this.model.findOneAndUpdate(
      filter, {$set: {isRead: true, readAt: new Date(readAt)}}, {returnDocument: 'after', runValidators: true}
    ).lean().exec()));
  }

  async markAllRead(userId, readAt = new Date()) {
    const filter = {userId: toObjectId(userId, 'userId'), isRead: false};
    return executeCommunityOperation(async () => this.model.updateMany(filter, {$set: {isRead: true, readAt: new Date(readAt)}}, {runValidators: true}));
  }

  async #list(filter) {
    return executeCommunityOperation(async () => (await this.model.find(filter).sort({createdAt: -1}).lean().exec()).map(toRuntimeObject));
  }
}

module.exports = {NotificationMongoRepository, trustedNotification, NOTIFICATION_TYPES, TARGET_TYPES};
