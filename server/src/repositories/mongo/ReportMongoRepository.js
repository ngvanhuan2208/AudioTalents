const Report = require('../../models/Report');
const {MongooseRepository} = require('../base/MongooseRepository');
const {toObjectId} = require('../adapters/objectId');
const {toRuntimeObject, mapReportRuntimeToPersistence} = require('../adapters/persistenceMappers');
const {RepositoryError} = require('../errors/mongoErrorMapper');
const {executeCommunityOperation, requireEnum} = require('./communityRepositoryHelpers');

const TARGET_TYPES = new Set(['STORY', 'CHAPTER', 'AUDIO', 'COMMENT', 'USER']);
const REPORT_TYPES = new Set(['AUDIO_BROKEN', 'AUDIO_NOISE', 'MISSING_CONTENT', 'DUPLICATE_CHAPTER', 'WRONG_CONTENT', 'COPYRIGHT', 'ABUSE', 'OTHER']);
const REPORT_STATUSES = new Set(['OPEN', 'REVIEWING', 'RESOLVED', 'REJECTED']);

function trustedReport(input) {
  const mapped = mapReportRuntimeToPersistence(input);
  const result = {
    reporterId: toObjectId(mapped.reporterId, 'reporterId'),
    targetType: requireEnum(mapped.targetType, TARGET_TYPES, 'targetType'),
    targetId: toObjectId(mapped.targetId, 'targetId'),
    reportType: requireEnum(mapped.reportType, REPORT_TYPES, 'reportType'),
  };
  if (mapped.description !== undefined) {
    if (typeof mapped.description !== 'string') throw new RepositoryError('description must be a string', {code: 'PERSISTENCE_VALIDATION_ERROR', status: 422});
    result.description = mapped.description;
  }
  return result;
}

function trustedReview(reviewerId, resolutionNote, reviewedAt) {
  const update = {reviewedBy: toObjectId(reviewerId, 'reviewedBy'), reviewedAt: new Date(reviewedAt)};
  if (Number.isNaN(update.reviewedAt.valueOf())) throw new RepositoryError('Invalid reviewedAt', {code: 'PERSISTENCE_VALIDATION_ERROR', status: 422});
  if (resolutionNote !== undefined) {
    if (resolutionNote !== null && typeof resolutionNote !== 'string') throw new RepositoryError('resolutionNote must be a string or null', {code: 'PERSISTENCE_VALIDATION_ERROR', status: 422});
    update.resolutionNote = resolutionNote;
  }
  return update;
}

class ReportMongoRepository extends MongooseRepository {
  constructor(model = Report) { super(model); }

  async findById(id) {
    return executeCommunityOperation(async () => toRuntimeObject(await this.model.findById(toObjectId(id)).lean().exec()));
  }

  async listByStatus(status) {
    return this.#list({status: requireEnum(status, REPORT_STATUSES, 'status')});
  }

  async listForAdmin({status} = {}) {
    return this.#list(status === undefined ? {} : {status: requireEnum(status, REPORT_STATUSES, 'status')});
  }

  async listByTarget(targetType, targetId) {
    return this.#list({targetType: requireEnum(targetType, TARGET_TYPES, 'targetType'), targetId: toObjectId(targetId, 'targetId')});
  }

  async createReport(input) {
    return executeCommunityOperation(async () => toRuntimeObject(await this.model.create(trustedReport(input))));
  }

  async setReviewing(id, reviewerId, reviewedAt = new Date()) {
    return this.#review(id, 'REVIEWING', reviewerId, undefined, reviewedAt);
  }

  async resolve(id, reviewerId, resolutionNote, reviewedAt = new Date()) {
    return this.#review(id, 'RESOLVED', reviewerId, resolutionNote, reviewedAt);
  }

  async reject(id, reviewerId, resolutionNote, reviewedAt = new Date()) {
    return this.#review(id, 'REJECTED', reviewerId, resolutionNote, reviewedAt);
  }

  async #list(filter) {
    return executeCommunityOperation(async () => (await this.model.find(filter).sort({createdAt: -1}).lean().exec()).map(toRuntimeObject));
  }

  async #review(id, status, reviewerId, resolutionNote, reviewedAt) {
    const update = {status, ...trustedReview(reviewerId, resolutionNote, reviewedAt)};
    return executeCommunityOperation(async () => toRuntimeObject(await this.model.findByIdAndUpdate(
      toObjectId(id), {$set: update}, {returnDocument: 'after', runValidators: true}
    ).lean().exec()));
  }
}

module.exports = {ReportMongoRepository, trustedReport, TARGET_TYPES, REPORT_TYPES, REPORT_STATUSES};
