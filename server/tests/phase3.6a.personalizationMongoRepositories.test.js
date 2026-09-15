const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {
  LibraryItemMongoRepository,
  ListenHistoryMongoRepository,
  PlaylistMongoRepository,
  getContentRepositories,
} = require('../src/repositories');
const {trustedLibraryState} = require('../src/repositories/mongo/LibraryItemMongoRepository');
const {trustedProgress} = require('../src/repositories/mongo/ListenHistoryMongoRepository');
const {trustedPlaylist} = require('../src/repositories/mongo/PlaylistMongoRepository');

function objectId() { return new mongoose.Types.ObjectId(); }
function query(value, captures = {}) {
  return {
    sort(sort) { captures.sort = sort; return this; },
    lean() { return {exec: async () => value}; },
  };
}

test('LibraryItemMongoRepository persists canonical aggregate state and exposes safe transitions', async () => {
  const userId = objectId();
  const storyId = objectId();
  const itemId = objectId();
  const captures = {};
  const model = {
    findOne(filter) { captures.findOne = filter; return query({_id: itemId, ...filter}, captures); },
    find(filter) { captures.find = filter; return query([], captures); },
    async create(input) { captures.create = input; return {_id: itemId, ...input}; },
    findOneAndUpdate(filter, update, options) { captures.update = {filter, update, options}; return query({_id: itemId, userId, storyId, ...update.$set}, captures); },
    findOneAndDelete(filter) { captures.delete = filter; return query({_id: itemId, ...filter}, captures); },
  };
  const repository = new LibraryItemMongoRepository(model);
  await repository.createLibraryItem({userId, storyId, type: 'FAVORITE', ignored: 'no'});
  assert.equal(captures.create.isFavorite, true);
  assert.equal(captures.create.followed, false);
  assert.equal(captures.create.type, undefined);
  await repository.findByUserAndStory(userId, storyId);
  assert.deepEqual(captures.findOne, {userId, storyId});
  await repository.listFavoritesByUser(userId);
  assert.deepEqual(captures.find, {userId, isFavorite: true});
  await repository.listFollowedByUser(userId);
  assert.deepEqual(captures.find, {userId, followed: true});
  await repository.upsertState({userId, storyId, isFavorite: false, followed: true, userSupplied: 'ignored'});
  assert.deepEqual(captures.update.filter, {userId, storyId});
  assert.deepEqual(captures.update.update.$set, {isFavorite: false, followed: true});
  assert.ok(captures.update.update.$setOnInsert.addedAt instanceof Date);
  const transition = await repository.setFavorite(userId, storyId, true);
  assert.equal(transition.changed, true);
  assert.deepEqual(captures.update.filter, {userId, storyId, isFavorite: {$ne: true}});
  assert.deepEqual(captures.update.update, {$set: {isFavorite: true}});
  await repository.removeIfEmpty(userId, storyId);
  assert.deepEqual(captures.delete, {userId, storyId, isFavorite: false, followed: false});
  assert.throws(() => trustedLibraryState({userId, storyId, type: 'PROGRESS'}), error => error.code === 'UNMAPPABLE_LEGACY_LIBRARY_RECORD');

  const duplicate = new LibraryItemMongoRepository({async create() { throw {code: 11000}; }});
  await assert.rejects(() => duplicate.createLibraryItem({userId, storyId, isFavorite: true}), error => error.code === 'LIBRARY_ITEM_EXISTS');
});

test('ListenHistoryMongoRepository is unique per user and chapter, validates progress, and updates voice in place', async () => {
  const userId = objectId();
  const storyId = objectId();
  const chapterId = objectId();
  const audioId = objectId();
  const nextAudioId = objectId();
  const historyId = objectId();
  const captures = {};
  const model = {
    findOne(filter) { captures.findOne = filter; return query({_id: historyId, ...filter}, captures); },
    find(filter) { captures.find = filter; return query([], captures); },
    findOneAndUpdate(filter, update, options) { captures.update = {filter, update, options}; return query({_id: historyId, ...filter, ...update.$set}, captures); },
    findOneAndDelete(filter) { captures.delete = filter; return query({_id: historyId, ...filter}, captures); },
  };
  const repository = new ListenHistoryMongoRepository(model);
  await repository.upsertProgress({userId, storyId, chapterId, audioId, positionSec: 12, durationSec: null, progressPercent: 25, completed: false});
  assert.deepEqual(captures.update.filter, {userId, chapterId});
  assert.equal(captures.update.update.$set.storyId.toString(), storyId.toString());
  assert.equal(captures.update.update.$set.audioId.toString(), audioId.toString());
  assert.equal(captures.update.update.$setOnInsert.userId.toString(), userId.toString());
  assert.equal(captures.update.update.$setOnInsert.chapterId.toString(), chapterId.toString());
  await repository.updateAudioVariant(userId, chapterId, nextAudioId, {positionSec: 20, durationSec: 80, progressPercent: 25});
  assert.deepEqual(captures.update.filter, {userId, chapterId});
  assert.equal(captures.update.update.$set.audioId.toString(), nextAudioId.toString());
  await repository.listContinueListening(userId);
  assert.deepEqual(captures.find, {userId, completed: false});
  assert.deepEqual(captures.sort, {lastListenedAt: -1});
  await repository.markCompleted(userId, chapterId);
  assert.deepEqual(captures.update.update.$set.completed, true);
  await repository.removeByUserAndChapter(userId, chapterId);
  assert.deepEqual(captures.delete, {userId, chapterId});
  for (const invalid of [{positionSec: -1}, {durationSec: -1}, {progressPercent: 101}]) {
    assert.throws(() => trustedProgress(invalid), error => error.code === 'PERSISTENCE_VALIDATION_ERROR');
  }
  assert.throws(() => trustedProgress({audioId: 'not-an-id'}), error => error.code === 'INVALID_ID');
});

test('PlaylistMongoRepository keeps embedded unique story IDs and uses atomic add/remove primitives', async () => {
  const userId = objectId();
  const playlistId = objectId();
  const storyId = objectId();
  const captures = {};
  const model = {
    findById(id) { captures.findById = id; return query({_id: playlistId, userId, name: 'List', storyIds: []}, captures); },
    findOne(filter) { captures.findOne = filter; return query({_id: playlistId, ...filter}, captures); },
    find(filter) { captures.find = filter; return query([], captures); },
    async create(input) { captures.create = input; return {_id: playlistId, ...input}; },
    findByIdAndUpdate(id, update, options) { captures.update = {id, update, options}; return query({_id: playlistId, ...update.$set, storyIds: update.$addToSet ? [update.$addToSet.storyIds] : []}, captures); },
    findByIdAndDelete(id) { captures.delete = id; return query({_id: playlistId}, captures); },
  };
  const repository = new PlaylistMongoRepository(model);
  await repository.createPlaylist({userId, name: '  My List  ', description: 'Desc', visibility: 'PUBLIC', storyIds: [storyId], ignored: true});
  assert.equal(captures.create.name, '  My List  ');
  assert.equal(captures.create.visibility, 'PUBLIC');
  assert.equal(captures.create.ignored, undefined);
  await repository.listByOwner(userId);
  assert.deepEqual(captures.find, {userId});
  await repository.findPublicById(playlistId);
  assert.deepEqual(captures.findOne, {_id: playlistId, visibility: 'PUBLIC'});
  await repository.addStory(playlistId, storyId);
  assert.deepEqual(captures.update.update, {$addToSet: {storyIds: storyId}});
  await repository.removeStory(playlistId, storyId);
  assert.deepEqual(captures.update.update, {$pull: {storyIds: storyId}});
  await repository.setVisibility(playlistId, 'PRIVATE');
  assert.deepEqual(captures.update.update, {$set: {visibility: 'PRIVATE'}});
  await repository.deleteById(playlistId);
  assert.equal(captures.delete.toString(), playlistId.toString());
  assert.throws(() => trustedPlaylist({userId, name: 'x', storyIds: [storyId, storyId]}), error => error.code === 'PERSISTENCE_VALIDATION_ERROR');
  assert.throws(() => trustedPlaylist({userId, name: 'x', visibility: 'UNLISTED'}), error => error.code === 'PERSISTENCE_VALIDATION_ERROR');
});

test('Personalization Mongo repositories are exported without changing the active Personalization runtime', () => {
  assert.equal(getContentRepositories().runtime, 'MONGO');
  assert.equal(require('../src/repositories/libraryRepository').libraryRepository.constructor.name, 'LibraryRepository');
  assert.equal(require('../src/repositories/playlistRepository').playlistRepository.constructor.name, 'PlaylistRepository');
  assert.equal(require('../src/models').PlaylistItem, undefined);
});
