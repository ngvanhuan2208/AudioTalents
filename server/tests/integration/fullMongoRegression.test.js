const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const app = require('../../app');
const {startServer} = require('../../server');
const {connectDatabase, disconnectDatabase, getDatabaseStatus} = require('../../src/config/database');
const models = require('../../src/models');
const {
  getIdentityRepositories, resetIdentityRepositoriesToProduction,
  getContentRepositories, resetContentRepositoriesToProduction,
  getPersonalizationRepositories, resetPersonalizationRepositoriesToProduction,
  getCommunityRepositories, resetCommunityRepositoriesToProduction,
  getAuditRepositories, resetAuditRepositoriesToProduction,
} = require('../../src/repositories');
const authService = require('../../src/modules/auth/authService');
const authorApplicationService = require('../../src/modules/authorApplications/authorApplicationService');
const genreService = require('../../src/modules/genres/genreService');
const storyService = require('../../src/modules/stories/storyService');
const chapterService = require('../../src/modules/chapters/chapterService');
const audioService = require('../../src/modules/audio/audioService');
const libraryService = require('../../src/modules/library/libraryService');
const playlistService = require('../../src/modules/playlists/playlistService');
const communityService = require('../../src/modules/community/communityService');
const notificationService = require('../../src/modules/notifications/notificationService');
const emailService = require('../../src/services/emailService');
const {AUTHOR_STATUS, ROLES} = require('../../src/constants/roles');

const TEST_DATABASE = 'audiotalents_phase39_test';
const CANONICAL_MODELS = Object.values(models);

function testDatabaseName(uri) {
  if (!uri) throw new Error('TEST_DATABASE_SAFETY_ERROR: MONGODB_TEST_URI is required; MONGODB_URI is never used as a fallback');
  let name;
  try { name = decodeURIComponent(new URL(uri).pathname).replace(/^\/+/, '').split('/')[0]; }
  catch { throw new Error('TEST_DATABASE_SAFETY_ERROR: MONGODB_TEST_URI is invalid'); }
  if (name !== TEST_DATABASE) throw new Error(`TEST_DATABASE_SAFETY_ERROR: expected exact dedicated database ${TEST_DATABASE}`);
  return name;
}

function assertTestDatabase(expected) {
  const status = getDatabaseStatus();
  assert.equal(status.state, 'CONNECTED');
  assert.equal(status.database, expected);
  assert.notEqual(status.database, 'audiotalents');
}

async function closeServer(server) {
  if (server?.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

async function request(port, path, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
  return {status: response.status, body: await response.json()};
}

function latestVerificationCode(deliveries, email) {
  const item = [...deliveries].reverse().find(message => message.to === email && message.purpose === 'EMAIL_VERIFICATION');
  assert.ok(item, `Missing verification delivery for ${email}`);
  return item.code;
}

async function createVerifiedUser(deliveries, suffix) {
  const email = `phase39-${suffix}@example.test`;
  await authService.register({username: `Phase 39 ${suffix}`, email, password: 'password123'});
  await authService.verifyEmail(email, latestVerificationCode(deliveries, email));
  return getIdentityRepositories().user.findByEmail(email);
}

test('full canonical Mongo regression uses all runtime providers and one disposable Phase 3.9 database', {timeout: 120_000}, async () => {
  const testUri = process.env.MONGODB_TEST_URI;
  const databaseName = testDatabaseName(testUri);
  const deliveries = [];
  let startupServer;
  let apiServer;

  resetIdentityRepositoriesToProduction();
  resetContentRepositoriesToProduction();
  resetPersonalizationRepositoriesToProduction();
  resetCommunityRepositoriesToProduction();
  resetAuditRepositoriesToProduction();
  emailService.setTestDelivery(async message => { deliveries.push(message); });

  try {
    await connectDatabase(testUri);
    assertTestDatabase(databaseName);
    await models.User.db.dropDatabase();
    await disconnectDatabase();

    startupServer = await startServer({databaseUri: testUri, port: 0});
    assertTestDatabase(databaseName);
    assert.deepEqual(await Promise.all(CANONICAL_MODELS.map(model => model.countDocuments())), new Array(CANONICAL_MODELS.length).fill(0));
    await closeServer(startupServer);
    startupServer = null;
    await disconnectDatabase();

    await connectDatabase(testUri);
    assertTestDatabase(databaseName);
    await Promise.all(CANONICAL_MODELS.map(model => model.init()));
    const identity = getIdentityRepositories();
    const content = getContentRepositories();
    const personalization = getPersonalizationRepositories();
    const community = getCommunityRepositories();
    const audit = getAuditRepositories();
    for (const repository of [identity.user, identity.otpToken, identity.authorApplication, content.genre, content.tag, content.proposal, content.story, content.chapter, content.audio, personalization.libraryItem, personalization.listenHistory, personalization.playlist, community.notification, community.comment, community.rating, community.report, audit.auditLog]) {
      assert.match(repository.constructor.name, /MongoRepository$/);
    }

    const adminBeforePromotion = await createVerifiedUser(deliveries, 'admin');
    assert.equal(adminBeforePromotion.role, ROLES.USER);
    // Trusted test-only setup, only after the exact test-DB guard.
    await models.User.updateOne({_id: adminBeforePromotion.id}, {$set: {role: ROLES.ADMIN}});
    const admin = await identity.user.findById(adminBeforePromotion.id);
    const adminToken = (await authService.login({email: 'phase39-admin@example.test', password: 'password123'})).accessToken;

    let owner = await createVerifiedUser(deliveries, 'owner');
    await identity.user.setAuthorStatus(owner.id, AUTHOR_STATUS.APPROVED);
    owner = await identity.user.findById(owner.id);
    const reader = await createVerifiedUser(deliveries, 'reader');
    const applicant = await createVerifiedUser(deliveries, 'applicant');
    const application = await authorApplicationService.submit(applicant.id, {displayName: 'Phase 39 Applicant', bio: 'Disposable', copyrightAgreement: true});

    const genre = await genreService.create({name: 'Phase 39 Genre', slug: 'phase39-genre', description: 'Disposable', icon: 'book'});
    const story = await storyService.create({title: 'Phase 39 Story', description: 'Cross-domain persistence', genres: [genre.slug], status: 'DRAFT', chapterCount: 999}, owner);
    let storedStory = await models.Story.findById(story.id).lean().exec();
    assert.equal(storedStory.status, 'ONGOING');
    assert.equal(storedStory.reviewStatus, 'DRAFT');
    assert.equal(storedStory.chapterCount, 0);
    const chapter = await chapterService.create(story.id, {chapterNumber: 1, title: 'Phase 39 Chapter', creatorId: reader.id}, owner);
    const audio = await audioService.create({chapterId: chapter.id, title: 'Phase 39 Audio', audioUrl: 'https://cdn.example.test/phase39.mp3', durationSec: 100, status: 'UPLOADING', transcript: [{start: 0, end: 1, text: 'Safe'}]}, owner);
    let storedAudio = await models.Audio.findById(audio.id).lean().exec();
    assert.equal(storedAudio.status, 'DRAFT');
    assert.equal(storedAudio.processingStatus, 'PENDING');
    assert.equal(typeof storedAudio.transcript, 'string');

    apiServer = http.createServer(app);
    await new Promise(resolve => apiServer.listen(0, resolve));
    const port = apiServer.address().port;
    const adminHeaders = {'Content-Type': 'application/json', authorization: `Bearer ${adminToken}`};
    // Moderation may approve Audio only after its media processing is READY.
    await content.audio.updateProcessing(audio.id, 'READY');
    for (const [path, body] of [
      [`/api/admin/author-applications/${application.id}/approve`, {}],
      [`/api/admin/stories/${story.id}/approve`, {actorId: owner.id}],
      [`/api/admin/chapters/${chapter.id}/approve`, {}],
      [`/api/admin/audio/${audio.id}/approve`, {}],
    ]) {
      const response = await request(port, path, {method: 'PATCH', headers: adminHeaders, body: JSON.stringify(body)});
      assert.equal(response.status, 200, path);
    }
    await audioService.setPrimaryAudio(chapter.id, audio.id, owner);
    assert.equal((await audioService.getDefaultPlayback(chapter.id)).id, audio.id);
    storedStory = await models.Story.findById(story.id).lean().exec();
    assert.deepEqual({reviewStatus: storedStory.reviewStatus, visibility: storedStory.visibility, chapterCount: storedStory.chapterCount}, {reviewStatus: 'APPROVED', visibility: 'PUBLIC', chapterCount: 1});
    assert.equal((await models.Chapter.findById(chapter.id).lean().exec()).status, 'APPROVED');
    storedAudio = await models.Audio.findById(audio.id).lean().exec();
    assert.deepEqual({status: storedAudio.status, processingStatus: storedAudio.processingStatus, isPrimary: storedAudio.isPrimary}, {status: 'APPROVED', processingStatus: 'READY', isPrimary: true});

    await libraryService.toggle(owner, story.id, 'FAVORITE');
    await libraryService.toggle(owner, story.id, 'FOLLOW');
    const progress = await libraryService.saveProgress(owner, {storyId: story.id, chapterId: chapter.id, positionSeconds: 50});
    assert.equal((await models.LibraryItem.countDocuments({userId: owner.id, storyId: story.id})), 1);
    assert.equal((await models.ListenHistory.countDocuments({userId: owner.id, chapterId: chapter.id})), 1);
    assert.equal((await models.ListenHistory.findById(progress.id).lean().exec()).audioId.toString(), audio.id);
    assert.equal((await models.Story.findById(story.id).lean().exec()).favoriteCount, 1);
    const playlist = await playlistService.create(owner, {name: 'Phase 39 Playlist'});
    await playlistService.changeStory(owner, playlist.id, story.id, true);
    await playlistService.changeStory(owner, playlist.id, story.id, true);
    await personalization.playlist.setVisibility(playlist.id, 'PUBLIC');
    assert.equal((await models.Playlist.findById(playlist.id).lean().exec()).storyIds.length, 1);

    const notification = await notificationService.createInternal({userId: reader.id, type: 'SYSTEM', title: 'Phase 39', message: 'Disposable', targetType: 'SYSTEM'});
    await notificationService.markRead(reader.id, notification.id);
    const comment = await communityService.addComment(reader.id, story.id, 'Phase 39 comment', {chapterId: chapter.id});
    await communityService.removeComment(reader.id, comment.id);
    await communityService.rate(owner.id, story.id, 4);
    await communityService.rate(reader.id, story.id, 2);
    await communityService.rate(owner.id, story.id, 5);
    storedStory = await models.Story.findById(story.id).lean().exec();
    assert.deepEqual({ratingCount: storedStory.ratingCount, ratingAverage: storedStory.ratingAverage}, {ratingCount: 2, ratingAverage: 3.5});
    const report = await communityService.report(reader.id, chapter.id, {type: 'COPYRIGHT', description: 'Disposable'});
    assert.equal((await models.Report.findById(report.id).lean().exec()).status, 'OPEN');
    assert.equal((await models.Comment.findById(comment.id).lean().exec()).status, 'DELETED');
    assert.equal((await models.Notification.findById(notification.id).lean().exec()).isRead, true);

    const auditRows = await models.AuditLog.find({actorId: admin.id}).lean().exec();
    assert.equal(auditRows.length, 4);
    for (const row of auditRows) {
      assert.ok(row.createdAt);
      assert.equal(row.updatedAt, undefined);
      assert.equal(JSON.stringify(row.metadata || {}).includes('password123'), false);
    }
    assert.equal(auditRows.some(row => row.action === 'STORY_APPROVED' && String(row.targetId) === story.id), true);
    assert.equal(auditRows.some(row => String(row.actorId) === owner.id), false);

    const countsBeforeReconnect = await Promise.all([models.User.countDocuments(), models.Story.countDocuments(), models.LibraryItem.countDocuments(), models.Notification.countDocuments(), models.AuditLog.countDocuments()]);
    await closeServer(apiServer);
    apiServer = null;
    await disconnectDatabase();
    await connectDatabase(testUri);
    assertTestDatabase(databaseName);
    assert.deepEqual(await Promise.all([models.User.countDocuments(), models.Story.countDocuments(), models.LibraryItem.countDocuments(), models.Notification.countDocuments(), models.AuditLog.countDocuments()]), countsBeforeReconnect);
    assert.equal((await models.User.findById(owner.id).lean().exec()).emailVerified, true);
    assert.equal((await models.Audio.findById(audio.id).lean().exec()).isPrimary, true);
    assert.equal((await models.ListenHistory.findById(progress.id).lean().exec()).completed, false);
    assert.equal((await models.Comment.findById(comment.id).lean().exec()).status, 'DELETED');
    assert.equal((await models.Report.findById(report.id).lean().exec()).reportType, 'COPYRIGHT');
  } finally {
    await closeServer(apiServer);
    await closeServer(startupServer);
    emailService.clearTestDelivery();
    if (getDatabaseStatus().state === 'CONNECTED') {
      assertTestDatabase(databaseName);
      await models.User.db.dropDatabase();
      await disconnectDatabase();
    }
    resetIdentityRepositoriesToProduction();
    resetContentRepositoriesToProduction();
    resetPersonalizationRepositoriesToProduction();
    resetCommunityRepositoriesToProduction();
    resetAuditRepositoriesToProduction();
  }
});
