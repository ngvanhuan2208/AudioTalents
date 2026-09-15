const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GenreMongoRepository,
  StoryMongoRepository,
  ChapterMongoRepository,
  AudioMongoRepository,
  UserMongoRepository,
  getContentRepositories,
  resetContentRepositoriesToProduction,
} = require('../src/repositories');
const {useInMemoryContentRepositoriesForTest} = require('./helpers/contentTestRuntime');
const {storyRepository} = require('../src/repositories/storyRepository');
const {chapterRepository} = require('../src/repositories/chapterRepository');
const {audioRepository} = require('../src/repositories/audioRepository');
const storyService = require('../src/modules/stories/storyService');
const chapterService = require('../src/modules/chapters/chapterService');
const audioService = require('../src/modules/audio/audioService');
const {mapAudioRuntimeToPersistence} = require('../src/repositories/adapters/persistenceMappers');
const {getIdentityRepositories} = require('../src/repositories/identityRuntime');
const {ROLES, AUTHOR_STATUS} = require('../src/constants/roles');

function author(id = 'author-1') { return {id, role: ROLES.USER, authorStatus: AUTHOR_STATUS.APPROVED}; }

function resetInMemoryContent() {
  useInMemoryContentRepositoriesForTest();
  storyRepository.items = [];
  chapterRepository.items = [];
  audioRepository.items = [];
}

test.afterEach(() => resetContentRepositoriesToProduction());

test('production Content provider resolves only Mongo repositories while Identity stays Mongo', () => {
  resetContentRepositoriesToProduction();
  const content = getContentRepositories();
  assert.equal(content.runtime, 'MONGO');
  assert.ok(content.genre instanceof GenreMongoRepository);
  assert.ok(content.story instanceof StoryMongoRepository);
  assert.ok(content.chapter instanceof ChapterMongoRepository);
  assert.ok(content.audio instanceof AudioMongoRepository);
  assert.ok(getIdentityRepositories().user instanceof UserMongoRepository);
  assert.equal(content.story.rawRepository, undefined);
});

test('explicit test injection proves trusted ownership, parent chain, protected fields, and counter coordination', async () => {
  resetInMemoryContent();
  const owner = author('owner');
  const story = await storyService.create({
    title: 'Trusted Story', description: 'Description', genres: ['Fantasy'], creatorId: 'attacker', chapterCount: 999,
  }, owner);
  assert.equal(story.creatorId, owner.id);
  assert.equal(story.chapterCount, undefined);

  const updated = await storyService.update(story.id, {title: 'Edited', creatorId: 'attacker', reviewStatus: 'APPROVED', chapterCount: 99}, owner);
  assert.equal(updated.creatorId, owner.id);
  assert.equal(updated.reviewStatus, 'DRAFT');

  await assert.rejects(
    () => chapterService.create(story.id, {chapterNumber: 1, title: 'Hidden', status: 'HIDDEN'}, owner),
    error => error.code === 'UNMAPPABLE_LEGACY_STATUS'
  );
  const chapter = await chapterService.create(story.id, {chapterNumber: 1, title: 'One', creatorId: 'attacker'}, owner);
  assert.equal(chapter.storyId, story.id);
  assert.equal(chapter.creatorId, owner.id);
  assert.equal(storyRepository.findById(story.id).chapterCount, 1);
  await assert.rejects(() => chapterService.list(story.id, null), error => error.code === 'NOT_FOUND');

  const audio = await audioService.create({
    chapterId: chapter.id, storyId: 'attacker-story', creatorId: 'attacker', audioUrl: 'https://cdn.example.com/one.mp3',
  }, owner);
  assert.equal(audio.storyId, story.id);
  assert.equal(audio.creatorId, owner.id);
  assert.deepEqual(await audioService.listPublic(chapter.id), []);

  await chapterService.remove(chapter.id, owner);
  assert.equal(storyRepository.findById(story.id).chapterCount, 0);
});

test('Audio compatibility, distinct public/default reads, and primary deletion use controlled operations', async () => {
  resetInMemoryContent();
  const owner = author('owner-audio');
  const story = storyRepository.create({id: 'story-1', creatorId: owner.id, title: 'Public', slug: 'public', description: 'x', status: 'ONGOING', reviewStatus: 'APPROVED', visibility: 'PUBLIC', genres: []});
  const chapter = chapterRepository.create({id: 'chapter-1', storyId: story.id, creatorId: owner.id, chapterNumber: 1, title: 'One', slug: 'one', status: 'APPROVED'});
  const primary = audioRepository.create({id: 'audio-1', storyId: story.id, chapterId: chapter.id, creatorId: owner.id, title: 'Primary', audioUrl: 'https://cdn.example.com/primary.mp3', status: 'APPROVED', processingStatus: 'READY', isPrimary: true});
  const voice = audioRepository.create({id: 'audio-2', storyId: story.id, chapterId: chapter.id, creatorId: owner.id, title: 'Voice', audioUrl: 'https://cdn.example.com/voice.mp3', status: 'APPROVED', processingStatus: 'READY', isPrimary: false});
  assert.deepEqual((await audioService.listPublic(chapter.id)).map(item => item.id), [primary.id, voice.id]);
  assert.equal((await audioService.getDefaultPlayback(chapter.id)).id, primary.id);
  await audioService.remove(primary.id, owner);
  assert.equal(audioRepository.findById(primary.id).isPrimary, false);
  assert.ok(audioRepository.findById(primary.id).deletedAt);
  assert.equal(mapAudioRuntimeToPersistence({status: 'UPLOADING'}).processingStatus, 'PENDING');
  assert.equal(mapAudioRuntimeToPersistence({status: 'UPLOADING'}).status, undefined);
  assert.throws(() => mapAudioRuntimeToPersistence({status: 'INVALID'}), error => error.code === 'INVALID_AUDIO_MODERATION_STATUS');
});
