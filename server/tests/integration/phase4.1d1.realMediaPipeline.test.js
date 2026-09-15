const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {
  S3Client, HeadBucketCommand, CreateBucketCommand, DeleteBucketCommand, DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const {
  EXPECTED_DATABASE, EXPECTED_BUCKET, loadPhase41d1Environment, assertMinioHealthy, assertApprovedDatabase,
} = require('./phase41d1TestEnvironment');

// This loader deliberately runs before the application is imported. It is only
// used by npm run test:integration:media and never by npm start or npm test.
const d1 = loadPhase41d1Environment();
const app = require('../../app');
const {connectDatabase, disconnectDatabase, getDatabaseStatus} = require('../../src/config/database');
const {User, Story, Chapter, Audio} = require('../../src/models');
const {getStorageProvider} = require('../../src/media/storage');
const {DefaultMediaInspector} = require('../../src/media/inspection');
const {UploadGrantService} = require('../../src/media/upload');
const {signAccessToken} = require('../../src/utils/jwt');
const {ROLES, AUTHOR_STATUS, ACCOUNT_STATUS} = require('../../src/constants/roles');
const storyService = require('../../src/modules/stories/storyService');
const chapterService = require('../../src/modules/chapters/chapterService');
const audioService = require('../../src/modules/audio/audioService');

function assertConnectedTestDatabase() {
  const status = getDatabaseStatus();
  assert.equal(status.state, 'CONNECTED');
  assert.equal(status.database, EXPECTED_DATABASE);
  assertApprovedDatabase(status.database);
}

function createWavFixture() {
  const sampleRate = 8_000;
  const samples = sampleRate;
  const dataSize = samples * 2;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < samples; index += 1) {
    wav.writeInt16LE(Math.round(Math.sin((index / sampleRate) * Math.PI * 2 * 440) * 4_000), 44 + (index * 2));
  }
  return wav;
}

async function closeServer(server) {
  if (server?.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

async function responseJson(response) {
  const body = await response.json();
  return {response, body};
}

function localS3Client(storage) {
  return new S3Client({
    endpoint: storage.endpoint,
    region: storage.region,
    forcePathStyle: true,
    credentials: storage.credentials,
  });
}

async function ensureTestBucket(client) {
  try {
    await client.send(new HeadBucketCommand({Bucket: EXPECTED_BUCKET}));
    return false;
  } catch {
    try {
      await client.send(new CreateBucketCommand({Bucket: EXPECTED_BUCKET}));
      return true;
    } catch {
      throw new Error('PHASE41D1_ENVIRONMENT_SAFETY_ERROR: local MinIO credentials cannot access the approved D1 test bucket');
    }
  }
}

test('Phase 4.1D1 runs the real MongoDB + MinIO WAV upload and playback pipeline only in the isolated test environment', {timeout: 120_000}, async () => {
  const fixture = createWavFixture();
  const storage = getStorageProvider();
  const inspector = new DefaultMediaInspector();
  const grants = new UploadGrantService();
  const infrastructure = localS3Client(d1.storage);
  const createdKeys = new Set();
  let bucketCreated = false;
  let apiServer;

  try {
    await assertMinioHealthy(d1.storage);
    bucketCreated = await ensureTestBucket(infrastructure);
    await connectDatabase(process.env.MONGODB_TEST_URI);
    assertConnectedTestDatabase();
    await User.db.dropDatabase();

    await Promise.all([User.init(), Story.init(), Chapter.init(), Audio.init()]);

    const suffix = Date.now().toString(36);
    const creatorDocument = await User.create({
      username: `phase41d1-creator-${suffix}`,
      email: `phase41d1-creator-${suffix}@example.test`,
      passwordHash: 'integration-fixture-only',
      role: ROLES.USER,
      authorStatus: AUTHOR_STATUS.APPROVED,
      accountStatus: ACCOUNT_STATUS.ACTIVE,
      emailVerified: true,
      tokenVersion: 0,
    });
    const creator = {
      id: String(creatorDocument._id), role: ROLES.USER, authorStatus: AUTHOR_STATUS.APPROVED,
      accountStatus: ACCOUNT_STATUS.ACTIVE, emailVerified: true, tokenVersion: 0,
    };
    const admin = {id: creator.id, role: ROLES.ADMIN, authorStatus: AUTHOR_STATUS.NONE};
    const story = await Story.create({
      creatorId: creator.id, title: 'Phase 4.1D1 disposable story', slug: `phase-41d1-${suffix}`,
      description: 'Disposable real media integration fixture', status: 'ONGOING', reviewStatus: 'DRAFT', visibility: 'PRIVATE',
    });
    const chapter = await Chapter.create({
      storyId: story._id, creatorId: creator.id, chapterNumber: 1, title: 'Disposable chapter',
      slug: `1-phase-41d1-${suffix}`, status: 'DRAFT',
    });
    const createdAudio = await audioService.create({chapterId: String(chapter._id), title: 'Real WAV integration audio'}, creator);
    const initial = await Audio.findById(createdAudio.id).lean().exec();
    assert.equal(initial.storageKey, null, 'real Mongo must persist initial storageKey as null for CAS');
    assert.equal(initial.processingStatus, 'PENDING');
    assert.equal(initial.status, 'DRAFT');
    assert.equal(initial.audioUrl, `/api/audio/${createdAudio.id}/playback`);

    apiServer = http.createServer(app);
    await new Promise(resolve => apiServer.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${apiServer.address().port}`;
    const auth = {Authorization: `Bearer ${signAccessToken(creator)}`, 'Content-Type': 'application/json'};

    const authorization = await responseJson(await fetch(`${baseUrl}/api/audio/${createdAudio.id}/upload-url`, {
      method: 'POST', headers: auth, body: JSON.stringify({contentType: 'audio/wav', contentLength: fixture.length}),
    }));
    assert.equal(authorization.response.status, 200);
    const grant = authorization.body.data;
    assert.equal(grant.method, 'PUT');
    assert.equal(grant.headers['Content-Type'], 'audio/wav');
    assert.equal(grant.headers['If-None-Match'], '*');
    assert.equal(typeof grant.uploadToken, 'string');
    const token = grants.verify(grant.uploadToken);
    assert.equal(token.expectedStorageKey, null);
    assert.equal(token.expectedProcessingStatus, 'PENDING');
    createdKeys.add(token.pendingKey);
    createdKeys.add(token.finalKey);

    const firstPut = await fetch(grant.uploadUrl, {method: grant.method, headers: grant.headers, body: fixture});
    assert.ok(firstPut.ok, `first presigned PUT failed with ${firstPut.status}`);
    const secondPut = await fetch(grant.uploadUrl, {method: grant.method, headers: grant.headers, body: fixture});
    assert.equal(secondPut.status, 412, 'MinIO must reject a write-once retry with Precondition Failed');

    const pendingHead = await storage.headObject({key: token.pendingKey});
    assert.equal(pendingHead.size, fixture.length);
    assert.equal(typeof pendingHead.etag, 'string');
    assert.ok(pendingHead.etag.length > 0);
    assert.ok(pendingHead.lastModified instanceof Date);
    const conditional = await storage.openReadStream({key: token.pendingKey, ifMatch: pendingHead.etag});
    const inspection = await inspector.inspectAudio({stream: conditional.stream, size: pendingHead.size});
    assert.equal(inspection.detectedMimeType, 'audio/wav');
    assert.equal(inspection.container, 'WAV');
    assert.equal(inspection.codec, 'PCM_S16LE');
    assert.ok(inspection.durationSec > 0);
    assert.ok(inspection.bitrate > 0);
    await assert.rejects(
      () => storage.openReadStream({key: token.pendingKey, ifMatch: '"phase41d1-wrong-etag"'}),
      error => error.code === 'OBJECT_VALIDATION_FAILED'
    );

    const confirmation = await responseJson(await fetch(`${baseUrl}/api/audio/${createdAudio.id}/upload-confirm`, {
      method: 'POST', headers: auth, body: JSON.stringify({uploadToken: grant.uploadToken}),
    }));
    assert.equal(confirmation.response.status, 200);
    assert.equal(confirmation.body.data.processingStatus, 'READY');
    const stored = await Audio.findById(createdAudio.id).lean().exec();
    assert.equal(stored.processingStatus, 'READY');
    assert.notEqual(stored.processingStatus, 'PROCESSING');
    assert.equal(stored.storageKey, token.finalKey);
    assert.equal(stored.audioUrl, `/api/audio/${createdAudio.id}/playback`);
    assert.equal(stored.fileSize, fixture.length);
    assert.equal(stored.mimeType, 'audio/wav');
    assert.ok(stored.durationSec > 0);
    assert.ok(stored.bitrate > 0);
    assert.equal(stored.status, 'DRAFT');
    const finalHead = await storage.headObject({key: token.finalKey});
    assert.equal(finalHead.size, fixture.length);
    assert.equal(finalHead.contentType, 'audio/wav');

    const retry = await responseJson(await fetch(`${baseUrl}/api/audio/${createdAudio.id}/upload-confirm`, {
      method: 'POST', headers: auth, body: JSON.stringify({uploadToken: grant.uploadToken}),
    }));
    assert.equal(retry.response.status, 200);
    assert.equal(retry.body.data.storageKey, token.finalKey);
    assert.equal(await Audio.countDocuments({_id: createdAudio.id}), 1);

    await storyService.moderate(String(story._id), 'APPROVED', admin);
    await chapterService.moderate(String(chapter._id), 'APPROVED', admin);
    await audioService.moderate(createdAudio.id, 'APPROVED', admin);
    assert.equal((await Audio.findById(createdAudio.id).lean().exec()).isPrimary, false);

    const playback = await fetch(`${baseUrl}/api/audio/${createdAudio.id}/playback`, {redirect: 'manual'});
    assert.equal(playback.status, 302);
    assert.match(playback.headers.get('cache-control') || '', /private, no-store/);
    assert.equal(playback.headers.get('referrer-policy'), 'no-referrer');
    const signedLocation = playback.headers.get('location');
    assert.ok(signedLocation);
    const signedGet = await fetch(signedLocation);
    assert.equal(signedGet.status, 200);
    assert.match(signedGet.headers.get('content-type') || '', /^audio\/wav/);
    assert.deepEqual(Buffer.from(await signedGet.arrayBuffer()), fixture);
    const range = await fetch(signedLocation, {headers: {Range: 'bytes=0-99'}});
    assert.equal(range.status, 206);
    assert.equal(range.headers.get('content-range'), `bytes 0-99/${fixture.length}`);
    assert.equal(range.headers.get('content-length'), '100');
    assert.match(range.headers.get('content-type') || '', /^audio\/wav/);
    assert.equal(range.headers.get('accept-ranges'), 'bytes');
    assert.equal((await range.arrayBuffer()).byteLength, 100);

    const unsigned = await fetch(`${d1.storage.endpoint}/${EXPECTED_BUCKET}/${token.finalKey}`, {redirect: 'manual'});
    assert.notEqual(unsigned.status, 200, 'test bucket must keep canonical media private');

    await audioService.remove(createdAudio.id, creator);
    const denied = await fetch(`${baseUrl}/api/audio/${createdAudio.id}/playback`, {redirect: 'manual'});
    assert.equal(denied.status, 404);
    assert.equal((await storage.headObject({key: token.finalKey})).size, fixture.length, 'soft delete must not delete retained blob');
  } finally {
    await closeServer(apiServer);
    const teardown = loadPhase41d1Environment();
    await assertMinioHealthy(teardown.storage);
    if (getDatabaseStatus().state === 'CONNECTED') {
      assertConnectedTestDatabase();
      await User.db.dropDatabase();
      await disconnectDatabase();
    }
    for (const key of createdKeys) {
      await infrastructure.send(new DeleteObjectCommand({Bucket: EXPECTED_BUCKET, Key: key})).catch(() => {});
    }
    if (bucketCreated) {
      await infrastructure.send(new DeleteBucketCommand({Bucket: EXPECTED_BUCKET})).catch(() => {});
    }
    infrastructure.destroy();
    storage.client?.destroy();
  }
});
