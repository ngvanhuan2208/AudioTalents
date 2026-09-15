const Chapter = require('../../models/Chapter');
const {MongooseRepository} = require('../base/MongooseRepository');
const {toObjectId} = require('../adapters/objectId');
const {pickDefined, toRuntimeObject, mapChapterRuntimeToPersistence} = require('../adapters/persistenceMappers');
const {RepositoryError} = require('../errors/mongoErrorMapper');
const {normalizeSlug, executeContentOperation} = require('./contentRepositoryHelpers');

const REVIEW_STATUS = new Set(['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED']);
const PUBLIC_FILTER = Object.freeze({status: 'APPROVED', deletedAt: null});

function mapChapterCreateInput(input) {
  const persistence = mapChapterRuntimeToPersistence(input);
  persistence.storyId = toObjectId(input?.storyId, 'storyId');
  persistence.creatorId = toObjectId(input?.creatorId, 'creatorId');
  return persistence;
}

function mapEditableChapterInput(input) {
  const update = pickDefined(input, ['chapterNumber', 'title']);
  if (input?.slug !== undefined) update.slug = normalizeSlug(input.slug);
  if (input?.textContent !== undefined || input?.content !== undefined) update.textContent = input.textContent ?? input.content;
  return update;
}

class ChapterMongoRepository extends MongooseRepository {
  constructor(model = Chapter) { super(model); }

  async findById(id, {includeDeleted = false} = {}) {
    const filter = {_id: toObjectId(id)};
    if (!includeDeleted) filter.deletedAt = null;
    return executeContentOperation(async () => toRuntimeObject(await this.model.findOne(filter).lean().exec()));
  }

  async findByStory(storyId, {includeDeleted = false} = {}) {
    const filter = {storyId: toObjectId(storyId, 'storyId')};
    if (!includeDeleted) filter.deletedAt = null;
    return executeContentOperation(async () => (await this.model.find(filter).sort({chapterNumber: 1}).lean().exec()).map(toRuntimeObject));
  }

  async findByStoryAndNumber(storyId, chapterNumber, {includeDeleted = false} = {}) {
    const filter = {storyId: toObjectId(storyId, 'storyId'), chapterNumber: Number(chapterNumber)};
    if (!includeDeleted) filter.deletedAt = null;
    return executeContentOperation(async () => toRuntimeObject(await this.model.findOne(filter).lean().exec()));
  }

  async findByModerationStatus(status) {
    if (!REVIEW_STATUS.has(status)) throw new RepositoryError('Invalid chapter moderation status', {code: 'VALIDATION_ERROR', status: 422});
    return executeContentOperation(async () => (await this.model.find({status, deletedAt: null}).sort({createdAt: -1}).lean().exec()).map(toRuntimeObject));
  }

  async findPublicByStory(storyId) {
    return executeContentOperation(async () => (await this.model.find({...PUBLIC_FILTER, storyId: toObjectId(storyId, 'storyId')})
      .sort({chapterNumber: 1}).lean().exec()).map(toRuntimeObject));
  }

  async createChapter(input) {
    return executeContentOperation(async () => toRuntimeObject(await this.model.create(mapChapterCreateInput(input))), 'CHAPTER_NUMBER_EXISTS');
  }

  async updateEditable(id, input) {
    return this.#update(id, mapEditableChapterInput(input), 'CHAPTER_NUMBER_EXISTS');
  }

  async submitForModeration(id, submittedAt = new Date()) {
    return this.#update(id, {status: 'PENDING_REVIEW', submittedAt});
  }

  async reviewModeration(id, {status, reviewedBy, reviewedAt = new Date(), moderationNote = '', publishedAt = null}) {
    if (!REVIEW_STATUS.has(status)) throw new RepositoryError('Invalid chapter moderation status', {code: 'VALIDATION_ERROR', status: 422});
    return this.#update(id, {status, reviewedBy: toObjectId(reviewedBy, 'reviewedBy'), reviewedAt, moderationNote, publishedAt});
  }

  async softDelete(id, deletedBy, deletedAt = new Date()) {
    return this.#update(id, {deletedAt, deletedBy: toObjectId(deletedBy, 'deletedBy')});
  }

  async restore(id) {
    return this.#update(id, {deletedAt: null, deletedBy: null});
  }

  async #update(id, update, duplicateCode) {
    if (Object.keys(update).length === 0) throw new RepositoryError('Chapter update requires allowed fields', {code: 'EMPTY_UPDATE', status: 422});
    return executeContentOperation(async () => toRuntimeObject(await this.model.findByIdAndUpdate(
      toObjectId(id), {$set: update}, {returnDocument: 'after', runValidators: true}
    ).lean().exec()), duplicateCode);
  }
}

module.exports = {ChapterMongoRepository, PUBLIC_FILTER, mapChapterCreateInput, mapEditableChapterInput};
