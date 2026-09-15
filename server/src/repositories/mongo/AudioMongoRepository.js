const Audio = require('../../models/Audio');
const {MongooseRepository} = require('../base/MongooseRepository');
const {toObjectId} = require('../adapters/objectId');
const {pickDefined, toRuntimeObject, mapAudioRuntimeToPersistence, mapAudioModerationStatus, mapAudioProcessingStatus} = require('../adapters/persistenceMappers');
const {serializeTranscript, safeParseTranscript} = require('../adapters/transcript');
const {RepositoryError} = require('../errors/mongoErrorMapper');
const {executeContentOperation} = require('./contentRepositoryHelpers');

const PUBLIC_FILTER = Object.freeze({status: 'APPROVED', processingStatus: 'READY', deletedAt: null});
const DEFAULT_PLAYBACK_FILTER = Object.freeze({...PUBLIC_FILTER, isPrimary: true});
const MODERATION_STATUS = new Set(['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED']);
const UPLOADABLE_MODERATION_STATUS = new Set(['DRAFT', 'REJECTED', 'REVISION_REQUIRED']);

function toAudioRuntime(document) {
  const runtime = toRuntimeObject(document);
  if (runtime) runtime.transcript = safeParseTranscript(runtime.transcript);
  return runtime;
}

function mapAudioCreateInput(input) {
  const persistence = mapAudioRuntimeToPersistence(input);
  if (input?.id !== undefined) persistence._id = toObjectId(input.id, 'id');
  persistence.storyId = toObjectId(input?.storyId, 'storyId');
  persistence.chapterId = toObjectId(input?.chapterId, 'chapterId');
  persistence.creatorId = toObjectId(input?.creatorId, 'creatorId');
  return persistence;
}

function mapAudioMetadataInput(input) {
  const update = pickDefined(input, ['title', 'audioUrl', 'storageKey', 'durationSec', 'fileSize', 'mimeType', 'bitrate', 'voiceType']);
  if (input?.sourceType !== undefined) update.sourceType = input.sourceType;
  if (input?.transcript !== undefined) update.transcript = serializeTranscript(input.transcript);
  return update;
}

class AudioMongoRepository extends MongooseRepository {
  constructor(model = Audio) { super(model); }

  async findById(id, {includeDeleted = false} = {}) {
    const filter = {_id: toObjectId(id)};
    if (!includeDeleted) filter.deletedAt = null;
    return executeContentOperation(async () => toAudioRuntime(await this.model.findOne(filter).lean().exec()));
  }

  async findByChapter(chapterId, {includeDeleted = false} = {}) {
    const filter = {chapterId: toObjectId(chapterId, 'chapterId')};
    if (!includeDeleted) filter.deletedAt = null;
    return executeContentOperation(async () => (await this.model.find(filter).sort({partNumber: 1}).lean().exec()).map(toAudioRuntime));
  }

  async findMaxPartNumberByChapter(chapterId) {
    return executeContentOperation(async () => {
      const row = await this.model.findOne({chapterId: toObjectId(chapterId, 'chapterId'), partNumber: {$type: 'number'}})
        .sort({partNumber: -1}).select({partNumber: 1}).lean().exec();
      return Number.isInteger(row?.partNumber) ? row.partNumber : 0;
    });
  }

  async findDeletedByChapter(chapterId) {
    return executeContentOperation(async () => (await this.model.find({
      chapterId: toObjectId(chapterId, 'chapterId'),
      deletedAt: {$ne: null, $exists: true},
    }).sort({partNumber: 1}).lean().exec()).map(toAudioRuntime));
  }

  async findByStorageKey(storageKey, {includeDeleted = true} = {}) {
    if (typeof storageKey !== 'string' || !storageKey) throw new RepositoryError('storageKey is required', {code: 'VALIDATION_ERROR', status: 422});
    const filter = {storageKey};
    if (!includeDeleted) filter.deletedAt = null;
    return executeContentOperation(async () => (await this.model.find(filter).lean().exec()).map(toAudioRuntime));
  }

  async findByModerationStatus(status) {
    if (!MODERATION_STATUS.has(status)) throw new RepositoryError('Invalid audio moderation status', {code: 'INVALID_AUDIO_MODERATION_STATUS', status: 422});
    return executeContentOperation(async () => (await this.model.find({status, deletedAt: null}).sort({createdAt: -1}).lean().exec()).map(toAudioRuntime));
  }

  async findPublicVoicesForChapter(chapterId) {
    return executeContentOperation(async () => (await this.model.find({...PUBLIC_FILTER, chapterId: toObjectId(chapterId, 'chapterId')})
      .sort({partNumber: 1}).lean().exec()).map(toAudioRuntime));
  }

  async findPrimaryByChapter(chapterId, {includeDeleted = false} = {}) {
    const filter = {chapterId: toObjectId(chapterId, 'chapterId'), isPrimary: true};
    if (!includeDeleted) filter.deletedAt = null;
    return executeContentOperation(async () => toAudioRuntime(await this.model.findOne(filter).lean().exec()));
  }

  async findDefaultPlaybackForChapter(chapterId) {
    return executeContentOperation(async () => toAudioRuntime(await this.model.findOne({
      ...DEFAULT_PLAYBACK_FILTER, chapterId: toObjectId(chapterId, 'chapterId'),
    }).lean().exec()));
  }

  async createAudio(input) {
    return executeContentOperation(async () => toAudioRuntime(await this.model.create(mapAudioCreateInput(input))), 'AUDIO_PART_CONFLICT');
  }

  async updateMetadata(id, input) {
    return this.#update(id, mapAudioMetadataInput(input));
  }

  async updateProcessing(id, processingStatus) {
    const normalized = mapAudioProcessingStatus(processingStatus);
    if (normalized === undefined) throw new RepositoryError('Audio processing status is required', {code: 'VALIDATION_ERROR', status: 422});
    return this.#update(id, {processingStatus: normalized});
  }

  async commitMediaUpload(id, snapshot, media) {
    const allowedStatuses = Array.isArray(snapshot?.allowedStatuses) ? snapshot.allowedStatuses.filter(status => UPLOADABLE_MODERATION_STATUS.has(status)) : [];
    if (allowedStatuses.length === 0 || !['PENDING', 'READY'].includes(snapshot?.expectedProcessingStatus) || !(snapshot.expectedStorageKey === null || typeof snapshot.expectedStorageKey === 'string') || !snapshot.expectedUpdatedAt) {
      throw new RepositoryError('Invalid media upload snapshot', {code: 'VALIDATION_ERROR', status: 422});
    }
    const trusted = pickDefined(media, ['storageKey', 'audioUrl', 'fileSize', 'mimeType', 'durationSec', 'bitrate', 'processingStatus']);
    if (trusted.processingStatus !== 'READY' || Object.keys(trusted).length !== 7) throw new RepositoryError('Invalid media upload result', {code: 'VALIDATION_ERROR', status: 422});
    const filter = {
      _id: toObjectId(id), deletedAt: null, storageKey: snapshot.expectedStorageKey,
      processingStatus: snapshot.expectedProcessingStatus, updatedAt: new Date(snapshot.expectedUpdatedAt),
      status: {$in: allowedStatuses},
    };
    return executeContentOperation(async () => toAudioRuntime(await this.model.findOneAndUpdate(
      filter, {$set: trusted}, {returnDocument: 'after', runValidators: true}
    ).lean().exec()));
  }

  async submitForModeration(id) {
    return this.#update(id, {status: 'PENDING_REVIEW'});
  }

  async reviewModeration(id, status) {
    return this.#update(id, {status: mapAudioModerationStatus(status)});
  }

  async unsetPrimaryForChapter(chapterId) {
    return executeContentOperation(() => this.model.updateMany(
      {chapterId: toObjectId(chapterId, 'chapterId'), isPrimary: true, deletedAt: null}, {$set: {isPrimary: false}}
    ));
  }

  async setPrimary(audioId) {
    return this.#update(audioId, {isPrimary: true}, 'PRIMARY_AUDIO_CONFLICT');
  }

  async softDelete(id, deletedBy, deletedAt = new Date()) {
    return this.#update(id, {deletedAt, deletedBy: toObjectId(deletedBy, 'deletedBy')});
  }

  async restore(id) {
    return this.#update(id, {deletedAt: null, deletedBy: null, isPrimary: false});
  }

  async restoreWithinRetention(id, retentionCutoff) {
    const cutoff = new Date(retentionCutoff);
    if (Number.isNaN(cutoff.getTime())) throw new RepositoryError('Invalid restore retention cutoff', {code: 'VALIDATION_ERROR', status: 422});
    return executeContentOperation(async () => toAudioRuntime(await this.model.findOneAndUpdate(
      {_id: toObjectId(id), deletedAt: {$gt: cutoff}},
      {$set: {deletedAt: null, deletedBy: null, isPrimary: false}},
      {returnDocument: 'after', runValidators: true}
    ).lean().exec()), 'AUDIO_PART_CONFLICT');
  }

  async #update(id, update, duplicateCode) {
    if (Object.keys(update).length === 0) throw new RepositoryError('Audio update requires allowed fields', {code: 'EMPTY_UPDATE', status: 422});
    return executeContentOperation(async () => toAudioRuntime(await this.model.findByIdAndUpdate(
      toObjectId(id), {$set: update}, {returnDocument: 'after', runValidators: true}
    ).lean().exec()), duplicateCode);
  }
}

module.exports = {AudioMongoRepository, PUBLIC_FILTER, DEFAULT_PLAYBACK_FILTER, mapAudioCreateInput, mapAudioMetadataInput, toAudioRuntime};
