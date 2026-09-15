const test = require('node:test');
const assert = require('node:assert/strict');
const {Readable} = require('node:stream');
const {AudioMediaService} = require('../src/modules/audio/audioMediaService');
const {UploadGrantService} = require('../src/media/upload');
const {AudioMongoRepository} = require('../src/repositories/mongo/AudioMongoRepository');
const mongoose = require('mongoose');

const AUDIO_ID = '507f1f77bcf86cd799439011';
const CHAPTER_ID = '507f1f77bcf86cd799439012';
const STORY_ID = '507f1f77bcf86cd799439013';
const USER_ID = '507f1f77bcf86cd799439014';
const NOW = '2026-09-12T00:00:00.000Z';
const user = {id: USER_ID, role: 'USER', authorStatus: 'APPROVED'};

function fixture({status = 'DRAFT', processingStatus = 'PENDING', storageKey = null} = {}) {
  const audio = {id: AUDIO_ID, chapterId: CHAPTER_ID, storyId: STORY_ID, creatorId: USER_ID, status, processingStatus, storageKey, updatedAt: NOW, deletedAt: null, audioUrl: `/api/audio/${AUDIO_ID}/playback`, fileSize: storageKey ? 10 : null, mimeType: storageKey ? 'audio/mpeg' : null, durationSec: storageKey ? 1 : null, bitrate: storageKey ? 128000 : null};
  const calls = {presign: [], head: [], read: [], copy: [], commit: []};
  const repositories = {
    audio: {
      async findById() { return audio.deletedAt ? null : audio; },
      async commitMediaUpload(id, snapshot, media) {
        calls.commit.push({id, snapshot, media});
        if (audio.deletedAt || audio.storageKey !== snapshot.expectedStorageKey || audio.processingStatus !== snapshot.expectedProcessingStatus || audio.updatedAt !== snapshot.expectedUpdatedAt || !snapshot.allowedStatuses.includes(audio.status)) return null;
        Object.assign(audio, media, {updatedAt: '2026-09-12T00:00:01.000Z'});
        return audio;
      },
    },
    chapter: {async findById(id) { return id === CHAPTER_ID ? {id: CHAPTER_ID, storyId: STORY_ID} : null; }},
    story: {async findById(id) { return id === STORY_ID ? {id: STORY_ID, creatorId: USER_ID} : null; }},
  };
  const storage = {
    async createDirectUpload(input) { calls.presign.push(input); return {url: 'https://signed.invalid/put', method: 'PUT', headers: {'If-None-Match': '*'}, expiresAt: new Date('2026-09-12T00:10:00.000Z')}; },
    async headObject(input) { calls.head.push(input); return {size: 100, etag: '"etag-1"', contentType: 'untrusted/type'}; },
    async openReadStream(input) { calls.read.push(input); return {stream: Readable.from([Buffer.from('fixture')]), size: 100}; },
    async copyObject(input) { calls.copy.push(input); },
  };
  const inspector = {async inspectAudio() { return {detectedMimeType: 'audio/mpeg', container: 'MP3', codec: 'MP3', extension: 'mp3', durationSec: 1, bitrate: 128000}; }};
  const grants = new UploadGrantService({secret: 'upload-grant-test-secret-at-least-thirty-two-bytes', uuid: () => 'nonce-token'});
  const service = new AudioMediaService({repositories, storageProvider: storage, inspector, grantService: grants, policy: {maxBytes: 250 * 1024 * 1024, hardMaxBytes: 500 * 1024 * 1024, uploadTtlSec: 600}, nonce: () => 'nonce-key'});
  return {audio, calls, storage, inspector, grants, service};
}

test('C2 authorizes an approved owner with server-generated extensionless keys and write-once presign', async () => {
  const {service, calls, grants} = fixture();
  const result = await service.authorizeUpload(AUDIO_ID, {contentType: 'audio/mpeg', contentLength: 100, filename: '../ignored.mp3'}, user);
  assert.deepEqual(calls.presign[0], {key: `uploads/pending/${AUDIO_ID}/nonce-key`, contentTypeHint: 'audio/mpeg', expiresInSec: 600});
  assert.equal(result.headers['If-None-Match'], '*');
  const token = grants.verify(result.uploadToken);
  assert.equal(token.pendingKey, `uploads/pending/${AUDIO_ID}/nonce-key`);
  assert.equal(token.finalKey, `audio/${AUDIO_ID}/nonce-key`);
  assert.equal(token.expectedStorageKey, null);
  assert.equal(token.maxBytes, 250 * 1024 * 1024);
});

test('C2 confirms with ETag-pinned inspection, canonical copy, and trusted READY CAS only', async () => {
  const {service, calls, audio} = fixture();
  const grant = await service.authorizeUpload(AUDIO_ID, {contentType: 'audio/wav', contentLength: 100}, user);
  const committed = await service.confirmUpload(AUDIO_ID, {uploadToken: grant.uploadToken}, user);
  assert.equal(committed.processingStatus, 'READY');
  assert.equal(committed.storageKey, `audio/${AUDIO_ID}/nonce-key`);
  assert.equal(committed.mimeType, 'audio/mpeg');
  assert.equal(audio.status, 'DRAFT');
  assert.deepEqual(calls.read[0], {key: `uploads/pending/${AUDIO_ID}/nonce-key`, ifMatch: '"etag-1"'});
  assert.deepEqual(calls.copy[0], {sourceKey: `uploads/pending/${AUDIO_ID}/nonce-key`, destinationKey: `audio/${AUDIO_ID}/nonce-key`, contentType: 'audio/mpeg', sourceETag: '"etag-1"'});
  assert.equal(calls.commit[0].media.audioUrl, `/api/audio/${AUDIO_ID}/playback`);
  assert.equal(calls.commit[0].media.processingStatus, 'READY');
});

test('C2 same-token retry skips storage and CAS after READY final key is committed', async () => {
  const {service, calls} = fixture();
  const grant = await service.authorizeUpload(AUDIO_ID, {contentType: 'audio/mpeg', contentLength: 100}, user);
  await service.confirmUpload(AUDIO_ID, {uploadToken: grant.uploadToken}, user);
  const before = {head: calls.head.length, read: calls.read.length, copy: calls.copy.length, commit: calls.commit.length};
  await service.confirmUpload(AUDIO_ID, {uploadToken: grant.uploadToken}, user);
  assert.deepEqual({head: calls.head.length, read: calls.read.length, copy: calls.copy.length, commit: calls.commit.length}, before);
});

test('C2 rejects stale, forbidden, unsupported, oversized, and approved replacement authorization before presign', async () => {
  const rejected = fixture({status: 'APPROVED', processingStatus: 'READY', storageKey: 'audio/old'});
  await assert.rejects(() => rejected.service.authorizeUpload(AUDIO_ID, {contentType: 'audio/mpeg', contentLength: 1}, user), error => error.code === 'UPLOAD_CONFLICT');
  assert.equal(rejected.calls.presign.length, 0);
  const unapproved = fixture();
  await assert.rejects(() => unapproved.service.authorizeUpload(AUDIO_ID, {contentType: 'audio/aac', contentLength: 1}, {...user, authorStatus: 'NONE'}), error => error.code === 'AUTHOR_NOT_APPROVED');
  const oversize = fixture();
  await assert.rejects(() => oversize.service.authorizeUpload(AUDIO_ID, {contentType: 'audio/mpeg', contentLength: 250 * 1024 * 1024 + 1}, user), error => error.code === 'MEDIA_TOO_LARGE');
  const stale = fixture();
  const grant = await stale.service.authorizeUpload(AUDIO_ID, {contentType: 'audio/mpeg', contentLength: 1}, user);
  stale.audio.updatedAt = '2026-09-12T00:00:02.000Z';
  await assert.rejects(() => stale.service.confirmUpload(AUDIO_ID, {uploadToken: grant.uploadToken}, user), error => error.code === 'UPLOAD_SUPERSEDED');
  assert.equal(stale.calls.head.length, 0);
});

test('C2 candidate failure and CAS loss do not poison Audio or overwrite another winner', async () => {
  const invalid = fixture();
  invalid.inspector.inspectAudio = async () => { const error = new Error('bad media'); error.code = 'UNSUPPORTED_MEDIA'; error.name = 'MediaInspectionError'; throw error; };
  const badGrant = await invalid.service.authorizeUpload(AUDIO_ID, {contentType: 'audio/mpeg', contentLength: 1}, user);
  await assert.rejects(() => invalid.service.confirmUpload(AUDIO_ID, {uploadToken: badGrant.uploadToken}, user), error => error.code === 'INTERNAL_SERVER_ERROR');
  assert.equal(invalid.audio.processingStatus, 'PENDING');
  assert.equal(invalid.calls.commit.length, 0);
  const race = fixture();
  const raceGrant = await race.service.authorizeUpload(AUDIO_ID, {contentType: 'audio/mpeg', contentLength: 1}, user);
  race.repositories = undefined;
  race.audio.storageKey = 'audio/winner'; race.audio.processingStatus = 'READY'; race.audio.updatedAt = '2026-09-12T00:00:03.000Z';
  await assert.rejects(() => race.service.confirmUpload(AUDIO_ID, {uploadToken: raceGrant.uploadToken}, user), error => error.code === 'UPLOAD_SUPERSEDED');
});

test('C2 repository CAS filters the exact snapshot and updates trusted media fields only', async () => {
  const captures = {};
  const id = new mongoose.Types.ObjectId();
  const model = {
    findOneAndUpdate(filter, update, options) {
      captures.filter = filter; captures.update = update; captures.options = options;
      return {lean() { return {exec: async () => null}; }};
    },
  };
  const repository = new AudioMongoRepository(model);
  const result = await repository.commitMediaUpload(String(id), {
    expectedStorageKey: null, expectedProcessingStatus: 'PENDING', expectedUpdatedAt: NOW,
    allowedStatuses: ['DRAFT', 'REJECTED', 'APPROVED'],
  }, {
    storageKey: 'audio/key', audioUrl: `/api/audio/${id}/playback`, fileSize: 100,
    mimeType: 'audio/mpeg', durationSec: 1, bitrate: 128000, processingStatus: 'READY', status: 'APPROVED', creatorId: USER_ID,
  });
  assert.equal(result, null);
  assert.equal(captures.filter._id.toString(), id.toString());
  assert.equal(captures.filter.deletedAt, null);
  assert.equal(captures.filter.storageKey, null);
  assert.equal(captures.filter.processingStatus, 'PENDING');
  assert.deepEqual(captures.filter.status, {$in: ['DRAFT', 'REJECTED']});
  assert.deepEqual(Object.keys(captures.update.$set).sort(), ['audioUrl', 'bitrate', 'durationSec', 'fileSize', 'mimeType', 'processingStatus', 'storageKey']);
});
