const test = require('node:test');
const assert = require('node:assert/strict');
const {
  S3Client, HeadBucketCommand, CreateBucketCommand, DeleteBucketCommand, DeleteObjectCommand, PutObjectCommand,
} = require('@aws-sdk/client-s3');
const {
  EXPECTED_DATABASE, EXPECTED_BUCKET, loadPhase41d1Environment, assertMinioHealthy, assertApprovedDatabase,
} = require('./phase41d1TestEnvironment');

// This test loads the disposable local environment before application modules,
// and never falls back to development or production configuration.
const d1 = loadPhase41d1Environment();
const {connectDatabase, disconnectDatabase, getDatabaseStatus} = require('../../src/config/database');
const {User, Story, Chapter, Audio} = require('../../src/models');
const {getStorageProvider} = require('../../src/media/storage');
const {AudioMongoRepository} = require('../../src/repositories/mongo/AudioMongoRepository');
const {MediaCleanupService, DAY_MS, RETENTION_MS} = require('../../src/media/cleanup/MediaCleanupService');
const {AudioMediaService} = require('../../src/modules/audio/audioMediaService');
const audioService = require('../../src/modules/audio/audioService');
const {ROLES, AUTHOR_STATUS, ACCOUNT_STATUS} = require('../../src/constants/roles');

function assertConnectedTestDatabase() {
  const status = getDatabaseStatus();
  assert.equal(status.state, 'CONNECTED');
  assert.equal(status.database, EXPECTED_DATABASE);
  assertApprovedDatabase(status.database);
}

function localS3Client(storage) {
  return new S3Client({endpoint: storage.endpoint, region: storage.region, forcePathStyle: true, credentials: storage.credentials});
}

async function ensureTestBucket(client) {
  try { await client.send(new HeadBucketCommand({Bucket: EXPECTED_BUCKET})); return false; }
  catch {
    try { await client.send(new CreateBucketCommand({Bucket: EXPECTED_BUCKET})); return true; }
    catch { throw new Error('PHASE41D1_ENVIRONMENT_SAFETY_ERROR: local MinIO credentials cannot access approved test bucket'); }
  }
}

function wav() {
  const rate = 8000; const samples = rate; const output = Buffer.alloc(44 + (samples * 2));
  output.write('RIFF', 0); output.writeUInt32LE(36 + (samples * 2), 4); output.write('WAVEfmt ', 8);
  output.writeUInt32LE(16, 16); output.writeUInt16LE(1, 20); output.writeUInt16LE(1, 22);
  output.writeUInt32LE(rate, 24); output.writeUInt32LE(rate * 2, 28); output.writeUInt16LE(2, 32);
  output.writeUInt16LE(16, 34); output.write('data', 36); output.writeUInt32LE(samples * 2, 40);
  return output;
}

async function missing(storage, key) {
  await assert.rejects(() => storage.headObject({key}), error => error.code === 'OBJECT_NOT_FOUND');
}

test('Phase 4.1D2 verifies real MinIO lifecycle, atomic restore, and concurrent upload races in the isolated environment', {timeout: 180_000}, async () => {
  const raw = localS3Client(d1.storage);
  const storage = getStorageProvider();
  const media = new AudioMediaService();
  const repository = new AudioMongoRepository();
  const keys = new Set();
  let bucketCreated = false;
  const fixture = wav();
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const put = async key => { keys.add(key); await raw.send(new PutObjectCommand({Bucket: EXPECTED_BUCKET, Key: key, Body: fixture, ContentType: 'audio/wav'})); return storage.headObject({key}); };
  const cleanup = now => new MediaCleanupService({audioRepository: repository, storageProvider: storage, now: () => now, pageLimit: 1});

  try {
    await assertMinioHealthy(d1.storage);
    bucketCreated = await ensureTestBucket(raw);
    await connectDatabase(process.env.MONGODB_TEST_URI);
    assertConnectedTestDatabase();
    await User.db.dropDatabase();
    await Promise.all([User.init(), Story.init(), Chapter.init(), Audio.init()]);

    const creatorDocument = await User.create({
      username: `d2-creator-${suffix}`, email: `d2-creator-${suffix}@example.test`, passwordHash: 'integration-fixture-only',
      role: ROLES.USER, authorStatus: AUTHOR_STATUS.APPROVED, accountStatus: ACCOUNT_STATUS.ACTIVE, emailVerified: true, tokenVersion: 0,
    });
    const creator = {id: String(creatorDocument._id), role: ROLES.USER, authorStatus: AUTHOR_STATUS.APPROVED};
    const story = await Story.create({creatorId: creator.id, title: 'D2 story', slug: `d2-${suffix}`, description: 'Disposable D2 lifecycle fixture', status: 'ONGOING', reviewStatus: 'DRAFT', visibility: 'PRIVATE'});
    const chapter = await Chapter.create({storyId: story._id, creatorId: creator.id, chapterNumber: 1, title: 'D2 chapter', slug: `d2-${suffix}`, status: 'DRAFT'});
    let ordinal = 0;
    async function audio({storageKey = null, processingStatus = 'READY', deletedAt = null} = {}) {
      ordinal += 1;
      return Audio.create({storyId: story._id, chapterId: chapter._id, creatorId: creator.id, title: `D2 audio ${ordinal}`, audioUrl: '/api/audio/fixture/playback', storageKey, durationSec: 1, fileSize: fixture.length, mimeType: 'audio/wav', bitrate: 128000, sourceType: 'HUMAN', processingStatus, status: 'DRAFT', deletedAt, deletedBy: deletedAt ? creator.id : null});
    }

    // Real pending and real orphan boundaries, with a page limit of one to
    // exercise actual continuation-token pagination on local MinIO.
    const pendingKey = `uploads/pending/d2/${suffix}/pending`; const orphanKey = `audio/d2-orphan/${suffix}`;
    const pendingHead = await put(pendingKey); const orphanHead = await put(orphanKey);
    const youngNow = new Date(Math.max(pendingHead.lastModified, orphanHead.lastModified) + DAY_MS - 2_000);
    let result = await cleanup(youngNow).run();
    assert.equal((await storage.headObject({key: pendingKey})).size, fixture.length);
    assert.equal((await storage.headObject({key: orphanKey})).size, fixture.length);
    const expiredNow = new Date(Math.max(pendingHead.lastModified, orphanHead.lastModified) + DAY_MS + 2_000);
    result = await cleanup(expiredNow).run();
    assert.ok(result.pending.deleted >= 1); assert.ok(result.canonicalOrphan.deleted >= 1);
    await missing(storage, pendingKey); await missing(storage, orphanKey);
    // A second run is idempotent after lifecycle deletion.
    result = await cleanup(expiredNow).run();
    assert.equal(result.pending.deleted, 0); assert.equal(result.canonicalOrphan.deleted, 0);

    const activeKey = `audio/active/${suffix}`; const activeHead = await put(activeKey); const active = await audio({storageKey: activeKey});
    await cleanup(new Date(activeHead.lastModified.getTime() + 45 * DAY_MS)).run();
    assert.equal((await storage.headObject({key: activeKey})).size, fixture.length);

    // Soft-delete retention and restore/cleanup boundaries share the exact
    // strict/weak predicates: restore > cutoff, cleanup <= cutoff.
    const retained = await audio({deletedAt: new Date()});
    const retainedKey = `audio/${retained._id}/retained-${suffix}`; const retainedHead = await put(retainedKey);
    const deletedAt = new Date(retainedHead.lastModified);
    await Audio.updateOne({_id: retained._id}, {$set: {storageKey: retainedKey, deletedAt, deletedBy: creator.id}});
    const beforeCutoff = new Date(deletedAt.getTime() + RETENTION_MS - 1);
    result = await cleanup(beforeCutoff).run();
    assert.equal((await storage.headObject({key: retainedKey})).size, fixture.length);
    const restored = await audioService.restore(String(retained._id), creator, {now: beforeCutoff, repositories: require('../../src/repositories/contentRuntime').getContentRepositories(), storageProvider: storage});
    assert.equal(restored.deletedAt, null); assert.equal(restored.isPrimary, false);
    await cleanup(new Date(retainedHead.lastModified.getTime() + 45 * DAY_MS)).run();
    assert.equal((await storage.headObject({key: retainedKey})).size, fixture.length, 'active restore retains canonical blob');

    const missingAudio = await audio({deletedAt});
    const missingKey = `audio/${missingAudio._id}/missing-${suffix}`;
    await Audio.updateOne({_id: missingAudio._id}, {$set: {storageKey: missingKey, deletedAt, deletedBy: creator.id}});
    await assert.rejects(
      () => audioService.restore(String(missingAudio._id), creator, {now: beforeCutoff, repositories: require('../../src/repositories/contentRuntime').getContentRepositories(), storageProvider: storage}),
      error => error.code === 'OBJECT_NOT_FOUND'
    );
    assert.ok((await Audio.findById(missingAudio._id).lean().exec()).deletedAt, 'missing storage must not resurrect Mongo state');

    const deletedParentChapter = await Chapter.create({storyId: story._id, creatorId: creator.id, chapterNumber: 2, title: 'Deleted parent chapter', slug: `d2-parent-${suffix}`, status: 'DRAFT', deletedAt});
    const parentAudio = await Audio.create({storyId: story._id, chapterId: deletedParentChapter._id, creatorId: creator.id, title: 'Parent validation audio', audioUrl: '/api/audio/fixture/playback', storageKey: `audio/placeholder`, durationSec: 1, fileSize: fixture.length, mimeType: 'audio/wav', bitrate: 128000, sourceType: 'HUMAN', processingStatus: 'READY', status: 'DRAFT', deletedAt, deletedBy: creator.id});
    const parentKey = `audio/${parentAudio._id}/parent-${suffix}`; await put(parentKey);
    await Audio.updateOne({_id: parentAudio._id}, {$set: {storageKey: parentKey}});
    await assert.rejects(
      () => audioService.restore(String(parentAudio._id), creator, {now: beforeCutoff, repositories: require('../../src/repositories/contentRuntime').getContentRepositories(), storageProvider: storage}),
      error => error.code === 'RESTORE_CONFLICT'
    );

    const cutoffAudio = await audio({deletedAt});
    const cutoffKey = `audio/${cutoffAudio._id}/cutoff-${suffix}`; await put(cutoffKey);
    await Audio.updateOne({_id: cutoffAudio._id}, {$set: {storageKey: cutoffKey, deletedAt, deletedBy: creator.id}});
    const exactCutoff = new Date(deletedAt.getTime() + RETENTION_MS);
    await assert.rejects(() => audioService.restore(String(cutoffAudio._id), creator, {now: exactCutoff, repositories: require('../../src/repositories/contentRuntime').getContentRepositories(), storageProvider: storage}), error => error.code === 'RESTORE_RETENTION_EXPIRED');
    result = await cleanup(new Date(Math.max(exactCutoff.getTime(), (await storage.headObject({key: cutoffKey})).lastModified.getTime() + DAY_MS + 2_000))).run();
    assert.ok(result.softDeletedRetention.deleted >= 1); await missing(storage, cutoffKey);
    const cutoffDocument = await Audio.findById(cutoffAudio._id).lean().exec();
    assert.ok(cutoffDocument.deletedAt); assert.equal(cutoffDocument.storageKey, cutoffKey);
    assert.equal(await repository.restoreWithinRetention(String(cutoffAudio._id), exactCutoff), null, 'atomic predicate rejects a stale candidate at cutoff');
    const atomicRaceAudio = await audio({deletedAt: new Date(exactCutoff.getTime() + 1)});
    assert.ok(await repository.findById(String(atomicRaceAudio._id), {includeDeleted: true}), 'a prior read can observe an eligible candidate');
    await Audio.updateOne({_id: atomicRaceAudio._id}, {$set: {deletedAt: exactCutoff}});
    assert.equal(await repository.restoreWithinRetention(String(atomicRaceAudio._id), exactCutoff), null, 'conditional update, not the prior read, enforces the cutoff');

    // Same-token concurrent confirms converge on a single READY document.
    const same = await audio({processingStatus: 'PENDING'});
    const sameGrant = await media.authorizeUpload(String(same._id), {contentType: 'audio/wav', contentLength: fixture.length}, creator);
    const sameToken = require('../../src/media/upload').UploadGrantService.prototype.verify.call(new (require('../../src/media/upload').UploadGrantService)(), sameGrant.uploadToken);
    keys.add(sameToken.pendingKey); keys.add(sameToken.finalKey);
    assert.ok((await fetch(sameGrant.uploadUrl, {method: sameGrant.method, headers: sameGrant.headers, body: fixture})).ok);
    const sameResults = await Promise.allSettled([media.confirmUpload(String(same._id), {uploadToken: sameGrant.uploadToken}, creator), media.confirmUpload(String(same._id), {uploadToken: sameGrant.uploadToken}, creator)]);
    assert.ok(sameResults.every(item => item.status === 'fulfilled'));
    const sameStored = await Audio.findById(same._id).lean().exec();
    assert.equal(sameStored.processingStatus, 'READY'); assert.equal(sameStored.storageKey, sameToken.finalKey); assert.equal(await Audio.countDocuments({_id: same._id}), 1);
    const sameRetry = await media.confirmUpload(String(same._id), {uploadToken: sameGrant.uploadToken}, creator);
    assert.equal(sameRetry.storageKey, sameToken.finalKey);

    async function issueAndPut(target) {
      const grant = await media.authorizeUpload(String(target._id), {contentType: 'audio/wav', contentLength: fixture.length}, creator);
      const token = new (require('../../src/media/upload').UploadGrantService)().verify(grant.uploadToken);
      keys.add(token.pendingKey); keys.add(token.finalKey);
      assert.ok((await fetch(grant.uploadUrl, {method: grant.method, headers: grant.headers, body: fixture})).ok);
      return {grant, token};
    }
    // Different grants from the same snapshot and replacement grants both use
    // Mongo CAS: exactly one can win; the loser is not last-write-wins.
    const race = await audio({processingStatus: 'PENDING'}); const [raceA, raceB] = await Promise.all([issueAndPut(race), issueAndPut(race)]);
    assert.notEqual(raceA.token.finalKey, raceB.token.finalKey);
    const raced = await Promise.allSettled([media.confirmUpload(String(race._id), {uploadToken: raceA.grant.uploadToken}, creator), media.confirmUpload(String(race._id), {uploadToken: raceB.grant.uploadToken}, creator)]);
    assert.equal(raced.filter(item => item.status === 'fulfilled').length, 1); assert.equal(raced.filter(item => item.status === 'rejected')[0].reason.code, 'UPLOAD_SUPERSEDED');
    const raceStored = await Audio.findById(race._id).lean().exec(); const winner = raceStored.storageKey; const loser = winner === raceA.token.finalKey ? raceB.token.finalKey : raceA.token.finalKey;
    const loserHead = await storage.headObject({key: loser});
    await cleanup(new Date(loserHead.lastModified.getTime() + DAY_MS - 2_000)).run(); assert.equal((await storage.headObject({key: loser})).size, fixture.length);
    await cleanup(new Date(loserHead.lastModified.getTime() + DAY_MS + 2_000)).run(); await missing(storage, loser); assert.equal((await storage.headObject({key: winner})).size, fixture.length);

    const oldKey = `audio/replacement/${suffix}/old`; const oldHead = await put(oldKey); const replacement = await audio({storageKey: oldKey, processingStatus: 'READY'});
    await cleanup(new Date(oldHead.lastModified.getTime() + DAY_MS + 2_000)).run(); assert.equal((await storage.headObject({key: oldKey})).size, fixture.length, 'referenced old blob is protected before CAS');
    const [replaceA, replaceB] = await Promise.all([issueAndPut(replacement), issueAndPut(replacement)]);
    const replacementRace = await Promise.allSettled([media.confirmUpload(String(replacement._id), {uploadToken: replaceA.grant.uploadToken}, creator), media.confirmUpload(String(replacement._id), {uploadToken: replaceB.grant.uploadToken}, creator)]);
    assert.equal(replacementRace.filter(item => item.status === 'fulfilled').length, 1); assert.equal(replacementRace.filter(item => item.status === 'rejected')[0].reason.code, 'UPLOAD_SUPERSEDED');
    const replacementStored = await Audio.findById(replacement._id).lean().exec(); assert.equal(replacementStored.processingStatus, 'READY'); assert.notEqual(replacementStored.storageKey, oldKey); assert.equal((await storage.headObject({key: oldKey})).size, fixture.length, 'confirm never deletes old key');
    await cleanup(new Date(oldHead.lastModified.getTime() + DAY_MS + 2_000)).run(); await missing(storage, oldKey); assert.equal((await storage.headObject({key: replacementStored.storageKey})).size, fixture.length);
    assert.equal(active.processingStatus, 'READY');
  } finally {
    const teardown = loadPhase41d1Environment();
    await assertMinioHealthy(teardown.storage);
    if (getDatabaseStatus().state === 'CONNECTED') { assertConnectedTestDatabase(); await User.db.dropDatabase(); await disconnectDatabase(); }
    for (const key of keys) await raw.send(new DeleteObjectCommand({Bucket: EXPECTED_BUCKET, Key: key})).catch(() => {});
    if (bucketCreated) await raw.send(new DeleteBucketCommand({Bucket: EXPECTED_BUCKET})).catch(() => {});
    raw.destroy(); storage.client?.destroy();
  }
});
