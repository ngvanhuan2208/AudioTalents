const Story = require('../../models/Story');
const {MongooseRepository} = require('../base/MongooseRepository');
const {toObjectId} = require('../adapters/objectId');
const {pickDefined, toRuntimeObject, mapStoryRuntimeToPersistence} = require('../adapters/persistenceMappers');
const {RepositoryError} = require('../errors/mongoErrorMapper');
const {normalizeSlug, pageOptions, executeContentOperation} = require('./contentRepositoryHelpers');

const STORY_PROGRESS = new Set(['ONGOING', 'COMPLETED', 'PAUSED']);
const REVIEW_STATUS = new Set(['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED']);
const VISIBILITY = new Set(['PRIVATE', 'PUBLIC', 'UNLISTED']);
const PUBLIC_FILTER = Object.freeze({reviewStatus: 'APPROVED', visibility: 'PUBLIC', deletedAt: null});

function mapStoryCreateInput(input) {
  const persistence = mapStoryRuntimeToPersistence(input);
  persistence.creatorId = toObjectId(input?.creatorId, 'creatorId');
  persistence.genreIds = (persistence.genreIds || []).map(id => toObjectId(id, 'genreId'));
  return persistence;
}

function mapEditableStoryInput(input) {
  const update = pickDefined(input, ['title', 'description', 'tags']);
  if (input?.coverUrl !== undefined || input?.cover !== undefined) update.coverUrl = input.coverUrl ?? input.cover;
  if (input?.genreIds !== undefined || input?.genres !== undefined) {
    update.genreIds = (input.genreIds ?? input.genres).map(id => toObjectId(id, 'genreId'));
  }
  if (STORY_PROGRESS.has(input?.status)) update.status = input.status;
  if (VISIBILITY.has(input?.visibility)) update.visibility = input.visibility;
  return update;
}

class StoryMongoRepository extends MongooseRepository {
  constructor(model = Story) { super(model); }

  async findById(id, {includeDeleted = false} = {}) {
    const filter = {_id: toObjectId(id)};
    if (!includeDeleted) filter.deletedAt = null;
    return executeContentOperation(async () => toRuntimeObject(await this.model.findOne(filter).lean().exec()));
  }

  async findBySlug(slug, {includeDeleted = false} = {}) {
    const filter = {slug: normalizeSlug(slug)};
    if (!includeDeleted) filter.deletedAt = null;
    return executeContentOperation(async () => toRuntimeObject(await this.model.findOne(filter).lean().exec()));
  }

  async findByCreator(creatorId, {includeDeleted = false} = {}) {
    const filter = {creatorId: toObjectId(creatorId, 'creatorId')};
    if (!includeDeleted) filter.deletedAt = null;
    return executeContentOperation(async () => (await this.model.find(filter).sort({createdAt: -1}).lean().exec()).map(toRuntimeObject));
  }

  async findByReviewStatus(reviewStatus) {
    if (!REVIEW_STATUS.has(reviewStatus)) throw new RepositoryError('Invalid moderation status', {code: 'VALIDATION_ERROR', status: 422});
    return executeContentOperation(async () => (await this.model.find({reviewStatus, deletedAt: null}).sort({createdAt: -1}).lean().exec()).map(toRuntimeObject));
  }

  async findPublicBySlug(slug) {
    return executeContentOperation(async () => toRuntimeObject(await this.model.findOne({...PUBLIC_FILTER, slug: normalizeSlug(slug)}).lean().exec()));
  }

  async listPublic({page, limit, genreId, sort = 'latest'} = {}) {
    const filter = {...PUBLIC_FILTER};
    if (genreId !== undefined) filter.genreIds = toObjectId(genreId, 'genreId');
    const pagination = pageOptions({page, limit});
    const allowedSorts = {latest: {publishedAt: -1}, popular: {listenCount: -1}, rated: {ratingAverage: -1}};
    const order = allowedSorts[sort] || allowedSorts.latest;
    return executeContentOperation(async () => {
      const [documents, total] = await Promise.all([
        this.model.find(filter).sort(order).skip(pagination.skip).limit(pagination.limit).lean().exec(),
        this.model.countDocuments(filter),
      ]);
      return {items: documents.map(toRuntimeObject), pagination: {page: pagination.page, limit: pagination.limit, total}};
    });
  }

  async searchPublic(search, {page, limit, genreId, sort = 'latest'} = {}) {
    const keyword = String(search || '').trim();
    if (!keyword) throw new RepositoryError('Search keyword is required', {code: 'VALIDATION_ERROR', status: 422});
    const filter = {...PUBLIC_FILTER, $text: {$search: keyword}};
    if (genreId !== undefined) filter.genreIds = toObjectId(genreId, 'genreId');
    const pagination = pageOptions({page, limit});
    const order = sort === 'popular' ? {score: {$meta: 'textScore'}, listenCount: -1} : {score: {$meta: 'textScore'}};
    return executeContentOperation(async () => {
      const [documents, total] = await Promise.all([
        this.model.find(filter, {score: {$meta: 'textScore'}}).sort(order).skip(pagination.skip).limit(pagination.limit).lean().exec(),
        this.model.countDocuments(filter),
      ]);
      return {items: documents.map(toRuntimeObject), pagination: {page: pagination.page, limit: pagination.limit, total}};
    });
  }

  async createStory(input) {
    return executeContentOperation(async () => toRuntimeObject(await this.model.create(mapStoryCreateInput(input))), 'STORY_SLUG_EXISTS');
  }

  async updateEditable(id, input) {
    return this.#update(id, mapEditableStoryInput(input), 'STORY_SLUG_EXISTS');
  }

  async submitForModeration(id, submittedAt = new Date()) {
    return this.#update(id, {reviewStatus: 'PENDING_REVIEW', submittedAt, visibility: 'PRIVATE'});
  }

  async reviewModeration(id, {reviewStatus, reviewedBy, reviewedAt = new Date(), moderationNote = '', publishedAt = null, visibility}) {
    if (!REVIEW_STATUS.has(reviewStatus)) throw new RepositoryError('Invalid moderation status', {code: 'VALIDATION_ERROR', status: 422});
    const update = {reviewStatus, reviewedBy: toObjectId(reviewedBy, 'reviewedBy'), reviewedAt, moderationNote, publishedAt};
    if (visibility !== undefined) update.visibility = visibility;
    return this.#update(id, update);
  }

  async softDelete(id, deletedBy, deletedAt = new Date()) {
    return this.#update(id, {deletedAt, deletedBy: toObjectId(deletedBy, 'deletedBy')});
  }

  async restore(id) {
    return this.#update(id, {deletedAt: null, deletedBy: null});
  }

  async incrementChapterCount(id, amount = 1) { return this.#increment(id, 'chapterCount', amount); }
  async incrementViewCount(id, amount = 1) { return this.#increment(id, 'viewCount', amount); }
  async incrementListenCount(id, amount = 1) { return this.#increment(id, 'listenCount', amount); }
  async incrementFavoriteCount(id, amount = 1) { return this.#increment(id, 'favoriteCount', amount); }

  async setRatingAggregate(id, {ratingAverage, ratingCount}) {
    return this.#update(id, pickDefined({ratingAverage, ratingCount}, ['ratingAverage', 'ratingCount']));
  }

  async #increment(id, field, amount) {
    if (!Number.isFinite(amount)) throw new RepositoryError('Counter amount must be numeric', {code: 'VALIDATION_ERROR', status: 422});
    return executeContentOperation(async () => toRuntimeObject(await this.model.findByIdAndUpdate(
      toObjectId(id), {$inc: {[field]: amount}}, {returnDocument: 'after', runValidators: true}
    ).lean().exec()));
  }

  async #update(id, update, duplicateCode) {
    if (Object.keys(update).length === 0) throw new RepositoryError('Story update requires allowed fields', {code: 'EMPTY_UPDATE', status: 422});
    return executeContentOperation(async () => toRuntimeObject(await this.model.findByIdAndUpdate(
      toObjectId(id), {$set: update}, {returnDocument: 'after', runValidators: true}
    ).lean().exec()), duplicateCode);
  }
}

module.exports = {StoryMongoRepository, PUBLIC_FILTER, mapStoryCreateInput, mapEditableStoryInput};
