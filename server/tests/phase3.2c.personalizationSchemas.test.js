const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {LibraryItem, ListenHistory, Playlist} = require('../src/models');

function objectId() {
  return new mongoose.Types.ObjectId();
}

function indexFor(schema, keys) {
  return schema.indexes().find(([definition]) => JSON.stringify(definition) === JSON.stringify(keys));
}

async function validationError(document) {
  try {
    await document.validate();
    assert.fail('Expected schema validation to fail');
  } catch (error) {
    return error;
  }
}

test('LibraryItem unifies library, favorites, and follows without legacy type persistence', async () => {
  const item = new LibraryItem({userId: objectId(), storyId: objectId()});
  await item.validate();

  assert.equal(item.isFavorite, false);
  assert.equal(item.followed, false);
  assert.ok(item.addedAt instanceof Date);
  assert.ok(LibraryItem.schema.path('createdAt'));
  assert.ok(LibraryItem.schema.path('updatedAt'));
  assert.equal(LibraryItem.schema.path('type'), undefined);
  assert.deepEqual(indexFor(LibraryItem.schema, {userId: 1, storyId: 1})[1], {unique: true});
  assert.deepEqual(indexFor(LibraryItem.schema, {userId: 1, isFavorite: 1})[1], {});
  assert.deepEqual(indexFor(LibraryItem.schema, {userId: 1, followed: 1})[1], {});
});

test('ListenHistory is keyed by user and chapter, with range-safe resume values', async () => {
  const history = new ListenHistory({
    userId: objectId(),
    storyId: objectId(),
    chapterId: objectId(),
    audioId: objectId(),
  });
  await history.validate();

  assert.equal(history.positionSec, 0);
  assert.equal(history.durationSec, null);
  assert.equal(history.progressPercent, 0);
  assert.equal(history.completed, false);
  assert.ok(history.lastListenedAt instanceof Date);
  assert.ok((await validationError(new ListenHistory({...history.toObject(), positionSec: -1}))).errors.positionSec);
  assert.ok((await validationError(new ListenHistory({...history.toObject(), durationSec: -1}))).errors.durationSec);
  assert.ok((await validationError(new ListenHistory({...history.toObject(), progressPercent: 101}))).errors.progressPercent);
  assert.deepEqual(indexFor(ListenHistory.schema, {userId: 1, chapterId: 1})[1], {unique: true});
  assert.deepEqual(indexFor(ListenHistory.schema, {userId: 1, storyId: 1, lastListenedAt: -1})[1], {});
});

test('Playlist protects duplicate Story ObjectId values while preserving canonical fields', async () => {
  const firstStoryId = objectId();
  const playlist = new Playlist({userId: objectId(), name: '  My Playlist  ', storyIds: [firstStoryId]});
  await playlist.validate();

  assert.equal(playlist.name, 'My Playlist');
  assert.equal(playlist.description, '');
  assert.equal(playlist.visibility, 'PRIVATE');
  assert.deepEqual(playlist.storyIds.map(id => id.toString()), [firstStoryId.toString()]);
  assert.deepEqual(new Playlist({userId: objectId(), name: 'Empty'}).storyIds, []);
  assert.equal(Playlist.schema.path('playlistItems'), undefined);
  assert.deepEqual(indexFor(Playlist.schema, {userId: 1})[1], {});

  const duplicateId = new mongoose.Types.ObjectId(firstStoryId.toString());
  const duplicateError = await validationError(new Playlist({
    userId: objectId(), name: 'Duplicate', storyIds: [firstStoryId, duplicateId],
  }));
  assert.ok(duplicateError.errors.storyIds);
  assert.ok((await validationError(new Playlist({userId: objectId(), name: 'Hidden', visibility: 'UNLISTED'}))).errors.visibility);
});

test('personalization models compile without connecting to MongoDB or duplicate registration', () => {
  assert.equal(mongoose.connection.readyState, 0);
  assert.equal(mongoose.models.LibraryItem, LibraryItem);
  assert.equal(mongoose.models.ListenHistory, ListenHistory);
  assert.equal(mongoose.models.Playlist, Playlist);
});
