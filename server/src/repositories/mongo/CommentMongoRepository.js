const Comment = require('../../models/Comment');
const {MongooseRepository} = require('../base/MongooseRepository');
const {toObjectId} = require('../adapters/objectId');
const {toRuntimeObject} = require('../adapters/persistenceMappers');
const {executeCommunityOperation, requireNonEmptyString, requireEnum} = require('./communityRepositoryHelpers');

const COMMENT_STATUSES = new Set(['ACTIVE', 'HIDDEN', 'DELETED']);

function trustedComment(input) {
  const result = {
    userId: toObjectId(input?.userId, 'userId'),
    storyId: toObjectId(input?.storyId, 'storyId'),
    content: requireNonEmptyString(input?.content, 'content'),
  };
  result.chapterId = input?.chapterId == null ? null : toObjectId(input.chapterId, 'chapterId');
  result.parentCommentId = input?.parentCommentId == null ? null : toObjectId(input.parentCommentId, 'parentCommentId');
  return result;
}

function normalizedContent(content) { return requireNonEmptyString(content, 'content'); }

class CommentMongoRepository extends MongooseRepository {
  constructor(model = Comment) { super(model); }

  async findById(id) {
    return executeCommunityOperation(async () => toRuntimeObject(await this.model.findById(toObjectId(id)).lean().exec()));
  }

  async listByStory(storyId, {statuses = ['ACTIVE']} = {}) {
    return this.#list({storyId: toObjectId(storyId, 'storyId'), status: {$in: this.#statuses(statuses)}});
  }

  async listByChapter(chapterId, {statuses = ['ACTIVE']} = {}) {
    return this.#list({chapterId: toObjectId(chapterId, 'chapterId'), status: {$in: this.#statuses(statuses)}});
  }

  async listReplies(parentCommentId, {statuses = ['ACTIVE']} = {}) {
    return this.#list({parentCommentId: toObjectId(parentCommentId, 'parentCommentId'), status: {$in: this.#statuses(statuses)}});
  }

  async createComment(input) {
    return executeCommunityOperation(async () => toRuntimeObject(await this.model.create(trustedComment(input))));
  }

  async updateContent(id, content) {
    return this.#update(id, {content: normalizedContent(content)});
  }

  async setStatus(id, status) { return this.#update(id, {status: requireEnum(status, COMMENT_STATUSES, 'status')}); }
  async markDeleted(id) { return this.setStatus(id, 'DELETED'); }

  async #list(filter) {
    return executeCommunityOperation(async () => (await this.model.find(filter).sort({createdAt: -1}).lean().exec()).map(toRuntimeObject));
  }

  #statuses(statuses) {
    if (!Array.isArray(statuses) || statuses.length === 0) throw new RepositoryError('At least one comment status is required', {code: 'PERSISTENCE_VALIDATION_ERROR', status: 422});
    return statuses.map(status => requireEnum(status, COMMENT_STATUSES, 'status'));
  }

  async #update(id, update) {
    return executeCommunityOperation(async () => toRuntimeObject(await this.model.findByIdAndUpdate(
      toObjectId(id), {$set: update}, {returnDocument: 'after', runValidators: true}
    ).lean().exec()));
  }
}

module.exports = {CommentMongoRepository, trustedComment, COMMENT_STATUSES};
