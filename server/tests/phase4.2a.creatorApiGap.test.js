const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const {PlaybackGrantService, PLAYBACK_AUDIENCE, PLAYBACK_PURPOSE, PLAYBACK_TTL_SEC} = require('../src/media/playback');
const {AudioMediaService} = require('../src/modules/audio/audioMediaService');
const audioService = require('../src/modules/audio/audioService');
const {StorageError} = require('../src/media/storage');

const IDS = Object.freeze({audio: '507f1f77bcf86cd799439011', chapter: '507f1f77bcf86cd799439012', story: '507f1f77bcf86cd799439013', owner: '507f1f77bcf86cd799439014', other: '507f1f77bcf86cd799439015'});
const SECRET = 'phase42a-test-playback-capability-secret-minimum';
const owner = {id: IDS.owner, role: 'USER', authorStatus: 'APPROVED', accountStatus: 'ACTIVE', emailVerified: true};

function fixture({audio = {}, actor = owner, storageError} = {}) {
  const records = {
    story: {id: IDS.story, creatorId: IDS.owner, reviewStatus: 'DRAFT', visibility: 'PRIVATE', deletedAt: null},
    chapter: {id: IDS.chapter, storyId: IDS.story, creatorId: IDS.owner, status: 'DRAFT', deletedAt: null},
    audio: {id: IDS.audio, storyId: IDS.story, chapterId: IDS.chapter, creatorId: IDS.owner, status: 'DRAFT', processingStatus: 'READY', storageKey: `audio/${IDS.audio}/fixture`, deletedAt: null, isPrimary: true, ...audio},
  };
  const storage = {
    async createReadUrl() { return {url: 'https://signed.invalid/private', expiresAt: new Date()}; },
    async headObject() { if (storageError) throw storageError; return {size: 1}; },
  };
  const repositories = {
    audio: {
      async findById(id, {includeDeleted} = {}) { return id === IDS.audio && (includeDeleted || !records.audio.deletedAt) ? records.audio : null; },
      async restoreWithinRetention(id, cutoff) { if (id !== IDS.audio || !records.audio.deletedAt || new Date(records.audio.deletedAt) <= cutoff) return null; records.audio = {...records.audio, deletedAt: null, deletedBy: null, isPrimary: false}; return records.audio; },
    },
    chapter: {async findById(id, {includeDeleted} = {}) { return id === IDS.chapter && (includeDeleted || !records.chapter.deletedAt) ? records.chapter : null; }},
    story: {async findById(id, {includeDeleted} = {}) { return id === IDS.story && (includeDeleted || !records.story.deletedAt) ? records.story : null; }},
  };
  const grants = new PlaybackGrantService({secret: SECRET, uuid: () => 'capability-id'});
  const media = new AudioMediaService({repositories, storageProvider: storage, playbackGrantService: grants, identityRepositories: {user: {async findById(id) { return id === actor.id ? actor : null; }}}});
  return {records, repositories, storage, grants, media};
}

test('4.2A playback capability is short-lived, purpose-specific, and isolated from other JWTs', () => {
  const grants = new PlaybackGrantService({secret: SECRET, uuid: () => 'capability-id'});
  const issued = grants.issue({audioId: IDS.audio, actorId: IDS.owner});
  const claims = grants.verify(issued.token);
  assert.equal(claims.aud, PLAYBACK_AUDIENCE); assert.equal(claims.purpose, PLAYBACK_PURPOSE); assert.equal(PLAYBACK_TTL_SEC, 90);
  assert.throws(() => grants.verify(jwt.sign({aud: PLAYBACK_AUDIENCE, purpose: 'AUDIO_UPLOAD', audioId: IDS.audio, actorId: IDS.owner, jti: 'wrong'}, SECRET, {expiresIn: 60})), error => error.code === 'INVALID_PLAYBACK_TOKEN');
  assert.throws(() => grants.verify(jwt.sign({aud: 'media-upload', purpose: 'AUDIO_UPLOAD', audioId: IDS.audio, actorId: IDS.owner, jti: 'upload'}, SECRET, {expiresIn: 60})), error => error.code === 'INVALID_PLAYBACK_TOKEN');
});

test('4.2A owner capability redeems only for its exact READY private audio and revalidates suspension', async () => {
  const valid = fixture();
  const issued = await valid.media.issuePlaybackCapability(IDS.audio, owner);
  assert.match(issued.playbackUrl, new RegExp(`^/api/audio/${IDS.audio}/playback\\?capability=`));
  const token = new URL(`https://app.invalid${issued.playbackUrl}`).searchParams.get('capability');
  const signed = await valid.media.authorizePlayback(IDS.audio, undefined, {playbackCapability: token});
  assert.equal(signed.url, 'https://signed.invalid/private');
  await assert.rejects(() => valid.media.authorizePlayback(IDS.other, undefined, {playbackCapability: token}), error => error.code === 'AUDIO_NOT_FOUND');
  const suspended = fixture({actor: {...owner, authorStatus: 'SUSPENDED'}});
  const suspendedToken = suspended.grants.issue({audioId: IDS.audio, actorId: IDS.owner}).token;
  await assert.rejects(() => suspended.media.authorizePlayback(IDS.audio, undefined, {playbackCapability: suspendedToken}), error => error.code === 'AUDIO_NOT_FOUND');
  for (const audio of [{processingStatus: 'PENDING'}, {deletedAt: new Date()}]) {
    const blocked = fixture({audio});
    await assert.rejects(() => blocked.media.issuePlaybackCapability(IDS.audio, owner), error => error.code === (audio.deletedAt ? 'AUDIO_NOT_FOUND' : 'MEDIA_NOT_READY'));
  }
});

test('4.2A restore enforces atomic retention, storage existence, ownership, and never reclaims primary', async () => {
  const now = new Date('2026-09-13T00:00:00.000Z');
  const within = fixture({audio: {deletedAt: new Date(now.getTime() - (29 * 24 * 60 * 60 * 1000)), deletedBy: IDS.owner}});
  const restored = await audioService.restore(IDS.audio, owner, {now, repositories: within.repositories, storageProvider: within.storage});
  assert.equal(restored.deletedAt, null); assert.equal(restored.isPrimary, false);
  const exact = fixture({audio: {deletedAt: new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)), deletedBy: IDS.owner}});
  await assert.rejects(() => audioService.restore(IDS.audio, owner, {now, repositories: exact.repositories, storageProvider: exact.storage}), error => error.code === 'RESTORE_RETENTION_EXPIRED');
  const missing = fixture({audio: {deletedAt: new Date(now.getTime() - 1000), deletedBy: IDS.owner}, storageError: new StorageError('OBJECT_NOT_FOUND', 'private')});
  await assert.rejects(() => audioService.restore(IDS.audio, owner, {now, repositories: missing.repositories, storageProvider: missing.storage}), error => error.code === 'OBJECT_NOT_FOUND');
  const unavailable = fixture({audio: {deletedAt: new Date(now.getTime() - 1000), deletedBy: IDS.owner}, storageError: new StorageError('STORAGE_UNAVAILABLE', 'private')});
  await assert.rejects(() => audioService.restore(IDS.audio, owner, {now, repositories: unavailable.repositories, storageProvider: unavailable.storage}), error => error.code === 'STORAGE_UNAVAILABLE');
  const unauthorized = fixture({audio: {deletedAt: new Date(now.getTime() - 1000), deletedBy: IDS.owner}});
  await assert.rejects(() => audioService.restore(IDS.audio, {...owner, id: IDS.other}, {now, repositories: unauthorized.repositories, storageProvider: unauthorized.storage}), error => error.code === 'FORBIDDEN');
});
