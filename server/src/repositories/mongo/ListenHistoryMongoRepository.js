const ListenHistory = require('../../models/ListenHistory');
const {MongooseRepository} = require('../base/MongooseRepository');
const {toObjectId} = require('../adapters/objectId');
const {pickDefined, toRuntimeObject} = require('../adapters/persistenceMappers');
const {RepositoryError} = require('../errors/mongoErrorMapper');
const {executePersonalizationOperation} = require('./personalizationRepositoryHelpers');

function validNumber(value, field, {nullable = false, max} = {}) {
  if (value === null && nullable) return null;
  if (!Number.isFinite(value) || value < 0 || (max !== undefined && value > max)) {
    throw new RepositoryError(`Invalid ${field}`, {code: 'PERSISTENCE_VALIDATION_ERROR', status: 422, details: {field}});
  }
  return value;
}

function trustedProgress(input) {
  const result = pickDefined(input, ['positionSec', 'durationSec', 'progressPercent', 'completed']);
  for (const field of ['userId', 'storyId', 'chapterId', 'audioId']) {
    if (input?.[field] !== undefined) result[field] = toObjectId(input[field], field);
  }
  if (result.positionSec !== undefined) result.positionSec = validNumber(result.positionSec, 'positionSec');
  if (result.durationSec !== undefined) result.durationSec = validNumber(result.durationSec, 'durationSec', {nullable: true});
  if (result.progressPercent !== undefined) result.progressPercent = validNumber(result.progressPercent, 'progressPercent', {max: 100});
  if (result.completed !== undefined) result.completed = Boolean(result.completed);
  if (input?.lastListenedAt !== undefined) {
    const date = new Date(input.lastListenedAt);
    if (Number.isNaN(date.valueOf())) throw new RepositoryError('Invalid lastListenedAt', {code: 'PERSISTENCE_VALIDATION_ERROR', status: 422});
    result.lastListenedAt = date;
  }
  return result;
}

class ListenHistoryMongoRepository extends MongooseRepository {
  constructor(model = ListenHistory) { super(model); }

  async findByUserAndChapter(userId, chapterId) {
    const filter = {userId: toObjectId(userId, 'userId'), chapterId: toObjectId(chapterId, 'chapterId')};
    return executePersonalizationOperation(async () => toRuntimeObject(await this.model.findOne(filter).lean().exec()));
  }

  async createHistory(input) {
    const progress = trustedProgress(input);
    for (const field of ['userId', 'storyId', 'chapterId', 'audioId']) if (!progress[field]) throw new RepositoryError(`${field} is required`, {code: 'PERSISTENCE_VALIDATION_ERROR', status: 422});
    if (progress.lastListenedAt === undefined) progress.lastListenedAt = new Date();
    return executePersonalizationOperation(async () => toRuntimeObject(await this.model.create(progress)), 'LISTEN_HISTORY_EXISTS');
  }

  async upsertProgress(input) {
    const progress = trustedProgress(input);
    for (const field of ['userId', 'storyId', 'chapterId', 'audioId']) if (!progress[field]) throw new RepositoryError(`${field} is required`, {code: 'PERSISTENCE_VALIDATION_ERROR', status: 422});
    const filter = {userId: progress.userId, chapterId: progress.chapterId};
    const update = pickDefined(progress, ['storyId', 'audioId', 'positionSec', 'durationSec', 'progressPercent', 'completed']);
    update.lastListenedAt = progress.lastListenedAt || new Date();
    return executePersonalizationOperation(async () => toRuntimeObject(await this.model.findOneAndUpdate(
      filter, {$set: update, $setOnInsert: {userId: progress.userId, chapterId: progress.chapterId}},
      {upsert: true, returnDocument: 'after', runValidators: true}
    ).lean().exec()), 'LISTEN_HISTORY_EXISTS');
  }

  async markCompleted(userId, chapterId, completed = true, lastListenedAt = new Date()) {
    const filter = {userId: toObjectId(userId, 'userId'), chapterId: toObjectId(chapterId, 'chapterId')};
    return executePersonalizationOperation(async () => toRuntimeObject(await this.model.findOneAndUpdate(
      filter, {$set: {completed: Boolean(completed), lastListenedAt: new Date(lastListenedAt)}}, {returnDocument: 'after', runValidators: true}
    ).lean().exec()));
  }

  async updateAudioVariant(userId, chapterId, audioId, progress = {}) {
    const normalized = trustedProgress({...progress, audioId});
    const filter = {userId: toObjectId(userId, 'userId'), chapterId: toObjectId(chapterId, 'chapterId')};
    const update = pickDefined(normalized, ['audioId', 'positionSec', 'durationSec', 'progressPercent', 'completed']);
    update.lastListenedAt = normalized.lastListenedAt || new Date();
    return executePersonalizationOperation(async () => toRuntimeObject(await this.model.findOneAndUpdate(
      filter, {$set: update}, {returnDocument: 'after', runValidators: true}
    ).lean().exec()));
  }

  async listContinueListening(userId) {
    const filter = {userId: toObjectId(userId, 'userId'), completed: false};
    return executePersonalizationOperation(async () => (await this.model.find(filter).sort({lastListenedAt: -1}).lean().exec()).map(toRuntimeObject));
  }

  async removeByUserAndChapter(userId, chapterId) {
    const filter = {userId: toObjectId(userId, 'userId'), chapterId: toObjectId(chapterId, 'chapterId')};
    return executePersonalizationOperation(async () => toRuntimeObject(await this.model.findOneAndDelete(filter).lean().exec()));
  }

  async removeByIdAndUser(id, userId) {
    const filter = {_id: toObjectId(id), userId: toObjectId(userId, 'userId')};
    return executePersonalizationOperation(async () => toRuntimeObject(await this.model.findOneAndDelete(filter).lean().exec()));
  }
}

module.exports = {ListenHistoryMongoRepository, trustedProgress};
