const test = require('node:test');
const assert = require('node:assert/strict');
const {Readable} = require('node:stream');
const jwt = require('jsonwebtoken');

const {
  DefaultMediaInspector,
  MediaInspectionError,
  MAX_MEDIA_BYTES,
  MAX_DURATION_SEC,
} = require('../src/media/inspection');
const {
  UploadGrantService,
  UPLOAD_AUDIENCE,
  UPLOAD_PURPOSE,
  UPLOAD_TTL_SEC,
  UploadGrantError,
} = require('../src/media/upload');

const SECRET = 'upload-grant-test-secret-at-least-thirty-two-bytes';
const OTHER_SECRET = 'other-upload-grant-secret-at-least-thirty-two-bytes';
const AUDIO_ID = '507f1f77bcf86cd799439011';
const ACTOR_ID = '507f1f77bcf86cd799439012';
const UPDATED_AT = '2026-09-12T00:00:00.000Z';

function stream() { return Readable.from([Buffer.from([0x00])]); }
function metadata(format) { return {format: {hasAudio: true, duration: 30, bitrate: 128000, ...format}}; }
function parserFor(result) { return async (input, fileInfo, options) => {
  assert.ok(input && typeof input.pipe === 'function');
  assert.deepEqual(fileInfo, {size: 1});
  assert.deepEqual(options, {duration: true});
  return result;
}; }
function grantInput(overrides = {}) {
  return {
    audioId: AUDIO_ID,
    actorId: ACTOR_ID,
    pendingKey: `uploads/pending/${AUDIO_ID}/candidate-nonce`,
    finalKey: `audio/${AUDIO_ID}/candidate-nonce.mp3`,
    expectedStorageKey: null,
    expectedProcessingStatus: 'PENDING',
    expectedUpdatedAt: UPDATED_AT,
    contentTypeHint: 'audio/mpeg',
    maxBytes: 250 * 1024 * 1024,
    ...overrides,
  };
}
function grantService() { return new UploadGrantService({secret: SECRET, uuid: () => 'test-jti'}); }
function tokenPayload(input = grantInput()) { return {...input, aud: UPLOAD_AUDIENCE, purpose: UPLOAD_PURPOSE, jti: 'test-jti'}; }

test('MediaInspector maps trusted MP3, AAC-LC M4A, and PCM S16LE WAV parser metadata', async () => {
  const mp3 = new DefaultMediaInspector({parseStream: parserFor(metadata({container: 'MPEG', codec: 'MPEG 1 Layer 3'}))});
  assert.deepEqual(await mp3.inspectAudio({stream: stream(), size: 1}), {
    detectedMimeType: 'audio/mpeg', container: 'MP3', codec: 'MP3', extension: 'mp3', durationSec: 30, bitrate: 128000,
  });
  const m4a = new DefaultMediaInspector({parseStream: parserFor(metadata({container: 'MPEG-4', codec: 'AAC', codecProfile: 'LC'}))});
  assert.deepEqual(await m4a.inspectAudio({stream: stream(), size: 1}), {
    detectedMimeType: 'audio/mp4', container: 'MP4', codec: 'AAC_LC', extension: 'm4a', durationSec: 30, bitrate: 128000,
  });
  const wav = new DefaultMediaInspector({parseStream: parserFor(metadata({container: 'WAVE', codec: 'PCM', bitsPerSample: 16}))});
  assert.deepEqual(await wav.inspectAudio({stream: stream(), size: 1}), {
    detectedMimeType: 'audio/wav', container: 'WAV', codec: 'PCM_S16LE', extension: 'wav', durationSec: 30, bitrate: 128000,
  });
});

test('MediaInspector rejects unsupported codecs, raw AAC, OGG, and invalid metadata without parser leakage', async () => {
  const rejected = [
    metadata({container: 'MPEG-4', codec: 'ALAC', codecProfile: 'LC'}),
    metadata({container: 'WAVE', codec: 'PCM', bitsPerSample: 24}),
    metadata({container: 'Ogg', codec: 'Opus'}),
    metadata({container: 'ADTS', codec: 'AAC'}),
  ];
  for (const result of rejected) {
    const inspector = new DefaultMediaInspector({parseStream: parserFor(result)});
    await assert.rejects(() => inspector.inspectAudio({stream: stream(), size: 1}), error => error instanceof MediaInspectionError && error.code === 'UNSUPPORTED_MEDIA');
  }
  const invalidDuration = new DefaultMediaInspector({parseStream: parserFor(metadata({container: 'MPEG', codec: 'MPEG 1 Layer 3', duration: MAX_DURATION_SEC + 1}))});
  await assert.rejects(() => invalidDuration.inspectAudio({stream: stream(), size: 1}), error => error.code === 'OBJECT_VALIDATION_FAILED');
  const invalidBitrate = new DefaultMediaInspector({parseStream: parserFor(metadata({container: 'MPEG', codec: 'MPEG 1 Layer 3', bitrate: 0}))});
  await assert.rejects(() => invalidBitrate.inspectAudio({stream: stream(), size: 1}), error => error.code === 'OBJECT_VALIDATION_FAILED');
});

test('MediaInspector validates size and stream input before invoking a parser', async () => {
  let called = false;
  const inspector = new DefaultMediaInspector({parseStream: async () => { called = true; return metadata({container: 'MPEG', codec: 'MPEG 1 Layer 3'}); }});
  await assert.rejects(() => inspector.inspectAudio({stream: stream(), size: 0}), error => error.code === 'OBJECT_VALIDATION_FAILED');
  await assert.rejects(() => inspector.inspectAudio({stream: stream(), size: MAX_MEDIA_BYTES + 1}), error => error.code === 'MEDIA_TOO_LARGE');
  await assert.rejects(() => inspector.inspectAudio({stream: {}, size: 1}), error => error.code === 'OBJECT_VALIDATION_FAILED');
  assert.equal(called, false);
});

test('MediaInspector passes through the Node stream and normalizes parser or stream failures', async () => {
  const input = stream();
  let received;
  const inspector = new DefaultMediaInspector({parseStream: async receivedStream => {
    received = receivedStream;
    throw new Error('parser internals and raw bytes must stay private');
  }});
  await assert.rejects(() => inspector.inspectAudio({stream: input, size: 1}), error => error.code === 'OBJECT_VALIDATION_FAILED' && !error.message.includes('parser internals'));
  assert.equal(received, input);
  const failingStream = new Readable({read() {}});
  const streamInspector = new DefaultMediaInspector({parseStream: inputStream => new Promise((resolve, reject) => {
    inputStream.once('error', reject);
    inputStream.destroy(new Error('stream failure'));
  })});
  await assert.rejects(() => streamInspector.inspectAudio({stream: failingStream, size: 1}), error => error.code === 'OBJECT_VALIDATION_FAILED' && !error.message.includes('stream failure'));
});

test('MediaInspector performs a real bounded parser integration against a minimal in-memory PCM S16LE WAV fixture', async () => {
  const wav = Buffer.alloc(46);
  wav.write('RIFF'); wav.writeUInt32LE(38, 4); wav.write('WAVE', 8); wav.write('fmt ', 12); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(2, 40);
  const result = await new DefaultMediaInspector().inspectAudio({stream: Readable.from([wav]), size: wav.length});
  assert.equal(result.detectedMimeType, 'audio/wav');
  assert.equal(result.container, 'WAV');
  assert.equal(result.codec, 'PCM_S16LE');
  assert.equal(result.extension, 'wav');
  assert.equal(result.bitrate, 128000);
  assert.ok(result.durationSec > 0);
});

test('MediaInspector normalizes real empty and malformed stream parser failures', async () => {
  const inspector = new DefaultMediaInspector();
  await assert.rejects(
    () => inspector.inspectAudio({stream: Readable.from([]), size: 1}),
    error => error.code === 'OBJECT_VALIDATION_FAILED' && !error.message.includes('music-metadata')
  );
  await assert.rejects(
    () => inspector.inspectAudio({stream: Readable.from([Buffer.from('not audio')]), size: 9}),
    error => error.code === 'OBJECT_VALIDATION_FAILED' && !error.message.includes('not audio')
  );
});

test('UploadGrantService issues and verifies every locked claim with a separate HS256 secret', () => {
  const service = grantService();
  const issued = service.issue(grantInput());
  const claims = service.verify(issued.token);
  assert.equal(claims.aud, UPLOAD_AUDIENCE);
  assert.equal(claims.purpose, UPLOAD_PURPOSE);
  assert.equal(claims.audioId, AUDIO_ID);
  assert.equal(claims.actorId, ACTOR_ID);
  assert.equal(claims.pendingKey, `uploads/pending/${AUDIO_ID}/candidate-nonce`);
  assert.equal(claims.finalKey, `audio/${AUDIO_ID}/candidate-nonce.mp3`);
  assert.equal(claims.expectedStorageKey, null);
  assert.equal(claims.expectedProcessingStatus, 'PENDING');
  assert.equal(claims.expectedUpdatedAt, UPDATED_AT);
  assert.equal(claims.contentTypeHint, 'audio/mpeg');
  assert.equal(claims.maxBytes, 250 * 1024 * 1024);
  assert.equal(claims.jti, 'test-jti');
  assert.ok(claims.exp - claims.iat <= UPLOAD_TTL_SEC);
  assert.ok(issued.expiresAt instanceof Date);
  assert.equal(service.verify(service.issue(grantInput({expectedStorageKey: `audio/${AUDIO_ID}/old.mp3`, expectedProcessingStatus: 'READY'})).token).expectedProcessingStatus, 'READY');
  const extensionless = service.verify(service.issue(grantInput({finalKey: `audio/${AUDIO_ID}/canonical-nonce`})).token);
  assert.equal(extensionless.finalKey, `audio/${AUDIO_ID}/canonical-nonce`);
});

test('UploadGrantService rejects weak configuration, unsafe issue inputs, and malformed claim boundaries', () => {
  assert.throws(() => new UploadGrantService({secret: 'secret'}), error => error.code === 'UPLOAD_GRANT_CONFIGURATION_ERROR');
  const service = grantService();
  for (const invalid of [
    grantInput({audioId: 'bad-id'}),
    grantInput({pendingKey: `audio/${AUDIO_ID}/wrong-prefix`}),
    grantInput({finalKey: `uploads/pending/${AUDIO_ID}/wrong-prefix`}),
    grantInput({expectedStorageKey: undefined}),
    grantInput({expectedUpdatedAt: '2026-09-12'}),
    grantInput({maxBytes: 0}),
    grantInput({maxBytes: MAX_MEDIA_BYTES + 1}),
  ]) {
    assert.throws(() => service.issue(invalid), error => error.code === 'INVALID_UPLOAD_TOKEN');
  }
});

test('UploadGrantService rejects expiration, tampering, wrong secrets, audience, purpose, and algorithm confusion', () => {
  const service = grantService();
  const issued = service.issue(grantInput());
  const parts = issued.token.split('.');
  const tamperedPayload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  tamperedPayload.audioId = ACTOR_ID;
  const tampered = `${parts[0]}.${Buffer.from(JSON.stringify(tamperedPayload)).toString('base64url')}.${parts[2]}`;
  assert.throws(() => service.verify(tampered), error => error.code === 'INVALID_UPLOAD_TOKEN' && !error.message.includes('signature'));
  const expired = jwt.sign(tokenPayload(), SECRET, {algorithm: 'HS256', expiresIn: -1});
  assert.throws(() => service.verify(expired), error => error.code === 'UPLOAD_EXPIRED');
  const wrongSecret = jwt.sign(tokenPayload(), OTHER_SECRET, {algorithm: 'HS256', expiresIn: 60});
  assert.throws(() => service.verify(wrongSecret), error => error.code === 'INVALID_UPLOAD_TOKEN' && !error.message.includes(OTHER_SECRET));
  const wrongAudience = jwt.sign({...tokenPayload(), aud: 'access'}, SECRET, {algorithm: 'HS256', expiresIn: 60});
  assert.throws(() => service.verify(wrongAudience), error => error.code === 'INVALID_UPLOAD_TOKEN');
  const wrongPurpose = jwt.sign({...tokenPayload(), purpose: 'ACCESS_TOKEN'}, SECRET, {algorithm: 'HS256', expiresIn: 60});
  assert.throws(() => service.verify(wrongPurpose), error => error.code === 'INVALID_UPLOAD_TOKEN');
  const wrongAlgorithm = jwt.sign(tokenPayload(), SECRET, {algorithm: 'HS384', expiresIn: 60});
  assert.throws(() => service.verify(wrongAlgorithm), error => error.code === 'INVALID_UPLOAD_TOKEN');
  const authJwt = jwt.sign({sub: AUDIO_ID, type: 'access'}, 'development-only-change-me', {algorithm: 'HS256', expiresIn: 60});
  assert.throws(() => service.verify(authJwt), error => error.code === 'INVALID_UPLOAD_TOKEN');
});

test('UploadGrantService rejects tokens with missing claims or invalid signed claim data without raw JWT errors', () => {
  const service = grantService();
  const payload = tokenPayload();
  delete payload.finalKey;
  const missingClaim = jwt.sign(payload, SECRET, {algorithm: 'HS256', expiresIn: 60});
  assert.throws(() => service.verify(missingClaim), error => error.code === 'INVALID_UPLOAD_TOKEN' && !error.message.includes('jwt'));
  const malformedIdentity = jwt.sign(tokenPayload({...grantInput({actorId: 'bad'})}), SECRET, {algorithm: 'HS256', expiresIn: 60});
  assert.throws(() => service.verify(malformedIdentity), error => error.code === 'INVALID_UPLOAD_TOKEN');
});

test('media foundations import and construct without database, storage, network, or token issuance side effects', () => {
  assert.equal(typeof require('../src/media/inspection').DefaultMediaInspector, 'function');
  assert.equal(typeof require('../src/media/upload').UploadGrantService, 'function');
});
