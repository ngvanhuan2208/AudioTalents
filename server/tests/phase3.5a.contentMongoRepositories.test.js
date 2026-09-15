const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {
  GenreMongoRepository,
  StoryMongoRepository,
  ChapterMongoRepository,
  AudioMongoRepository,
  mapAudioRuntimeToPersistence,
  getIdentityRepositories,
  UserMongoRepository,
} = require('../src/repositories');

function objectId() { return new mongoose.Types.ObjectId(); }

function queryResult(value, capture = {}) {
  return {
    sort(sort) { capture.sort = sort; return this; },
    skip(skip) { capture.skip = skip; return this; },
    limit(limit) { capture.limit = limit; return this; },
    select(select) { capture.select = select; return this; },
    lean() { return {exec: async () => value}; },
  };
}

test('Audio compatibility mapping preserves namespaces and rejects arbitrary status values', () => {
  for (const status of ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED']) {
    assert.equal(mapAudioRuntimeToPersistence({status}).status, status);
  }
  const missingStatus = mapAudioRuntimeToPersistence({title: 'Voice'});
  assert.equal(missingStatus.status, undefined);
  assert.equal(missingStatus.processingStatus, undefined);

  const legacyUploading = mapAudioRuntimeToPersistence({status: 'UPLOADING'});
  assert.equal(legacyUploading.status, undefined);
  assert.equal(legacyUploading.processingStatus, 'PENDING');

  for (const status of ['ABC', 'READY', 'PUBLISHED', 'UNKNOWN']) {
    assert.throws(() => mapAudioRuntimeToPersistence({status}), error => error.code === 'INVALID_AUDIO_MODERATION_STATUS');
  }
  for (const processingStatus of ['PENDING', 'PROCESSING', 'READY', 'FAILED']) {
    const mapped = mapAudioRuntimeToPersistence({status: 'APPROVED', processingStatus});
    assert.equal(mapped.status, 'APPROVED');
    assert.equal(mapped.processingStatus, processingStatus);
  }
  assert.throws(
    () => mapAudioRuntimeToPersistence({processingStatus: 'UNKNOWN'}),
    error => error.code === 'INVALID_AUDIO_PROCESSING_STATUS'
  );
});

test('GenreMongoRepository normalizes slugs, limits writes, and maps duplicate conflicts', async () => {
  const genreId = objectId();
  const captures = {};
  const fakeModel = {
    findOne(filter) { captures.lookup = filter; return queryResult({_id: genreId, ...filter}, captures); },
    find(filter) { captures.list = filter; return queryResult([], captures); },
    async create(input) { captures.create = input; return {_id: genreId, ...input}; },
    findByIdAndUpdate(id, update, options) { captures.update = {id, update, options}; return queryResult({_id: genreId, ...update.$set}); },
  };
  const repository = new GenreMongoRepository(fakeModel);
  await repository.findBySlug('  Fantasy-Voice ');
  assert.deepEqual(captures.lookup, {slug: 'fantasy-voice'});
  await repository.listActive();
  assert.deepEqual(captures.list, {isActive: true});
  assert.deepEqual(captures.sort, {sortOrder: 1, name: 1});
  await repository.createGenre({name: 'Fantasy', slug: ' FANTASY ', ignored: 'no'});
  assert.equal(captures.create.slug, 'fantasy');
  assert.equal(captures.create.ignored, undefined);
  await repository.setActive(genreId, false);
  assert.deepEqual(captures.update.update, {$set: {isActive: false}});

  const duplicateRepository = new GenreMongoRepository({async create() { throw {code: 11000}; }});
  await assert.rejects(() => duplicateRepository.createGenre({name: 'Fantasy', slug: 'fantasy'}), error => error.code === 'GENRE_SLUG_EXISTS');
});

test('StoryMongoRepository preserves progress/moderation namespaces and public/query safety', async () => {
  const storyId = objectId();
  const creatorId = objectId();
  const genreId = objectId();
  const captures = {};
  const fakeModel = {
    async create(input) { captures.create = input; return {_id: storyId, ...input}; },
    findOne(filter) { captures.findOne = filter; return queryResult({_id: storyId, ...filter}, captures); },
    find(filter, projection) { captures.find = {filter, projection}; return queryResult([{_id: storyId, ...filter}], captures); },
    countDocuments(filter) { captures.count = filter; return Promise.resolve(1); },
    findByIdAndUpdate(id, update, options) { captures.update = {id, update, options}; return queryResult({_id: storyId, ...update.$set}, captures); },
  };
  const repository = new StoryMongoRepository(fakeModel);
  const created = await repository.createStory({creatorId, title: 'Story', slug: 'story', description: 'Description', genres: [genreId], status: 'DRAFT', reviewStatus: 'DRAFT', visibility: 'PRIVATE', maliciousCounter: 999});
  assert.equal(created.id, storyId.toString());
  assert.equal(captures.create.creatorId.toString(), creatorId.toString());
  assert.equal(captures.create.genreIds[0].toString(), genreId.toString());
  assert.equal(captures.create.status, 'ONGOING');
  assert.equal(captures.create.reviewStatus, 'DRAFT');
  assert.equal(captures.create.maliciousCounter, undefined);
  await repository.findPublicBySlug(' STORY ');
  assert.deepEqual(captures.findOne, {reviewStatus: 'APPROVED', visibility: 'PUBLIC', deletedAt: null, slug: 'story'});
  const listed = await repository.listPublic({page: 2, limit: 10, sort: 'popular'});
  assert.equal(listed.pagination.total, 1);
  assert.deepEqual(captures.find.filter, {reviewStatus: 'APPROVED', visibility: 'PUBLIC', deletedAt: null});
  assert.deepEqual(captures.sort, {listenCount: -1});
  assert.equal(captures.skip, 10);
  await repository.incrementViewCount(storyId);
  assert.deepEqual(captures.update.update, {$inc: {viewCount: 1}});
  await repository.reviewModeration(storyId, {reviewStatus: 'APPROVED', reviewedBy: creatorId, moderationNote: 'Approved'});
  assert.equal(captures.update.update.$set.reviewStatus, 'APPROVED');
  assert.equal(captures.update.update.$set.creatorId, undefined);

  const duplicateRepository = new StoryMongoRepository({async create() { throw {code: 11000}; }});
  await assert.rejects(
    () => duplicateRepository.createStory({creatorId, title: 'Story', slug: 'story', description: 'Description'}),
    error => error.code === 'STORY_SLUG_EXISTS'
  );
});

test('ChapterMongoRepository derives canonical fields, handles legacy statuses, and scopes public reads', async () => {
  const chapterId = objectId();
  const storyId = objectId();
  const creatorId = objectId();
  const captures = {};
  const fakeModel = {
    async create(input) { captures.create = input; return {_id: chapterId, ...input}; },
    find(filter) { captures.find = filter; return queryResult([{_id: chapterId, ...filter}], captures); },
    findByIdAndUpdate(id, update, options) { captures.update = {id, update, options}; return queryResult({_id: chapterId, ...update.$set}); },
  };
  const repository = new ChapterMongoRepository(fakeModel);
  await repository.createChapter({storyId, creatorId, chapterNumber: 1, title: 'One', content: 'Text', status: 'PUBLISHED', ownerId: 'ignored'});
  assert.equal(captures.create.storyId.toString(), storyId.toString());
  assert.equal(captures.create.creatorId.toString(), creatorId.toString());
  assert.equal(captures.create.textContent, 'Text');
  assert.equal(captures.create.status, 'APPROVED');
  assert.equal(captures.create.ownerId, undefined);
  await repository.findPublicByStory(storyId);
  assert.deepEqual(captures.find, {status: 'APPROVED', deletedAt: null, storyId});
  await repository.softDelete(chapterId, creatorId);
  assert.ok(captures.update.update.$set.deletedAt instanceof Date);
  assert.equal(captures.update.update.$set.deletedBy.toString(), creatorId.toString());
  await assert.rejects(
    () => repository.createChapter({storyId, creatorId, chapterNumber: 2, title: 'Hidden', status: 'HIDDEN'}),
    error => error.code === 'UNMAPPABLE_LEGACY_STATUS'
  );

  const duplicateRepository = new ChapterMongoRepository({async create() { throw {code: 11000}; }});
  await assert.rejects(
    () => duplicateRepository.createChapter({storyId, creatorId, chapterNumber: 1, title: 'One'}),
    error => error.code === 'CHAPTER_NUMBER_EXISTS'
  );
});

test('AudioMongoRepository separates moderation/processing, parses transcript, and exposes primary primitives', async () => {
  const audioId = objectId();
  const storyId = objectId();
  const chapterId = objectId();
  const creatorId = objectId();
  const captures = {};
  const fakeModel = {
    async create(input) { captures.create = input; return {_id: audioId, ...input}; },
    find(filter) { captures.find = filter; return queryResult([{_id: audioId, ...filter, transcript: '{malformed'}], captures); },
    findOne(filter) { captures.findOne = filter; return queryResult({_id: audioId, ...filter, transcript: '[{"start":0,"end":1,"text":"Line"}]'}, captures); },
    updateMany(filter, update) { captures.unset = {filter, update}; return Promise.resolve({modifiedCount: 1}); },
    findByIdAndUpdate(id, update, options) { captures.update = {id, update, options}; return queryResult({_id: audioId, ...update.$set}); },
  };
  const repository = new AudioMongoRepository(fakeModel);
  const created = await repository.createAudio({storyId, chapterId, creatorId, title: 'Voice', audioUrl: 'https://cdn.example.test/a.mp3', processingStatus: 'UPLOADING', status: 'UPLOADING', transcript: [], binary: 'ignored'});
  assert.equal(created.processingStatus, 'PENDING');
  assert.equal(captures.create.status, undefined);
  assert.equal(captures.create.transcript, '[]');
  assert.equal(captures.create.binary, undefined);
  await repository.findPublicVoicesForChapter(chapterId);
  assert.deepEqual(captures.find, {status: 'APPROVED', processingStatus: 'READY', deletedAt: null, chapterId});
  await repository.findPrimaryByChapter(chapterId);
  assert.deepEqual(captures.findOne, {chapterId, isPrimary: true, deletedAt: null});
  const defaultAudio = await repository.findDefaultPlaybackForChapter(chapterId);
  assert.deepEqual(captures.findOne, {status: 'APPROVED', processingStatus: 'READY', deletedAt: null, isPrimary: true, chapterId});
  assert.deepEqual(defaultAudio.transcript, [{start: 0, end: 1, text: 'Line'}]);
  const voices = await repository.findByChapter(chapterId);
  assert.deepEqual(voices[0].transcript, []);
  await repository.updateProcessing(audioId, 'UPLOADING');
  assert.deepEqual(captures.update.update, {$set: {processingStatus: 'PENDING'}});
  await repository.unsetPrimaryForChapter(chapterId);
  assert.deepEqual(captures.unset.filter, {chapterId, isPrimary: true, deletedAt: null});
  await repository.setPrimary(audioId);
  assert.deepEqual(captures.update.update, {$set: {isPrimary: true}});

  const duplicateRepository = new AudioMongoRepository({async create() { throw {code: 11000}; }});
  await assert.rejects(
    () => duplicateRepository.createAudio({storyId, chapterId, creatorId, title: 'Voice', audioUrl: 'https://cdn.example.test/a.mp3'}),
    error => error.code === 'AUDIO_PART_CONFLICT'
  );
});

test('Content repositories are exported without changing Identity production wiring', () => {
  assert.ok(getIdentityRepositories().user instanceof UserMongoRepository);
});
