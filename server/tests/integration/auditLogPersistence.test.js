const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');

const app = require('../../app');
const {startServer} = require('../../server');
const {connectDatabase, disconnectDatabase, getDatabaseStatus} = require('../../src/config/database');
const {User, Genre, Story, Chapter, Audio, AuthorApplication, AuditLog} = require('../../src/models');
const {
  getIdentityRepositories, resetIdentityRepositoriesToProduction,
  getContentRepositories, resetContentRepositoriesToProduction,
  getCommunityRepositories, resetCommunityRepositoriesToProduction,
  getPersonalizationRepositories,
  getAuditRepositories, resetAuditRepositoriesToProduction,
  AuditLogMongoRepository, UserMongoRepository,
} = require('../../src/repositories');
const authService = require('../../src/modules/auth/authService');
const authorApplicationService = require('../../src/modules/authorApplications/authorApplicationService');
const genreService = require('../../src/modules/genres/genreService');
const storyService = require('../../src/modules/stories/storyService');
const chapterService = require('../../src/modules/chapters/chapterService');
const audioService = require('../../src/modules/audio/audioService');
const {auditLogService} = require('../../src/services/auditLogService');
const emailService = require('../../src/services/emailService');
const {AUTHOR_STATUS, ROLES} = require('../../src/constants/roles');

const TEST_DATABASE = 'audiotalents_phase38c_test';

function testDatabaseName(uri) {
  if (!uri) throw new Error('TEST_DATABASE_SAFETY_ERROR: MONGODB_TEST_URI is required; MONGODB_URI is never used as a fallback');
  let databaseName;
  try {
    databaseName = decodeURIComponent(new URL(uri).pathname).replace(/^\/+/, '').split('/')[0];
  } catch {
    throw new Error('TEST_DATABASE_SAFETY_ERROR: MONGODB_TEST_URI is invalid');
  }
  if (databaseName !== TEST_DATABASE) {
    throw new Error(`TEST_DATABASE_SAFETY_ERROR: expected exact dedicated database ${TEST_DATABASE}`);
  }
  return databaseName;
}

function assertTestDatabase(expectedName) {
  const status = getDatabaseStatus();
  assert.equal(status.state, 'CONNECTED');
  assert.equal(status.database, expectedName);
  assert.notEqual(status.database, 'audiotalents');
}

async function closeServer(server) {
  if (server?.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

async function request(port, path, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
  return {status: response.status, body: await response.json()};
}

function headers(accessToken) {
  return {'Content-Type': 'application/json', authorization: `Bearer ${accessToken}`, cookie: 'phase38c=not-for-audit'};
}

function latestVerificationCode(deliveries, email) {
  const delivery = [...deliveries].reverse().find(item => item.to === email && item.purpose === 'EMAIL_VERIFICATION');
  assert.ok(delivery, `Missing verification delivery for ${email}`);
  return delivery.code;
}

async function createVerifiedUser(deliveries, suffix) {
  const email = `phase38c-${suffix}@example.test`;
  await authService.register({username: `Phase 38C ${suffix}`, email, password: 'password123'});
  await authService.verifyEmail(email, latestVerificationCode(deliveries, email));
  return getIdentityRepositories().user.findByEmail(email);
}

function assertAuditDocumentShape(document) {
  assert.ok(document._id);
  assert.ok(document.createdAt);
  assert.equal(document.updatedAt, undefined);
  assert.equal(document.deletedAt, undefined);
  assert.equal(document.deletedBy, undefined);
  assert.equal(document.status, undefined);
  const allowedStorageFields = new Set(['_id', '__v', 'action', 'actorId', 'createdAt', 'ipAddress', 'metadata', 'targetId', 'targetType', 'userAgent']);
  for (const key of Object.keys(document)) assert.equal(allowedStorageFields.has(key), true, `${key} is not a canonical or Mongoose-internal AuditLog field`);
}

function assertRuntimeShape(record) {
  assert.ok(record.id);
  assert.equal(record._id, undefined);
  assert.equal(record.__v, undefined);
  assert.equal(record.updatedAt, undefined);
}

test('AuditLog Mongo persistence, all existing Admin producers, and reconnect use only the isolated Phase 3.8C database', {timeout: 120_000}, async () => {
  const testUri = process.env.MONGODB_TEST_URI;
  const databaseName = testDatabaseName(testUri);
  const deliveries = [];
  let startupServer;
  let apiServer;

  resetIdentityRepositoriesToProduction();
  resetContentRepositoriesToProduction();
  resetCommunityRepositoriesToProduction();
  resetAuditRepositoriesToProduction();
  emailService.setTestDelivery(async message => { deliveries.push(message); });

  try {
    // Every destructive operation is preceded by the exact dedicated-DB assertion.
    await connectDatabase(testUri);
    assertTestDatabase(databaseName);
    await User.db.dropDatabase();
    await disconnectDatabase();

    startupServer = await startServer({databaseUri: testUri, port: 0});
    assertTestDatabase(databaseName);
    assert.equal(await AuditLog.countDocuments(), 0);
    await closeServer(startupServer);
    startupServer = null;
    await disconnectDatabase();

    await connectDatabase(testUri);
    assertTestDatabase(databaseName);
    await Promise.all([User.init(), AuthorApplication.init(), Genre.init(), Story.init(), Chapter.init(), Audio.init(), AuditLog.init()]);

    const auditProvider = getAuditRepositories();
    assert.equal(auditProvider.runtime, 'MONGO');
    assert.ok(auditProvider.auditLog instanceof AuditLogMongoRepository);
    assert.ok(getIdentityRepositories().user instanceof UserMongoRepository);
    assert.equal(getContentRepositories().runtime, 'MONGO');
    assert.equal(getCommunityRepositories().runtime, 'MONGO');
    assert.equal(getPersonalizationRepositories().runtime, 'MONGO');

    const adminBeforePromotion = await createVerifiedUser(deliveries, 'admin');
    assert.equal(adminBeforePromotion.role, ROLES.USER);
    // Test-only trusted setup on the already-guarded disposable DB; registration never accepts ADMIN.
    await User.updateOne({_id: adminBeforePromotion.id}, {$set: {role: ROLES.ADMIN}});
    const admin = await getIdentityRepositories().user.findById(adminBeforePromotion.id);
    assert.equal(admin.role, ROLES.ADMIN);
    const adminAccessToken = (await authService.login({email: 'phase38c-admin@example.test', password: 'password123'})).accessToken;

    let owner = await createVerifiedUser(deliveries, 'owner');
    await getIdentityRepositories().user.setAuthorStatus(owner.id, AUTHOR_STATUS.APPROVED);
    owner = await getIdentityRepositories().user.findById(owner.id);
    const ownerAccessToken = (await authService.login({email: 'phase38c-owner@example.test', password: 'password123'})).accessToken;

    const directTargetId = new mongoose.Types.ObjectId();
    const directEntry = await auditLogService.record({
      actorId: owner.id,
      action: 'STORY_APPROVED',
      targetType: 'AUDIT_TEST_SUBJECT',
      targetId: directTargetId,
      metadata: {
        safe: {reason: 'moderation-test'},
        auth: {accessToken: 'dummy-access-token', passwordHash: 'dummy-password-hash'},
        password: 'dummy-password', otpCode: '000000', cookie: 'dummy-cookie',
      },
      ipAddress: '203.0.113.38',
      userAgent: 'AudioTalents Phase 3.8C Test',
    });
    assertRuntimeShape(directEntry);
    const directStored = await AuditLog.findById(directEntry.id).lean().exec();
    const directCreatedAt = directStored.createdAt.toISOString();
    assertAuditDocumentShape(directStored);
    assert.equal(String(directStored.actorId), owner.id);
    assert.equal(String(directStored.targetId), String(directTargetId));
    assert.equal(directStored.targetType, 'AUDIT_TEST_SUBJECT');
    assert.equal(directStored.ipAddress, '203.0.113.38');
    assert.equal(directStored.userAgent, 'AudioTalents Phase 3.8C Test');
    assert.deepEqual(directStored.metadata, {safe: {reason: 'moderation-test'}});
    const storedText = JSON.stringify(directStored.metadata);
    for (const forbidden of ['dummy-access-token', 'dummy-password-hash', 'dummy-password', '000000', 'dummy-cookie']) assert.equal(storedText.includes(forbidden), false);

    const applicantApproved = await createVerifiedUser(deliveries, 'applicant-approved');
    const applicantRejected = await createVerifiedUser(deliveries, 'applicant-rejected');
    const approvedApplication = await authorApplicationService.submit(applicantApproved.id, {displayName: 'Approved Applicant', bio: 'Disposable application', copyrightAgreement: true});
    const rejectedApplication = await authorApplicationService.submit(applicantRejected.id, {displayName: 'Rejected Applicant', bio: 'Disposable application', copyrightAgreement: true});

    const genre = await genreService.create({name: 'Phase 38C Genre', slug: 'phase38c-genre'});
    const producerTargets = [];
    async function createStory(title) {
      return storyService.create({title, description: 'Disposable audit producer target', genres: [genre.slug]}, owner);
    }
    const stories = [
      await createStory('Phase 38C Story Approved'),
      await createStory('Phase 38C Story Rejected'),
      await createStory('Phase 38C Story Revision'),
    ];
    const chapters = [];
    for (const [index, story] of stories.entries()) {
      chapters.push(await chapterService.create(story.id, {chapterNumber: index + 1, title: `Phase 38C Chapter ${index + 1}`}, owner));
    }
    const audio = [];
    for (const [index, chapter] of chapters.entries()) {
      audio.push(await audioService.create({chapterId: chapter.id, title: `Phase 38C Audio ${index + 1}`, audioUrl: `https://cdn.example.test/phase38c-${index + 1}.mp3`}, owner));
    }

    apiServer = http.createServer(app);
    await new Promise(resolve => apiServer.listen(0, resolve));
    const port = apiServer.address().port;
    const authorDenied = await request(port, '/api/admin/content/pending', {headers: {authorization: `Bearer ${ownerAccessToken}`}});
    assert.equal(authorDenied.status, 403);

    async function moderate(path, expectedAction, targetId, body = {}) {
      const response = await request(port, path, {method: 'PATCH', headers: headers(adminAccessToken), body: JSON.stringify(body)});
      assert.equal(response.status, 200, `${expectedAction} should be accepted`);
      const audit = await AuditLog.findOne({action: expectedAction, targetId}).lean().exec();
      assert.ok(audit, `${expectedAction} audit record missing`);
      assert.equal(String(audit.actorId), admin.id);
      assert.equal(String(audit.targetId), String(targetId));
      producerTargets.push({action: expectedAction, targetId: String(targetId)});
      return audit;
    }

    await moderate(`/api/admin/author-applications/${approvedApplication.id}/approve`, 'AUTHOR_APPLICATION_APPROVED', approvedApplication.id, {actorId: owner.id});
    await moderate(`/api/admin/author-applications/${rejectedApplication.id}/reject`, 'AUTHOR_APPLICATION_REJECTED', rejectedApplication.id, {actorId: owner.id, reviewNote: 'Disposable rejection'});
    await moderate(`/api/admin/stories/${stories[0].id}/approve`, 'STORY_APPROVED', stories[0].id, {actorId: owner.id});
    await moderate(`/api/admin/stories/${stories[1].id}/reject`, 'STORY_REJECTED', stories[1].id);
    await moderate(`/api/admin/stories/${stories[2].id}/revision`, 'STORY_REVISION_REQUIRED', stories[2].id);
    await moderate(`/api/admin/chapters/${chapters[0].id}/approve`, 'CHAPTER_APPROVED', chapters[0].id);
    await moderate(`/api/admin/chapters/${chapters[1].id}/reject`, 'CHAPTER_REJECTED', chapters[1].id);
    await moderate(`/api/admin/chapters/${chapters[2].id}/revision`, 'CHAPTER_REVISION_REQUIRED', chapters[2].id);
    await moderate(`/api/admin/audio/${audio[0].id}/approve`, 'AUDIO_APPROVED', audio[0].id);
    await moderate(`/api/admin/audio/${audio[1].id}/reject`, 'AUDIO_REJECTED', audio[1].id);
    await moderate(`/api/admin/audio/${audio[2].id}/revision`, 'AUDIO_REVISION_REQUIRED', audio[2].id);

    assert.equal((await AuthorApplication.findById(approvedApplication.id).lean().exec()).status, 'APPROVED');
    assert.equal((await AuthorApplication.findById(rejectedApplication.id).lean().exec()).status, 'REJECTED');
    assert.equal((await Story.findById(stories[0].id).lean().exec()).reviewStatus, 'APPROVED');
    assert.equal((await Story.findById(stories[1].id).lean().exec()).reviewStatus, 'REJECTED');
    assert.equal((await Story.findById(stories[2].id).lean().exec()).reviewStatus, 'REVISION_REQUIRED');
    assert.equal((await Chapter.findById(chapters[0].id).lean().exec()).status, 'APPROVED');
    assert.equal((await Chapter.findById(chapters[1].id).lean().exec()).status, 'REJECTED');
    assert.equal((await Chapter.findById(chapters[2].id).lean().exec()).status, 'REVISION_REQUIRED');
    assert.equal((await Audio.findById(audio[0].id).lean().exec()).status, 'APPROVED');
    assert.equal((await Audio.findById(audio[1].id).lean().exec()).status, 'REJECTED');
    assert.equal((await Audio.findById(audio[2].id).lean().exec()).status, 'REVISION_REQUIRED');
    assert.equal(producerTargets.length, 11);
    const producerMetadata = await AuditLog.find({actorId: admin.id}).select({metadata: 1}).lean().exec();
    const producerMetadataText = JSON.stringify(producerMetadata.map(entry => entry.metadata));
    assert.equal(producerMetadataText.includes(adminAccessToken), false);
    assert.equal(producerMetadataText.includes('phase38c=not-for-audit'), false);

    const repository = getAuditRepositories().auditLog;
    const recentFirstPage = await repository.listRecent({page: 1, limit: 5});
    const recentSecondPage = await repository.listRecent({page: 2, limit: 5});
    assert.equal(recentFirstPage.items.length, 5);
    assert.equal(recentFirstPage.pagination.total, 12);
    assert.equal(recentSecondPage.items.length, 5);
    assert.equal(new Set([...recentFirstPage.items, ...recentSecondPage.items].map(item => item.id)).size, 10);
    for (let index = 1; index < recentFirstPage.items.length; index += 1) {
      assert.ok(new Date(recentFirstPage.items[index - 1].createdAt) >= new Date(recentFirstPage.items[index].createdAt));
    }
    recentFirstPage.items.forEach(assertRuntimeShape);
    const ownerLogs = await repository.listByActor(owner.id, {page: 1, limit: 10});
    assert.deepEqual(ownerLogs.items.map(item => item.id), [directEntry.id]);
    const targetLogs = await repository.listByTarget('AUDIT_TEST_SUBJECT', directTargetId, {page: 1, limit: 10});
    assert.deepEqual(targetLogs.items.map(item => item.id), [directEntry.id]);
    assert.equal(await repository.findById(new mongoose.Types.ObjectId()), null);
    await assert.rejects(() => repository.listByActor('not-an-objectid'), error => error.code === 'INVALID_ID');
    await assert.rejects(() => repository.listByTarget('AUDIT_TEST_SUBJECT', 'not-an-objectid'), error => error.code === 'INVALID_ID');

    const persistedCount = await AuditLog.countDocuments();
    assert.equal(persistedCount, 12);
    await closeServer(apiServer);
    apiServer = null;
    await disconnectDatabase();
    await connectDatabase(testUri);
    assertTestDatabase(databaseName);
    assert.equal(await AuditLog.countDocuments(), persistedCount);
    const reconnectedDirect = await AuditLog.findById(directEntry.id).lean().exec();
    assertAuditDocumentShape(reconnectedDirect);
    assert.equal(reconnectedDirect.createdAt.toISOString(), directCreatedAt);
    assert.deepEqual(reconnectedDirect.metadata, {safe: {reason: 'moderation-test'}});
    assert.equal(String(reconnectedDirect.actorId), owner.id);
    assert.equal(String(reconnectedDirect.targetId), String(directTargetId));
  } finally {
    await closeServer(apiServer);
    await closeServer(startupServer);
    emailService.clearTestDelivery();
    if (getDatabaseStatus().state === 'CONNECTED') {
      assertTestDatabase(databaseName);
      await User.db.dropDatabase();
      await disconnectDatabase();
    }
    resetIdentityRepositoriesToProduction();
    resetContentRepositoriesToProduction();
    resetCommunityRepositoriesToProduction();
    resetAuditRepositoriesToProduction();
  }
});
