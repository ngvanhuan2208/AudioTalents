const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');

const {ROLES, AUTHOR_STATUS, CHAPTER_STATUS} = require('../src/constants/roles');
const {userRepository} = require('../src/repositories/userRepository');
const {storyRepository} = require('../src/repositories/storyRepository');
const {creatorRepository} = require('../src/repositories/creatorRepository');
const {chapterRepository} = require('../src/repositories/chapterRepository');
const {audioRepository} = require('../src/repositories/audioRepository');
const storyService = require('../src/modules/stories/storyService');
const chapterService = require('../src/modules/chapters/chapterService');
const audioService = require('../src/modules/audio/audioService');
const authService = require('../src/modules/auth/authService');
const emailService = require('../src/services/emailService');
const {useInMemoryIdentityRepositoriesForTest} = require('./helpers/identityTestRuntime');
const {useInMemoryContentRepositoriesForTest} = require('./helpers/contentTestRuntime');

function resetRepositories() {
  useInMemoryIdentityRepositoriesForTest();
  useInMemoryContentRepositoriesForTest();
  userRepository.items = [];
  storyRepository.items = [];
  creatorRepository.items = [];
  chapterRepository.items = [];
  audioRepository.items = [];
  require('../src/services/otpService').otpTokenRepository.items = [];
  emailService.clearTestDelivery();
}

function makeUser(id, authorStatus = AUTHOR_STATUS.APPROVED, role = ROLES.USER) {
  return userRepository.create({
    id,
    username: id,
    email: `${id}@test.com`,
    passwordHash: 'hash',
    role,
    authorStatus,
    status: 'ACTIVE',
    profile: {bio: '', avatar: null}
  });
}

function makeCreator(user) {
  return creatorRepository.create({userId: user.id, displayName: user.username, slug: user.username, bio: '', description: '', verificationStatus: 'APPROVED', followerCount: 0});
}

function makeStory(creatorId, overrides = {}) {
  return storyRepository.create({
    title: 'Public Story',
    slug: 'public-story',
    description: 'Description',
    creatorId,
    visibility: 'PUBLIC',
    reviewStatus: 'APPROVED',
    genres: ['Fantasy'],
    tags: [],
    status: 'ONGOING',
    rating: 0,
    views: 0,
    listens: 0,
    chapterCount: 0,
    duration: 0,
    ...overrides
  });
}

test('public users can read only approved chapters of a public story', async () => {
  resetRepositories();
  const author = makeUser('public-author');
  const story = makeStory(author.id);
  const approved = chapterRepository.create({storyId: story.id, chapterNumber: 1, title: 'Published', content: '', status: CHAPTER_STATUS.APPROVED});
  chapterRepository.create({storyId: story.id, chapterNumber: 2, title: 'Draft', content: '', status: CHAPTER_STATUS.DRAFT});

  assert.deepEqual((await chapterService.list(story.id, null)).map(item => item.id), [approved.id]);
  assert.equal((await chapterService.getById(approved.id, null)).id, approved.id);
  await assert.rejects(() => chapterService.getById(`${approved.id}-missing`, null), error => error.code === 'NOT_FOUND');
});

test('public audio exposes approved assets only', async () => {
  resetRepositories();
  const author = makeUser('audio-public-author');
  const story = makeStory(author.id, {slug: 'audio-public-story'});
  const chapter = chapterRepository.create({storyId: story.id, chapterNumber: 1, title: 'Published', content: '', status: CHAPTER_STATUS.PUBLISHED});
  audioRepository.create({chapterId: chapter.id, ownerId: author.id, audioUrl: 'https://cdn.example.com/approved.mp3', status: 'APPROVED'});
  audioRepository.create({chapterId: chapter.id, ownerId: author.id, audioUrl: 'https://cdn.example.com/draft.mp3', status: 'DRAFT'});

  assert.deepEqual((await audioService.listPublic(chapter.id)).map(item => item.audioUrl), ['https://cdn.example.com/approved.mp3']);
});

test('story slugs and chapter numbers are unique', async () => {
  resetRepositories();
  const author = makeUser('slug-author');
  makeCreator(author);
  const first = await storyService.create({title: 'Same Title', description: 'One', genres: ['Fantasy']}, author);
  const second = await storyService.create({title: 'Same Title', description: 'Two', genres: ['Fantasy']}, author);
  assert.notEqual(first.slug, second.slug);

  await chapterService.create(first.id, {chapterNumber: 1, title: 'One'}, author);
  await assert.rejects(() => chapterService.create(first.id, {chapterNumber: 1, title: 'Duplicate'}, author), error => error.code === 'CONFLICT');
});

test('author ownership blocks chapter and audio IDOR while admin can moderate revision', async () => {
  resetRepositories();
  const authorA = makeUser('owner-a');
  const authorB = makeUser('owner-b');
  const admin = makeUser('admin', AUTHOR_STATUS.NONE, ROLES.ADMIN);
  const story = makeStory(authorA.id, {visibility: 'PRIVATE', reviewStatus: 'DRAFT'});
  const chapter = chapterRepository.create({storyId: story.id, chapterNumber: 1, title: 'One', content: '', status: CHAPTER_STATUS.DRAFT});
  const audio = await audioService.create({chapterId: chapter.id, audioUrl: 'https://cdn.example.com/owner.mp3'}, authorA);

  await assert.rejects(() => chapterService.update(chapter.id, {title: 'Hacked'}, authorB), error => error.code === 'FORBIDDEN');
  await assert.rejects(() => audioService.update(audio.id, {title: 'Hacked'}, authorB), error => error.code === 'FORBIDDEN');
  assert.equal((await chapterService.moderate(chapter.id, 'REVISION_REQUIRED', admin)).status, 'REVISION_REQUIRED');
});

test('registration ignores privilege escalation fields', async () => {
  resetRepositories();
  emailService.setTestDelivery(async () => {});
  const result = await authService.register({
    username: 'safe-user',
    email: 'safe-user@test.com',
    password: 'password123',
    role: ROLES.ADMIN,
    authorStatus: AUTHOR_STATUS.APPROVED
  });
  assert.equal(result.user.role, ROLES.USER);
  assert.equal(result.user.authorStatus, AUTHOR_STATUS.NONE);
});

test('public content routes work without an Authorization header', async () => {
  resetRepositories();
  const author = makeUser('http-author');
  const story = makeStory(author.id, {slug: 'http-public-story'});
  const chapter = chapterRepository.create({storyId: story.id, chapterNumber: 1, title: 'Public chapter', content: '', status: CHAPTER_STATUS.PUBLISHED});
  audioRepository.create({chapterId: chapter.id, ownerId: author.id, audioUrl: 'https://cdn.example.com/public.mp3', status: 'APPROVED'});
  const server = http.createServer(app);

  await new Promise(resolve => server.listen(0, resolve));
  const {port} = server.address();
  try {
    for (const path of [
      `/api/stories`,
      `/api/stories/${story.slug}`,
      `/api/stories/${story.id}/chapters`,
      `/api/chapters/${chapter.id}/audio`
    ]) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`);
      assert.equal(response.status, 200, path);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
