const assert = require('node:assert/strict');
const {test} = require('node:test');
const {Readable} = require('node:stream');
const {getMediaPolicy, CREATOR_MAX_AUDIO_BYTES, CREATOR_MAX_DURATION_SEC} = require('../src/media/mediaPolicy');
const {AudioMediaService} = require('../src/modules/audio/audioMediaService');
const {UploadGrantService} = require('../src/media/upload');

const ids = {audio: '507f1f77bcf86cd799439011', chapter: '507f1f77bcf86cd799439012', story: '507f1f77bcf86cd799439013', user: '507f1f77bcf86cd799439014'};
const actor = {id: ids.user, role: 'USER', authorStatus: 'APPROVED'};

function fixture({size = CREATOR_MAX_AUDIO_BYTES, durationSec = CREATOR_MAX_DURATION_SEC} = {}) {
  const audio = {id: ids.audio, chapterId: ids.chapter, storyId: ids.story, creatorId: ids.user, status: 'DRAFT', processingStatus: 'PENDING', storageKey: null, updatedAt: '2026-09-14T00:00:00.000Z', deletedAt: null};
  const repositories = {
    audio: {findById: async () => audio, commitMediaUpload: async (_id, snapshot, media) => { if (audio.updatedAt !== snapshot.expectedUpdatedAt) return null; Object.assign(audio, media); return audio; }},
    chapter: {findById: async () => ({id: ids.chapter, storyId: ids.story})},
    story: {findById: async () => ({id: ids.story, creatorId: ids.user})},
  };
  const storage = {
    createDirectUpload: async () => ({url: 'https://signed.invalid/put', method: 'PUT', headers: {}, expiresAt: new Date()}),
    headObject: async () => ({size, etag: '"creator-etag"'}),
    openReadStream: async () => ({stream: Readable.from([Buffer.from('fixture')])}),
    copyObject: async () => undefined,
  };
  const inspector = {inspectAudio: async () => ({detectedMimeType: 'audio/mpeg', durationSec, bitrate: 64000})};
  const grants = new UploadGrantService({secret: 'creator-v2-test-secret-at-least-thirty-two-bytes', uuid: () => 'creator-v2-token'});
  const policy = {maxBytes: 250 * 1024 * 1024, hardMaxBytes: 500 * 1024 * 1024, maxDurationSec: 4 * 60 * 60, creatorMaxBytes: CREATOR_MAX_AUDIO_BYTES, creatorMaxDurationSec: CREATOR_MAX_DURATION_SEC, uploadTtlSec: 600};
  return {audio, service: new AudioMediaService({repositories, storageProvider: storage, inspector, grantService: grants, policy, nonce: () => 'creator-v2-nonce'})};
}

test('V2 creator policy exposes locked 30 MiB / 3600 sec limits', () => {
  const policy = getMediaPolicy({});
  assert.equal(policy.creatorMaxBytes, 31_457_280);
  assert.equal(policy.creatorMaxDurationSec, 3600);
  assert.equal(CREATOR_MAX_AUDIO_BYTES, 31_457_280);
  assert.equal(CREATOR_MAX_DURATION_SEC, 3600);
});

test('V2 accepts exact size and duration boundaries', async () => {
  const {service} = fixture();
  const grant = await service.authorizeUpload(ids.audio, {contentType: 'audio/mpeg', contentLength: CREATOR_MAX_AUDIO_BYTES}, actor);
  const result = await service.confirmUpload(ids.audio, {uploadToken: grant.uploadToken}, actor);
  assert.equal(result.processingStatus, 'READY');
  assert.equal(result.fileSize, CREATOR_MAX_AUDIO_BYTES);
  assert.equal(result.durationSec, CREATOR_MAX_DURATION_SEC);
});

test('V2 rejects creator uploads over size or duration limits', async () => {
  const oversized = fixture();
  await assert.rejects(() => oversized.service.authorizeUpload(ids.audio, {contentType: 'audio/mpeg', contentLength: CREATOR_MAX_AUDIO_BYTES + 1}, actor), error => error.code === 'MEDIA_TOO_LARGE');
  const tooLong = fixture({durationSec: CREATOR_MAX_DURATION_SEC + 1});
  const grant = await tooLong.service.authorizeUpload(ids.audio, {contentType: 'audio/mpeg', contentLength: 100}, actor);
  await assert.rejects(() => tooLong.service.confirmUpload(ids.audio, {uploadToken: grant.uploadToken}, actor), error => error.code === 'MEDIA_TOO_LONG');
});
