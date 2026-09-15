const LibraryItem = require('../../models/LibraryItem');
const {MongooseRepository} = require('../base/MongooseRepository');
const {toObjectId} = require('../adapters/objectId');
const {pickDefined, toRuntimeObject, mapLibraryRuntimeToPersistence} = require('../adapters/persistenceMappers');
const {RepositoryError} = require('../errors/mongoErrorMapper');
const {executePersonalizationOperation} = require('./personalizationRepositoryHelpers');

function trustedLibraryState(input) {
  const state = input?.type === undefined
    ? pickDefined(input, ['userId', 'storyId', 'isFavorite', 'followed', 'addedAt'])
    : mapLibraryRuntimeToPersistence(input);
  state.userId = toObjectId(state.userId, 'userId');
  state.storyId = toObjectId(state.storyId, 'storyId');
  if (state.isFavorite !== undefined) state.isFavorite = Boolean(state.isFavorite);
  if (state.followed !== undefined) state.followed = Boolean(state.followed);
  return state;
}

class LibraryItemMongoRepository extends MongooseRepository {
  constructor(model = LibraryItem) { super(model); }

  async findByUserAndStory(userId, storyId) {
    const filter = {userId: toObjectId(userId, 'userId'), storyId: toObjectId(storyId, 'storyId')};
    return executePersonalizationOperation(async () => toRuntimeObject(await this.model.findOne(filter).lean().exec()));
  }

  async listByUser(userId) { return this.#list({userId: toObjectId(userId, 'userId')}); }
  async listFavoritesByUser(userId) { return this.#list({userId: toObjectId(userId, 'userId'), isFavorite: true}); }
  async listFollowedByUser(userId) { return this.#list({userId: toObjectId(userId, 'userId'), followed: true}); }

  async createLibraryItem(input) {
    const state = trustedLibraryState(input);
    return executePersonalizationOperation(async () => toRuntimeObject(await this.model.create(state)), 'LIBRARY_ITEM_EXISTS');
  }

  async upsertState(input) {
    const state = trustedLibraryState(input);
    const filter = {userId: state.userId, storyId: state.storyId};
    const mutable = pickDefined(state, ['isFavorite', 'followed']);
    if (Object.keys(mutable).length === 0) throw new RepositoryError('Library state requires favorite or follow state', {code: 'EMPTY_UPDATE', status: 422});
    const addedAt = state.addedAt || new Date();
    return executePersonalizationOperation(async () => toRuntimeObject(await this.model.findOneAndUpdate(
      filter,
      {$set: mutable, $setOnInsert: {addedAt}},
      {upsert: true, returnDocument: 'after', runValidators: true}
    ).lean().exec()), 'LIBRARY_ITEM_EXISTS');
  }

  // This conditional primitive tells the future service whether a counter
  // transition occurred; it never changes Story.favoriteCount itself.
  async transitionFavorite(userId, storyId, isFavorite) {
    const filter = {userId: toObjectId(userId, 'userId'), storyId: toObjectId(storyId, 'storyId'), isFavorite: {$ne: Boolean(isFavorite)}};
    return executePersonalizationOperation(async () => {
      const previous = toRuntimeObject(await this.model.findOneAndUpdate(
        filter, {$set: {isFavorite: Boolean(isFavorite)}}, {returnDocument: 'before', runValidators: true}
      ).lean().exec());
      return {changed: Boolean(previous), previous, isFavorite: Boolean(isFavorite)};
    });
  }

  async setFavorite(userId, storyId, isFavorite) { return this.transitionFavorite(userId, storyId, isFavorite); }

  async setFollowed(userId, storyId, followed) {
    const filter = {userId: toObjectId(userId, 'userId'), storyId: toObjectId(storyId, 'storyId')};
    return executePersonalizationOperation(async () => toRuntimeObject(await this.model.findOneAndUpdate(
      filter, {$set: {followed: Boolean(followed)}}, {returnDocument: 'after', runValidators: true}
    ).lean().exec()));
  }

  async removeIfEmpty(userId, storyId) {
    const filter = {userId: toObjectId(userId, 'userId'), storyId: toObjectId(storyId, 'storyId'), isFavorite: false, followed: false};
    return executePersonalizationOperation(async () => toRuntimeObject(await this.model.findOneAndDelete(filter).lean().exec()));
  }

  async #list(filter) {
    return executePersonalizationOperation(async () => (await this.model.find(filter).sort({addedAt: -1}).lean().exec()).map(toRuntimeObject));
  }
}

module.exports = {LibraryItemMongoRepository, trustedLibraryState};
