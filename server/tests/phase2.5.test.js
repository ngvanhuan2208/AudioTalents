const test = require('node:test');
const assert = require('node:assert/strict');

const {userRepository} = require('../src/repositories/userRepository');
const {storyRepository} = require('../src/repositories/storyRepository');
const {chapterRepository} = require('../src/repositories/chapterRepository');
const {audioRepository} = require('../src/repositories/audioRepository');
const {creatorRepository} = require('../src/repositories/creatorRepository');
const {ROLES, AUTHOR_STATUS} = require('../src/constants/roles');
const audioService = require('../src/modules/audio/audioService');
const searchService = require('../src/modules/search/searchService');
const {InMemoryRepository} = require('../src/repositories/InMemoryRepository');
const {useInMemoryContentRepositoriesForTest} = require('./helpers/contentTestRuntime');

function resetAll() {
  useInMemoryContentRepositoriesForTest();
  userRepository.items = [];
  storyRepository.items = [];
  chapterRepository.items = [];
  creatorRepository.items = [];
}

test('approved author can create owned audio and admin can approve it', async () => {
  resetAll();

  const author = userRepository.create({
    username: 'AudioAuthor',
    email: 'audio@test.com',
    passwordHash: 'hash',
    role: ROLES.USER,
    authorStatus: AUTHOR_STATUS.APPROVED,
    status: 'ACTIVE',
    profile: {bio: '', avatar: null}
  });

  creatorRepository.create({
    userId: author.id,
    displayName: 'Audio Author',
    slug: 'audio-author',
    bio: '',
    description: '',
    verificationStatus: 'APPROVED',
    followerCount: 0
  });

  const story = storyRepository.create({
    title: 'Audio Story',
    slug: 'audio-story',
    description: 'desc',
    creatorId: author.id,
    visibility: 'PRIVATE',
    reviewStatus: 'APPROVED',
    genres: ['Fantasy'],
    tags: [],
    status: 'DRAFT',
    rating: 0,
    views: 0,
    listens: 0,
    chapterCount: 0,
    duration: 0
  });

  const chapter = chapterRepository.create({
    storyId: story.id,
    chapterNumber: 1,
    title: 'Ch 1',
    content: 'abc',
    status: 'DRAFT',
    duration: 0,
    publishedAt: null
  });

  const created = await audioService.create({ chapterId: chapter.id, audioUrl: 'https://cdn.example.com/audio.mp3', title: 'Track 1' }, author);
  assert.equal(created.creatorId, author.id);
  assert.equal(created.status, 'DRAFT');
  audioRepository.update(created.id, {processingStatus: 'READY'});

  const admin = userRepository.create({
    username: 'Admin',
    email: 'admin@test.com',
    passwordHash: 'hash',
    role: ROLES.ADMIN,
    authorStatus: AUTHOR_STATUS.NONE,
    status: 'ACTIVE',
    profile: {bio: '', avatar: null}
  });

  const approved = await audioService.moderate(created.id, 'APPROVED', admin);
  assert.equal(approved.status, 'APPROVED');
});

test('another author cannot update or delete someone else audio', async () => {
  resetAll();

  const authorA = userRepository.create({
    username: 'AuthorA',
    email: 'authora@test.com',
    passwordHash: 'hash',
    role: ROLES.USER,
    authorStatus: AUTHOR_STATUS.APPROVED,
    status: 'ACTIVE',
    profile: {bio: '', avatar: null}
  });

  const authorB = userRepository.create({
    username: 'AuthorB',
    email: 'authorb@test.com',
    passwordHash: 'hash',
    role: ROLES.USER,
    authorStatus: AUTHOR_STATUS.APPROVED,
    status: 'ACTIVE',
    profile: {bio: '', avatar: null}
  });

  const story = storyRepository.create({
    title: 'Story B',
    slug: 'story-b',
    description: 'desc',
    creatorId: authorA.id,
    visibility: 'PRIVATE',
    reviewStatus: 'APPROVED',
    genres: ['Fantasy'],
    tags: [],
    status: 'DRAFT',
    rating: 0,
    views: 0,
    listens: 0,
    chapterCount: 0,
    duration: 0
  });

  const chapter = chapterRepository.create({
    storyId: story.id,
    chapterNumber: 1,
    title: 'c',
    content: 'abc',
    status: 'DRAFT',
    duration: 0,
    publishedAt: null
  });

  const audio = await audioService.create({ chapterId: chapter.id, audioUrl: 'https://cdn.example.com/b.mp3', title: 'Track B' }, authorA);

  await assert.rejects(() => audioService.update(audio.id, {title: 'Hacked'}, authorB), /You do not own this audio/);
  await assert.rejects(() => audioService.remove(audio.id, authorB), /You do not own this audio/);
});

test('search supports keyword and filters in-memory', async () => {
  resetAll();

  storyRepository.create({
    title: 'Fantasy Quest',
    slug: 'fantasy-quest',
    description: 'A search test',
    creatorId: 'creator-1',
    visibility: 'PUBLIC',
    reviewStatus: 'APPROVED',
    genres: ['Fantasy'],
    tags: [],
    status: 'DRAFT',
    rating: 0,
    views: 0,
    listens: 0,
    chapterCount: 0,
    duration: 0
  });

  const result = await searchService.search({ keyword: 'fantasy', genre: 'Fantasy', status: 'DRAFT', sort: 'popular', page: 1, limit: 10 });
  assert.equal(result.items.length, 1);
  assert.equal(result.pagination.page, 1);
  assert.equal(result.pagination.limit, 10);
});

test('legacy notification fixture remains isolated from production Community runtime', () => {
  const fixtureRepository = new InMemoryRepository();
  const item = fixtureRepository.create({userId: 'fixture-user', type: 'LEGACY_FIXTURE', readAt: null});
  assert.equal(item.userId, 'fixture-user');
  assert.equal(fixtureRepository.findMany().length, 1);
});
