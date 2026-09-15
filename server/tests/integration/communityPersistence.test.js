const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const app = require('../../app');
const {startServer} = require('../../server');
const {connectDatabase, disconnectDatabase, getDatabaseStatus} = require('../../src/config/database');
const {User, Genre, Story, Chapter, Notification, Comment, Rating, Report} = require('../../src/models');
const {getIdentityRepositories, resetIdentityRepositoriesToProduction} = require('../../src/repositories/identityRuntime');
const {getContentRepositories, resetContentRepositoriesToProduction} = require('../../src/repositories/contentRuntime');
const {getCommunityRepositories, resetCommunityRepositoriesToProduction} = require('../../src/repositories/communityRuntime');
const authService = require('../../src/modules/auth/authService');
const genreService = require('../../src/modules/genres/genreService');
const storyService = require('../../src/modules/stories/storyService');
const chapterService = require('../../src/modules/chapters/chapterService');
const communityService = require('../../src/modules/community/communityService');
const notificationService = require('../../src/modules/notifications/notificationService');
const emailService = require('../../src/services/emailService');
const {AUTHOR_STATUS, ROLES} = require('../../src/constants/roles');

function testDatabaseName(uri) {
  if (!uri) throw new Error('TEST_DATABASE_SAFETY_ERROR: MONGODB_TEST_URI is required');
  let name;
  try { name = decodeURIComponent(new URL(uri).pathname).replace(/^\/+/, '').split('/')[0]; } catch { throw new Error('TEST_DATABASE_SAFETY_ERROR: MONGODB_TEST_URI is invalid'); }
  const normalized = name.toLowerCase();
  if (normalized === 'audiotalents' || !normalized.includes('phase37c') || !normalized.includes('test')) {
    throw new Error('TEST_DATABASE_SAFETY_ERROR: only a dedicated phase37c test database may be written or dropped');
  }
  return name;
}

function assertTestDatabase(expectedName) {
  const status = getDatabaseStatus();
  assert.equal(status.state, 'CONNECTED');
  assert.equal(status.database, expectedName);
  assert.notEqual(status.database, 'audiotalents');
}

async function closeServer(server) { if (server?.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
async function request(port, path, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
  return {status: response.status, body: await response.json()};
}
function authHeaders(token) { return {'Content-Type': 'application/json', authorization: `Bearer ${token}`}; }
function latestCode(deliveries, email) {
  const message = [...deliveries].reverse().find(item => item.to === email && item.purpose === 'EMAIL_VERIFICATION');
  assert.ok(message, `Missing verification for ${email}`);
  return message.code;
}

test('Community Mongo persistence, rating aggregate, and connection lifecycle use only a disposable Phase 3.7C database', {timeout: 60_000}, async () => {
  const testUri = process.env.MONGODB_TEST_URI;
  const databaseName = testDatabaseName(testUri);
  const deliveries = [];
  let startupServer;
  let apiServer;

  resetIdentityRepositoriesToProduction();
  resetContentRepositoriesToProduction();
  resetCommunityRepositoriesToProduction();
  emailService.setTestDelivery(async message => { deliveries.push(message); });

  try {
    await connectDatabase(testUri);
    assertTestDatabase(databaseName);
    await User.db.dropDatabase();
    await disconnectDatabase();

    startupServer = await startServer({databaseUri: testUri, port: 0});
    assertTestDatabase(databaseName);
    assert.equal(await Notification.countDocuments(), 0);
    assert.equal(await Comment.countDocuments(), 0);
    assert.equal(await Rating.countDocuments(), 0);
    assert.equal(await Report.countDocuments(), 0);
    await closeServer(startupServer);
    startupServer = null;
    await disconnectDatabase();

    await connectDatabase(testUri);
    assertTestDatabase(databaseName);
    await Promise.all([User.init(), Genre.init(), Story.init(), Chapter.init(), Notification.init(), Comment.init(), Rating.init(), Report.init()]);

    const ownerEmail = 'phase37c-owner@example.test';
    const otherEmail = 'phase37c-other@example.test';
    const password = 'password123';
    await authService.register({username: 'Phase 37C Owner', email: ownerEmail, password});
    await authService.verifyEmail(ownerEmail, latestCode(deliveries, ownerEmail));
    await authService.register({username: 'Phase 37C Other', email: otherEmail, password});
    await authService.verifyEmail(otherEmail, latestCode(deliveries, otherEmail));
    let owner = await getIdentityRepositories().user.findByEmail(ownerEmail);
    const other = await getIdentityRepositories().user.findByEmail(otherEmail);
    await getIdentityRepositories().user.setAuthorStatus(owner.id, AUTHOR_STATUS.APPROVED);
    owner = await getIdentityRepositories().user.findById(owner.id);
    const adminActor = {...owner, role: ROLES.ADMIN};
    const ownerToken = (await authService.login({email: ownerEmail, password})).accessToken;
    const otherToken = (await authService.login({email: otherEmail, password})).accessToken;

    const genre = await genreService.create({name: 'Phase 37C Genre', slug: 'phase37c-genre'});
    const storyA = await storyService.create({title: 'Phase 37C Story A', description: 'Community persistence parent', genres: [genre.slug]}, owner);
    const storyB = await storyService.create({title: 'Phase 37C Story B', description: 'Cross-context validation', genres: [genre.slug]}, owner);
    await storyService.moderate(storyA.id, 'APPROVED', adminActor);
    const chapterA = await chapterService.create(storyA.id, {chapterNumber: 1, title: 'Chapter A'}, owner);
    const chapterB = await chapterService.create(storyB.id, {chapterNumber: 1, title: 'Chapter B'}, owner);

    apiServer = http.createServer(app);
    await new Promise(resolve => apiServer.listen(0, resolve));
    const port = apiServer.address().port;

    const systemNotification = await notificationService.createInternal({userId: owner.id, type: 'SYSTEM', title: 'System', message: 'Disposable', targetType: 'SYSTEM'});
    const otherNotification = await notificationService.createInternal({userId: other.id, type: 'STORY_APPROVED', title: 'Other', message: 'Scoped', targetType: 'STORY', targetId: storyA.id});
    await assert.rejects(
      () => notificationService.createInternal({userId: owner.id, type: 'STORY_APPROVED', title: 'Invalid', message: 'Invalid', targetType: 'STORY'}),
      error => error.code === 'PERSISTENCE_VALIDATION_ERROR'
    );
    let storedNotification = await Notification.findById(systemNotification.id).lean().exec();
    assert.equal(String(storedNotification.userId), owner.id);
    assert.equal(storedNotification.targetType, 'SYSTEM');
    assert.equal(storedNotification.targetId, null);
    assert.equal(storedNotification.isRead, false);
    assert.equal(storedNotification.readAt, null);
    assert.equal(await getCommunityRepositories().notification.countUnread(owner.id), 1);
    const listNotifications = await request(port, '/api/notifications', {headers: {authorization: `Bearer ${ownerToken}`}});
    assert.equal(listNotifications.status, 200);
    assert.equal(listNotifications.body.data.some(item => item.id === systemNotification.id), true);
    const crossRead = await request(port, `/api/notifications/${otherNotification.id}/read`, {method: 'PATCH', headers: {authorization: `Bearer ${ownerToken}`}});
    assert.equal(crossRead.status, 404);
    const markRead = await request(port, `/api/notifications/${systemNotification.id}/read`, {method: 'PATCH', headers: {authorization: `Bearer ${ownerToken}`}});
    assert.equal(markRead.status, 200);
    storedNotification = await Notification.findById(systemNotification.id).lean().exec();
    assert.equal(storedNotification.isRead, true);
    assert.ok(storedNotification.readAt);
    await notificationService.createInternal({userId: owner.id, type: 'SYSTEM', title: 'Second', message: 'Unread', targetType: 'SYSTEM'});
    await request(port, '/api/notifications/read-all', {method: 'PATCH', headers: {authorization: `Bearer ${ownerToken}`}});
    assert.equal(await getCommunityRepositories().notification.countUnread(owner.id), 0);
    assert.equal(await getCommunityRepositories().notification.countUnread(other.id), 1);
    const noCreateRoute = await request(port, '/api/notifications', {method: 'POST', headers: authHeaders(ownerToken), body: JSON.stringify({type: 'SYSTEM'})});
    assert.equal(noCreateRoute.status, 404);

    const createComment = await request(port, `/api/stories/${storyA.id}/comments`, {method: 'POST', headers: authHeaders(ownerToken), body: JSON.stringify({text: 'Parent comment', userId: other.id, status: 'HIDDEN'})});
    assert.equal(createComment.status, 201);
    const parentId = createComment.body.data.id;
    let parent = await Comment.findById(parentId).lean().exec();
    assert.equal(String(parent.userId), owner.id);
    assert.equal(String(parent.storyId), storyA.id);
    assert.equal(parent.content, 'Parent comment');
    assert.equal(parent.status, 'ACTIVE');
    assert.equal(parent.likeCount, 0);
    const storyScoped = await communityService.addComment(other.id, storyA.id, 'Story scoped');
    assert.equal((await Comment.findById(storyScoped.id).lean().exec()).chapterId, null);
    const reply = await communityService.addComment(other.id, storyA.id, 'Reply', {parentCommentId: parentId});
    assert.equal(String((await Comment.findById(reply.id).lean().exec()).parentCommentId), parentId);
    await assert.rejects(() => communityService.addComment(owner.id, storyA.id, 'Broken chain', {chapterId: chapterB.id}), error => error.code === 'NOT_FOUND');
    await assert.rejects(() => communityService.addComment(owner.id, storyB.id, 'Cross story', {parentCommentId: parentId}), error => error.code === 'NOT_FOUND');
    await assert.rejects(() => communityService.addComment(owner.id, '507f1f77bcf86cd799439011', 'Missing'), error => error.code === 'NOT_FOUND');
    const hidden = await communityService.addComment(owner.id, storyA.id, 'Hidden');
    await getCommunityRepositories().comment.setStatus(hidden.id, 'HIDDEN');
    assert.equal((await Comment.findById(hidden.id).lean().exec()).status, 'HIDDEN');
    assert.equal((await communityService.comments(storyA.id)).some(item => item.id === hidden.id), false);
    const deleteComment = await request(port, `/api/comments/${parentId}`, {method: 'DELETE', headers: {authorization: `Bearer ${ownerToken}`}});
    assert.equal(deleteComment.status, 200);
    parent = await Comment.findById(parentId).lean().exec();
    assert.equal(parent.status, 'DELETED');
    assert.equal(parent.deletedAt, undefined);
    assert.equal((await communityService.comments(storyA.id)).some(item => item.id === parentId), false);

    const firstRating = await request(port, `/api/stories/${storyA.id}/rating`, {method: 'POST', headers: authHeaders(ownerToken), body: JSON.stringify({value: 4, userId: other.id, ratingAverage: 99})});
    assert.equal(firstRating.status, 200);
    const secondRating = await request(port, `/api/stories/${storyA.id}/rating`, {method: 'POST', headers: authHeaders(otherToken), body: JSON.stringify({value: 2})});
    assert.equal(secondRating.status, 200);
    let storedStory = await Story.findById(storyA.id).lean().exec();
    assert.equal(storedStory.ratingCount, 2);
    assert.equal(storedStory.ratingAverage, 3);
    const updateRating = await request(port, `/api/stories/${storyA.id}/rating`, {method: 'POST', headers: authHeaders(ownerToken), body: JSON.stringify({value: 5})});
    assert.equal(updateRating.status, 200);
    assert.equal(await Rating.countDocuments({userId: owner.id, storyId: storyA.id}), 1);
    storedStory = await Story.findById(storyA.id).lean().exec();
    assert.equal(storedStory.ratingCount, 2);
    assert.equal(storedStory.ratingAverage, 3.5);
    for (const invalid of [0, 6, -1, 2.5]) {
      const response = await request(port, `/api/stories/${storyA.id}/rating`, {method: 'POST', headers: authHeaders(ownerToken), body: JSON.stringify({value: invalid})});
      assert.equal(response.status, 422);
      assert.equal(response.body.error.code, 'VALIDATION_ERROR');
    }
    await assert.rejects(() => communityService.rate(owner.id, '507f1f77bcf86cd799439012', 5), error => error.code === 'NOT_FOUND');
    await communityService.removeRating(owner.id, storyA.id);
    storedStory = await Story.findById(storyA.id).lean().exec();
    assert.deepEqual({ratingCount: storedStory.ratingCount, ratingAverage: storedStory.ratingAverage}, {ratingCount: 1, ratingAverage: 2});
    await communityService.removeRating(other.id, storyA.id);
    storedStory = await Story.findById(storyA.id).lean().exec();
    assert.deepEqual({ratingCount: storedStory.ratingCount, ratingAverage: storedStory.ratingAverage}, {ratingCount: 0, ratingAverage: 0});
    await communityService.rate(owner.id, storyA.id, 4);

    const createReport = await request(port, `/api/chapters/${chapterA.id}/reports`, {method: 'POST', headers: authHeaders(ownerToken), body: JSON.stringify({type: 'COPYRIGHT', description: 'Disposable report', reporterId: other.id, status: 'RESOLVED'})});
    assert.equal(createReport.status, 201);
    const storedReport = await Report.findById(createReport.body.data.id).lean().exec();
    assert.equal(String(storedReport.reporterId), owner.id);
    assert.equal(storedReport.targetType, 'CHAPTER');
    assert.equal(String(storedReport.targetId), chapterA.id);
    assert.equal(storedReport.reportType, 'COPYRIGHT');
    assert.equal(storedReport.status, 'OPEN');
    for (const legacy of ['type', 'handledBy', 'resolvedAt', 'chapterId']) assert.equal(storedReport[legacy], undefined);
    const missingReport = await request(port, '/api/chapters/507f1f77bcf86cd799439013/reports', {method: 'POST', headers: authHeaders(ownerToken), body: JSON.stringify({type: 'COPYRIGHT'})});
    assert.equal(missingReport.status, 404);
    const malformedReport = await request(port, '/api/chapters/not-an-objectid/reports', {method: 'POST', headers: authHeaders(ownerToken), body: JSON.stringify({type: 'COPYRIGHT'})});
    assert.equal(malformedReport.status, 400);
    assert.equal(malformedReport.body.error.code, 'INVALID_ID');

    for (const response of [createComment, firstRating, createReport]) {
      const serialized = JSON.stringify(response.body);
      assert.equal(serialized.includes('"_id"'), false);
      assert.equal(serialized.includes('"__v"'), false);
    }
    await closeServer(apiServer);
    apiServer = null;
    await disconnectDatabase();
    await connectDatabase(testUri);
    assertTestDatabase(databaseName);
    assert.ok(await Notification.findById(systemNotification.id).lean().exec());
    assert.equal((await Comment.findById(hidden.id).lean().exec()).status, 'HIDDEN');
    assert.equal((await Comment.findById(parentId).lean().exec()).status, 'DELETED');
    assert.equal(await Rating.countDocuments({storyId: storyA.id}), 1);
    storedStory = await Story.findById(storyA.id).lean().exec();
    assert.deepEqual({ratingCount: storedStory.ratingCount, ratingAverage: storedStory.ratingAverage}, {ratingCount: 1, ratingAverage: 4});
    assert.ok(await Report.findById(createReport.body.data.id).lean().exec());
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
  }
});
