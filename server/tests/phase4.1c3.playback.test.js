const test = require('node:test');
const assert = require('node:assert/strict');
const {AudioMediaService, PLAYBACK_TTL_SEC} = require('../src/modules/audio/audioMediaService');
const {optionalAuth} = require('../src/middleware/auth');
const {StorageError} = require('../src/media/storage');
const {signAccessToken} = require('../src/utils/jwt');
const {configureIdentityRepositoriesForTests, resetIdentityRepositoriesToProduction} = require('../src/repositories/identityRuntime');

const IDS = Object.freeze({
  audio: '507f1f77bcf86cd799439011', chapter: '507f1f77bcf86cd799439012',
  story: '507f1f77bcf86cd799439013', owner: '507f1f77bcf86cd799439014', other: '507f1f77bcf86cd799439015',
});

function playbackFixture({
  story = {}, chapter = {}, audio = {}, storageFailure,
} = {}) {
  const records = {
    story: {id: IDS.story, creatorId: IDS.owner, status: 'ONGOING', reviewStatus: 'APPROVED', visibility: 'PUBLIC', deletedAt: null, ...story},
    chapter: {id: IDS.chapter, storyId: IDS.story, creatorId: IDS.owner, status: 'APPROVED', deletedAt: null, ...chapter},
    audio: {
      id: IDS.audio, storyId: IDS.story, chapterId: IDS.chapter, creatorId: IDS.owner,
      status: 'APPROVED', processingStatus: 'READY', deletedAt: null, isPrimary: false,
      storageKey: `audio/${IDS.audio}/fixture`, audioUrl: 'https://untrusted.invalid/blob', ...audio,
    },
  };
  const calls = {read: [], writes: {audio: 0, story: 0, chapter: 0, history: 0, audit: 0, notification: 0}};
  const repositories = {
    audio: {
      async findById(id) { return id === IDS.audio && !records.audio.deletedAt ? records.audio : null; },
      async updateMetadata() { calls.writes.audio += 1; }, async createAudio() { calls.writes.audio += 1; }, async softDelete() { calls.writes.audio += 1; },
    },
    chapter: {async findById(id) { return id === IDS.chapter && !records.chapter.deletedAt ? records.chapter : null; }, async updateEditable() { calls.writes.chapter += 1; }},
    story: {async findById(id) { return id === IDS.story && !records.story.deletedAt ? records.story : null; }, async updateEditable() { calls.writes.story += 1; }},
    listenHistory: {async upsert() { calls.writes.history += 1; }},
    auditLog: {async append() { calls.writes.audit += 1; }},
    notification: {async create() { calls.writes.notification += 1; }},
  };
  const storage = {
    async createReadUrl(input) {
      calls.read.push(input);
      if (storageFailure) throw storageFailure;
      return {url: 'https://signed.invalid/audio?X-Amz-Signature=secret', expiresAt: new Date('2026-09-12T00:15:00.000Z')};
    },
  };
  return {records, calls, service: new AudioMediaService({repositories, storageProvider: storage})};
}

const owner = {id: IDS.owner, role: 'USER', authorStatus: 'APPROVED'};
const otherAuthor = {id: IDS.other, role: 'USER', authorStatus: 'APPROVED'};
const admin = {id: IDS.other, role: 'ADMIN', authorStatus: 'NONE'};

test('C3 publicly signs an explicit non-primary approved READY audio using Story.reviewStatus, not Story.status', async () => {
  const {service, calls} = playbackFixture();
  const signed = await service.authorizePlayback(IDS.audio, undefined);
  assert.equal(signed.url, 'https://signed.invalid/audio?X-Amz-Signature=secret');
  assert.deepEqual(calls.read, [{key: `audio/${IDS.audio}/fixture`, expiresInSec: PLAYBACK_TTL_SEC}]);
  assert.equal(PLAYBACK_TTL_SEC, 900);
  assert.deepEqual(calls.writes, {audio: 0, story: 0, chapter: 0, history: 0, audit: 0, notification: 0});
});

test('C3 conceals private/unlisted media and non-owner or suspended-author preview attempts', async () => {
  for (const caller of [undefined, otherAuthor, {...owner, authorStatus: 'SUSPENDED'}]) {
    const {service, calls} = playbackFixture({story: {visibility: 'PRIVATE'}});
    await assert.rejects(() => service.authorizePlayback(IDS.audio, caller), error => error.code === 'AUDIO_NOT_FOUND' && error.statusCode === 404);
    assert.equal(calls.read.length, 0);
  }
  const unlisted = playbackFixture({story: {visibility: 'UNLISTED'}});
  await assert.rejects(() => unlisted.service.authorizePlayback(IDS.audio), error => error.code === 'AUDIO_NOT_FOUND');
  assert.equal(unlisted.calls.read.length, 0);
});

test('C3 permits approved creator preview for every READY moderation state and permits admin moderation preview', async () => {
  for (const status of ['DRAFT', 'PENDING_REVIEW', 'REJECTED', 'REVISION_REQUIRED', 'APPROVED']) {
    const fixture = playbackFixture({story: {visibility: 'PRIVATE', reviewStatus: 'DRAFT'}, chapter: {status: 'DRAFT'}, audio: {status}});
    await fixture.service.authorizePlayback(IDS.audio, owner);
    assert.equal(fixture.calls.read.length, 1, status);
  }
  const fixture = playbackFixture({story: {visibility: 'PRIVATE'}, chapter: {status: 'DRAFT'}, audio: {status: 'PENDING_REVIEW'}});
  await fixture.service.authorizePlayback(IDS.audio, admin);
  assert.equal(fixture.calls.read.length, 1);
});

test('C3 does not sign non-ready media; owner and admin get MEDIA_NOT_READY while outsiders remain concealed', async () => {
  for (const processingStatus of ['PENDING', 'PROCESSING', 'FAILED']) {
    const ownerFixture = playbackFixture({story: {visibility: 'PRIVATE'}, audio: {status: 'DRAFT', processingStatus}});
    await assert.rejects(() => ownerFixture.service.authorizePlayback(IDS.audio, owner), error => error.code === 'MEDIA_NOT_READY');
    assert.equal(ownerFixture.calls.read.length, 0);
    const adminFixture = playbackFixture({story: {visibility: 'PRIVATE'}, audio: {status: 'DRAFT', processingStatus}});
    await assert.rejects(() => adminFixture.service.authorizePlayback(IDS.audio, admin), error => error.code === 'MEDIA_NOT_READY');
    const outsiderFixture = playbackFixture({story: {visibility: 'PRIVATE'}, audio: {status: 'DRAFT', processingStatus}});
    await assert.rejects(() => outsiderFixture.service.authorizePlayback(IDS.audio, otherAuthor), error => error.code === 'AUDIO_NOT_FOUND');
  }
});

test('C3 blocks deleted and broken parent chains before signing', async () => {
  const variants = [
    {audio: {deletedAt: new Date()}}, {chapter: {deletedAt: new Date()}}, {story: {deletedAt: new Date()}},
    {audio: {storyId: IDS.other}}, {chapter: {storyId: IDS.other}}, {chapter: {creatorId: IDS.other}},
  ];
  for (const variant of variants) {
    const fixture = playbackFixture(variant);
    await assert.rejects(() => fixture.service.authorizePlayback(IDS.audio, admin), error => error.code === 'AUDIO_NOT_FOUND');
    assert.equal(fixture.calls.read.length, 0);
  }
});

test('C3 requires a safe final audio/ storage key and normalizes signing failures without leaking provider data', async () => {
  for (const storageKey of [null, undefined, 'uploads/pending/object', `audio/${IDS.other}/other`, 'https://bucket.invalid/private', '../audio/escape']) {
    const fixture = playbackFixture({audio: {storageKey}});
    await assert.rejects(() => fixture.service.authorizePlayback(IDS.audio), error => error.code === 'MEDIA_INTEGRITY_ERROR' && error.statusCode === 409);
    assert.equal(fixture.calls.read.length, 0);
  }
  const failing = playbackFixture({storageFailure: new StorageError('OBJECT_NOT_FOUND', 'bucket-private-detail')});
  await assert.rejects(() => failing.service.authorizePlayback(IDS.audio), error => error.code === 'STORAGE_UNAVAILABLE' && error.statusCode === 503 && !error.message.includes('bucket'));
});

test('C3 controller returns an uncached 302 redirect without a JSON success envelope', async () => {
  const controller = require('../src/modules/audio/audioController');
  const original = AudioMediaService.prototype.authorizePlayback;
  AudioMediaService.prototype.authorizePlayback = async () => ({url: 'https://signed.invalid/audio?secret=do-not-log'});
  const observed = {headers: null, redirect: null};
  const res = {
    set(headers) { observed.headers = headers; return this; },
    redirect(status, url) { observed.redirect = {status, url}; return this; },
  };
  try {
    await controller.playback({params: {id: IDS.audio}, user: undefined}, res);
  } finally {
    AudioMediaService.prototype.authorizePlayback = original;
  }
  assert.deepEqual(observed.headers, {'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer'});
  assert.deepEqual(observed.redirect, {status: 302, url: 'https://signed.invalid/audio?secret=do-not-log'});
});

test('C3 optional auth treats no header as anonymous, a valid JWT as authenticated, and supplied invalid credentials as a controlled failure', async () => {
  let anonymousNext;
  optionalAuth({headers: {}}, {}, error => { anonymousNext = error; });
  assert.equal(anonymousNext, undefined);

  const authenticatedUser = {...owner, accountStatus: 'ACTIVE', emailVerified: true, tokenVersion: 0};
  configureIdentityRepositoriesForTests({
    user: {async findById(id) { return id === IDS.owner ? authenticatedUser : null; }}, otpToken: {}, authorApplication: {},
  });
  const authenticatedReq = {headers: {authorization: `Bearer ${signAccessToken(authenticatedUser)}`}};
  let validNext;
  try {
    await optionalAuth(authenticatedReq, {}, error => { validNext = error; });
  } finally {
    resetIdentityRepositoriesToProduction();
  }
  assert.equal(validNext, undefined);
  assert.equal(authenticatedReq.user.id, IDS.owner);

  let invalidNext;
  await optionalAuth({headers: {authorization: ''}}, {}, error => { invalidNext = error; });
  assert.equal(invalidNext.code, 'UNAUTHORIZED');
});

test('C3 registers only the canonical playback route without colliding with audio mutations or C2 upload routes', () => {
  const router = require('../src/modules/audio/audioRoutes');
  const routes = router.stack
    .filter(layer => layer.route)
    .map(layer => ({path: layer.route.path, methods: Object.keys(layer.route.methods).sort()}));
  assert.ok(routes.some(route => route.path === '/:id/playback' && route.methods.join(',') === 'get'));
  assert.ok(routes.some(route => route.path === '/:id' && route.methods.join(',') === 'patch'));
  assert.ok(routes.some(route => route.path === '/:id' && route.methods.join(',') === 'delete'));
  assert.ok(routes.some(route => route.path === '/:id/upload-url' && route.methods.join(',') === 'post'));
  assert.ok(routes.some(route => route.path === '/:id/upload-confirm' && route.methods.join(',') === 'post'));
  assert.ok(routes.some(route => route.path === '/:id/submit' && route.methods.join(',') === 'post'));
});
