const Playlist = require('../../models/Playlist');
const {MongooseRepository} = require('../base/MongooseRepository');
const {toObjectId} = require('../adapters/objectId');
const {pickDefined, toRuntimeObject} = require('../adapters/persistenceMappers');
const {RepositoryError} = require('../errors/mongoErrorMapper');
const {executePersonalizationOperation} = require('./personalizationRepositoryHelpers');

const VISIBILITY = new Set(['PRIVATE', 'PUBLIC']);

function trustedPlaylist(input) {
  const result = pickDefined(input, ['name', 'description']);
  if (input?.userId !== undefined) result.userId = toObjectId(input.userId, 'userId');
  if (input?.visibility !== undefined) {
    if (!VISIBILITY.has(input.visibility)) throw new RepositoryError('Invalid playlist visibility', {code: 'PERSISTENCE_VALIDATION_ERROR', status: 422});
    result.visibility = input.visibility;
  }
  if (input?.storyIds !== undefined) {
    if (!Array.isArray(input.storyIds)) throw new RepositoryError('storyIds must be an array', {code: 'PERSISTENCE_VALIDATION_ERROR', status: 422});
    result.storyIds = input.storyIds.map(id => toObjectId(id, 'storyId'));
    if (new Set(result.storyIds.map(String)).size !== result.storyIds.length) throw new RepositoryError('storyIds must not contain duplicates', {code: 'PERSISTENCE_VALIDATION_ERROR', status: 422});
  }
  return result;
}

class PlaylistMongoRepository extends MongooseRepository {
  constructor(model = Playlist) { super(model); }

  async findById(id) { return executePersonalizationOperation(async () => toRuntimeObject(await this.model.findById(toObjectId(id)).lean().exec())); }
  async listByOwner(userId) { return this.#list({userId: toObjectId(userId, 'userId')}); }
  async findPublicById(id) { return executePersonalizationOperation(async () => toRuntimeObject(await this.model.findOne({_id: toObjectId(id), visibility: 'PUBLIC'}).lean().exec())); }

  async createPlaylist(input) {
    const playlist = trustedPlaylist(input);
    if (!playlist.userId || !playlist.name) throw new RepositoryError('userId and name are required', {code: 'PERSISTENCE_VALIDATION_ERROR', status: 422});
    if (playlist.storyIds === undefined) playlist.storyIds = [];
    return executePersonalizationOperation(async () => toRuntimeObject(await this.model.create(playlist)));
  }

  async updateMetadata(id, input) {
    const update = pickDefined(trustedPlaylist(input), ['name', 'description']);
    return this.#update(id, update);
  }

  async setVisibility(id, visibility) { return this.#update(id, trustedPlaylist({visibility})); }

  async addStory(id, storyId) {
    return executePersonalizationOperation(async () => toRuntimeObject(await this.model.findByIdAndUpdate(
      toObjectId(id), {$addToSet: {storyIds: toObjectId(storyId, 'storyId')}}, {returnDocument: 'after', runValidators: true}
    ).lean().exec()));
  }

  async removeStory(id, storyId) {
    return executePersonalizationOperation(async () => toRuntimeObject(await this.model.findByIdAndUpdate(
      toObjectId(id), {$pull: {storyIds: toObjectId(storyId, 'storyId')}}, {returnDocument: 'after', runValidators: true}
    ).lean().exec()));
  }

  async deleteById(id) { return executePersonalizationOperation(async () => toRuntimeObject(await this.model.findByIdAndDelete(toObjectId(id)).lean().exec())); }

  async #list(filter) { return executePersonalizationOperation(async () => (await this.model.find(filter).sort({createdAt: -1}).lean().exec()).map(toRuntimeObject)); }
  async #update(id, update) {
    if (Object.keys(update).length === 0) throw new RepositoryError('Playlist update requires allowed fields', {code: 'EMPTY_UPDATE', status: 422});
    return executePersonalizationOperation(async () => toRuntimeObject(await this.model.findByIdAndUpdate(
      toObjectId(id), {$set: update}, {returnDocument: 'after', runValidators: true}
    ).lean().exec()));
  }
}

module.exports = {PlaylistMongoRepository, trustedPlaylist};
