const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');
const {ROLES} = require('../src/constants/roles');
const {signAccessToken} = require('../src/utils/jwt');
const {userRepository} = require('../src/repositories/userRepository');
const {storyRepository} = require('../src/repositories/storyRepository');
const {chapterRepository} = require('../src/repositories/chapterRepository');
const {audioRepository} = require('../src/repositories/audioRepository');
const {useInMemoryIdentityRepositoriesForTest} = require('./helpers/identityTestRuntime');
const {useInMemoryContentRepositoriesForTest} = require('./helpers/contentTestRuntime');
const {resetIdentityRepositoriesToProduction} = require('../src/repositories/identityRuntime');
const {resetContentRepositoriesToProduction} = require('../src/repositories/contentRuntime');
const {AudioMongoRepository} = require('../src/repositories/mongo/AudioMongoRepository');

const IDS = Object.freeze({owner: 'restore-owner', other: 'restore-other', suspended: 'restore-suspended', story: 'restore-story', chapter: 'restore-chapter', active: 'restore-active', deleted: 'restore-deleted'});

function reset() {
  useInMemoryIdentityRepositoriesForTest(); useInMemoryContentRepositoriesForTest();
  userRepository.items = []; storyRepository.items = []; chapterRepository.items = []; audioRepository.items = [];
}

function user(id, authorStatus = 'APPROVED') {
  return userRepository.create({id, username: id, email: `${id}@test.invalid`, passwordHash: 'hash', role: ROLES.USER, authorStatus, accountStatus: 'ACTIVE', emailVerified: true, tokenVersion: 0, profile: {bio: '', avatar: null}});
}

async function serverFor(testContext) {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  testContext.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test.afterEach(() => { resetIdentityRepositoriesToProduction(); resetContentRepositoriesToProduction(); });

test('4.2C Mongo deleted discovery filters one chapter by a non-null deletedAt without storage access', async () => {
  let filter;
  const model = {find(input) { filter = input; return {sort() { return {lean() { return {exec: async () => []}; }}; }}; }};
  await new AudioMongoRepository(model).findDeletedByChapter('507f1f77bcf86cd799439012');
  assert.equal(String(filter.chapterId), '507f1f77bcf86cd799439012');
  assert.deepEqual(filter.deletedAt, {$ne: null, $exists: true});
});

test('4.2C creator deleted-audio discovery is authorized, scoped, DTO-safe, and leaves the default list unchanged', async (t) => {
  reset();
  const owner = user(IDS.owner); const other = user(IDS.other); const suspended = user(IDS.suspended, 'SUSPENDED');
  const story = storyRepository.create({id: IDS.story, creatorId: owner.id, title: 'Restore Story', slug: 'restore-story', description: 'x', status: 'ONGOING', reviewStatus: 'DRAFT', visibility: 'PRIVATE'});
  const chapter = chapterRepository.create({id: IDS.chapter, storyId: story.id, creatorId: owner.id, chapterNumber: 1, title: 'One', slug: 'one', status: 'DRAFT'});
  const base = {storyId: story.id, chapterId: chapter.id, creatorId: owner.id, sourceType: 'HUMAN', status: 'DRAFT', processingStatus: 'READY', isPrimary: false, audioUrl: '/api/audio/hidden/playback', storageKey: 'audio/private-storage-key/hidden'};
  const active = audioRepository.create({id: IDS.active, title: 'Active', deletedAt: null, ...base});
  const deleted = audioRepository.create({id: IDS.deleted, title: 'Deleted', deletedAt: new Date('2026-09-01T00:00:00.000Z').toISOString(), deletedBy: owner.id, ...base});
  const origin = await serverFor(t);
  const request = (path, actor) => fetch(`${origin}${path}`, {headers: actor ? {Authorization: `Bearer ${signAccessToken(actor)}`} : {}});

  const normal = await request(`/api/audio?chapterId=${chapter.id}`, owner);
  assert.equal(normal.status, 200); assert.deepEqual((await normal.json()).data.map(item => item.id), [active.id]);

  const discovery = await request(`/api/audio?chapterId=${chapter.id}&deleted=true`, owner);
  assert.equal(discovery.status, 200);
  const payload = await discovery.json();
  assert.deepEqual(payload.data.map(item => item.id), [deleted.id]);
  assert.ok(payload.data[0].deletedAt);
  for (const forbidden of ['storageKey', 'audioUrl', 'bucket', 'uploadToken', 'playbackUrl']) assert.equal(Object.hasOwn(payload.data[0], forbidden), false, forbidden);

  for (const actor of [other, suspended]) {
    const denied = await request(`/api/audio?chapterId=${chapter.id}&deleted=true`, actor);
    assert.equal(denied.status, 403);
  }
  const anonymous = await request(`/api/audio?chapterId=${chapter.id}&deleted=true`);
  assert.equal(anonymous.status, 401);
  const unknown = await request('/api/audio?chapterId=missing&deleted=true', owner);
  assert.equal(unknown.status, 404);
});
