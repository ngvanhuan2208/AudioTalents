const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const app = require('../../app');
const {startServer} = require('../../server');
const {connectDatabase, disconnectDatabase, getDatabaseStatus} = require('../../src/config/database');
const {User, Genre, Story, Chapter, Audio} = require('../../src/models');
const {getIdentityRepositories, resetIdentityRepositoriesToProduction} = require('../../src/repositories/identityRuntime');
const {getContentRepositories, resetContentRepositoriesToProduction} = require('../../src/repositories/contentRuntime');
const authService = require('../../src/modules/auth/authService');
const genreService = require('../../src/modules/genres/genreService');
const storyService = require('../../src/modules/stories/storyService');
const chapterService = require('../../src/modules/chapters/chapterService');
const audioService = require('../../src/modules/audio/audioService');
const searchService = require('../../src/modules/search/searchService');
const emailService = require('../../src/services/emailService');
const {AUTHOR_STATUS, ROLES} = require('../../src/constants/roles');

function testDatabaseName(uri) {
  if (!uri) throw new Error('TEST_DATABASE_SAFETY_ERROR: MONGODB_TEST_URI is required');
  let name;
  try { name = decodeURIComponent(new URL(uri).pathname).replace(/^\/+/, '').split('/')[0]; } catch { throw new Error('TEST_DATABASE_SAFETY_ERROR: MONGODB_TEST_URI is invalid'); }
  const normalized = name.toLowerCase();
  if (normalized === 'audiotalents' || !normalized.includes('phase35c') || !normalized.includes('test')) {
    throw new Error('TEST_DATABASE_SAFETY_ERROR: only a dedicated phase35c test database may be written or dropped');
  }
  return name;
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

async function request(port, path) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`);
  return {status: response.status, body: await response.json()};
}

test('Content Mongo persistence, public parent chains, and reconnect survive in an isolated test database', {timeout: 60_000}, async () => {
  const testUri = process.env.MONGODB_TEST_URI;
  const databaseName = testDatabaseName(testUri);
  const deliveries = [];
  let startupServer;
  let apiServer;

  resetIdentityRepositoriesToProduction();
  resetContentRepositoriesToProduction();
  emailService.setTestDelivery(async message => { deliveries.push(message); });

  try {
    await connectDatabase(testUri);
    assertTestDatabase(databaseName);
    await User.db.dropDatabase();
    await disconnectDatabase();

    startupServer = await startServer({databaseUri: testUri, port: 0});
    assertTestDatabase(databaseName);
    assert.equal(await Genre.countDocuments(), 0);
    assert.equal(await Story.countDocuments(), 0);
    assert.equal(await Chapter.countDocuments(), 0);
    assert.equal(await Audio.countDocuments(), 0);
    await closeServer(startupServer);
    startupServer = null;
    await disconnectDatabase();

    await connectDatabase(testUri);
    assertTestDatabase(databaseName);
    // Index materialization is deliberately scoped to the disposable test DB.
    await Promise.all([User.init(), Genre.init(), Story.init(), Chapter.init(), Audio.init()]);

    const email = 'phase35c-author@example.test';
    const password = 'password123';
    await authService.register({username: 'Phase 35C Author', email, password});
    const verification = deliveries.find(item => item.to === email && item.purpose === 'EMAIL_VERIFICATION');
    assert.ok(verification);
    await authService.verifyEmail(email, verification.code);
    let creator = await getIdentityRepositories().user.findByEmail(email);
    await getIdentityRepositories().user.setAuthorStatus(creator.id, AUTHOR_STATUS.APPROVED);
    creator = await getIdentityRepositories().user.findById(creator.id);
    assert.equal(creator.authorStatus, AUTHOR_STATUS.APPROVED);
    const adminActor = {id: creator.id, role: ROLES.ADMIN, authorStatus: AUTHOR_STATUS.APPROVED};

    const activeGenre = await genreService.create({name: 'Phase 35C Fantasy', slug: 'Phase 35C Fantasy', description: 'Disposable', icon: 'book'});
    const inactiveGenre = await genreService.create({name: 'Phase 35C Hidden', slug: 'phase35c-hidden', description: 'Disposable'});
    await getContentRepositories().genre.setActive(inactiveGenre.id, false);
    assert.equal((await genreService.list()).some(item => item.id === inactiveGenre.id), false);
    await assert.rejects(
      () => genreService.create({name: 'Duplicate', slug: activeGenre.slug}),
      error => error.code === 'CONFLICT'
    );

    const draftStory = await storyService.create({title: 'Phase 35C Draft Story', description: 'Hidden parent', genres: [activeGenre.slug]}, creator);
    const hiddenParentChapter = await chapterService.create(draftStory.id, {chapterNumber: 1, title: 'Approved Child'}, creator);
    await chapterService.moderate(hiddenParentChapter.id, 'APPROVED', adminActor);
    await assert.rejects(() => chapterService.getById(hiddenParentChapter.id, null), error => error.code === 'NOT_FOUND');
    const hiddenParentAudio = await audioService.create({chapterId: hiddenParentChapter.id, audioUrl: 'https://cdn.example.test/hidden-parent.mp3'}, creator);
    await audioService.moderate(hiddenParentAudio.id, 'APPROVED', adminActor);
    await getContentRepositories().audio.updateProcessing(hiddenParentAudio.id, 'READY');
    assert.deepEqual(await audioService.listPublic(hiddenParentChapter.id), []);

    const story = await storyService.create({
      title: 'Phase 35C Public Story', description: 'Mongo integration searchable story', genres: [activeGenre.slug],
      creatorId: 'impersonator', chapterCount: 999, reviewStatus: 'APPROVED',
    }, creator);
    let storedStory = await Story.findById(story.id).lean().exec();
    assert.equal(String(storedStory.creatorId), creator.id);
    assert.equal(storedStory.status, 'ONGOING');
    assert.equal(storedStory.reviewStatus, 'DRAFT');
    assert.equal(storedStory.visibility, 'PRIVATE');
    assert.equal(storedStory.chapterCount, 0);
    assert.equal(storedStory.contentStatus, undefined);
    assert.deepEqual(storedStory.genreIds.map(String), [activeGenre.id]);
    await assert.rejects(
      () => getContentRepositories().story.createStory({creatorId: creator.id, title: 'Duplicate slug', slug: story.slug, description: 'x', genreIds: [activeGenre.id]}),
      error => error.code === 'STORY_SLUG_EXISTS'
    );
    await storyService.moderate(story.id, 'APPROVED', adminActor);

    const chapter = await chapterService.create(story.id, {chapterNumber: 1, title: 'Chapter One', creatorId: 'impersonator'} , creator);
    storedStory = await Story.findById(story.id).lean().exec();
    assert.equal(storedStory.chapterCount, 1);
    const storedChapter = await Chapter.findById(chapter.id).lean().exec();
    assert.equal(String(storedChapter.storyId), story.id);
    assert.equal(String(storedChapter.creatorId), creator.id);
    await assert.rejects(() => chapterService.create(story.id, {chapterNumber: 1, title: 'Duplicate'}, creator), error => error.code === 'CONFLICT');
    await assert.rejects(() => chapterService.update(chapter.id, {status: 'HIDDEN'}, creator), error => error.code === 'UNMAPPABLE_LEGACY_STATUS');
    await chapterService.moderate(chapter.id, 'APPROVED', adminActor);
    assert.equal((await chapterService.getById(chapter.id, null)).id, chapter.id);
    const deletableChapter = await chapterService.create(story.id, {chapterNumber: 2, title: 'Disposable Chapter'}, creator);
    assert.equal((await Story.findById(story.id).lean().exec()).chapterCount, 2);
    const draftChapterAudio = await audioService.create({chapterId: deletableChapter.id, audioUrl: 'https://cdn.example.test/draft-chapter.mp3'}, creator);
    await audioService.moderate(draftChapterAudio.id, 'APPROVED', adminActor);
    await getContentRepositories().audio.updateProcessing(draftChapterAudio.id, 'READY');
    assert.deepEqual(await audioService.listPublic(deletableChapter.id), []);
    await chapterService.remove(deletableChapter.id, creator);
    const deletedChapter = await Chapter.findById(deletableChapter.id).lean().exec();
    assert.ok(deletedChapter.deletedAt);
    assert.equal(String(deletedChapter.deletedBy), creator.id);
    assert.equal((await Story.findById(story.id).lean().exec()).chapterCount, 1);
    await assert.rejects(() => chapterService.getById(deletableChapter.id, null), error => error.code === 'NOT_FOUND');

    const uploadingAudio = await audioService.create({
      chapterId: chapter.id, storyId: 'impersonator-story', creatorId: 'impersonator', title: 'Primary candidate', audioUrl: 'https://cdn.example.test/phase35c-primary.mp3', status: 'UPLOADING', transcript: [{start: 0, end: 1, text: 'Hello'}],
    }, creator);
    let storedAudio = await Audio.findById(uploadingAudio.id).lean().exec();
    assert.equal(String(storedAudio.storyId), story.id);
    assert.equal(String(storedAudio.chapterId), chapter.id);
    assert.equal(String(storedAudio.creatorId), creator.id);
    assert.equal(storedAudio.status, 'DRAFT');
    assert.equal(storedAudio.processingStatus, 'PENDING');
    assert.equal(typeof storedAudio.transcript, 'string');
    assert.equal(Buffer.isBuffer(storedAudio.audioUrl), false);
    await assert.rejects(
      () => audioService.create({chapterId: chapter.id, audioUrl: Buffer.from('mp3')}, creator),
      error => error.code === 'VALIDATION_ERROR'
    );
    await assert.rejects(
      () => audioService.create({chapterId: chapter.id, audioUrl: 'data:audio/mpeg;base64,AAAA'}, creator),
      error => error.code === 'VALIDATION_ERROR'
    );
    await assert.rejects(() => audioService.moderate(uploadingAudio.id, 'ABC', adminActor), error => error.code === 'INVALID_AUDIO_MODERATION_STATUS');
    await audioService.moderate(uploadingAudio.id, 'APPROVED', adminActor);
    await getContentRepositories().audio.updateProcessing(uploadingAudio.id, 'READY');
    assert.deepEqual((await audioService.listPublic(chapter.id)).map(item => item.id), [uploadingAudio.id]);

    const secondAudio = await audioService.create({chapterId: chapter.id, title: 'Second voice', audioUrl: 'https://cdn.example.test/phase35c-second.mp3'}, creator);
    await audioService.moderate(secondAudio.id, 'APPROVED', adminActor);
    await getContentRepositories().audio.updateProcessing(secondAudio.id, 'READY');
    await audioService.setPrimaryAudio(chapter.id, uploadingAudio.id, creator);
    await audioService.setPrimaryAudio(chapter.id, secondAudio.id, creator);
    const primaryRows = await Audio.find({chapterId: chapter.id, isPrimary: true, deletedAt: null}).lean().exec();
    assert.deepEqual(primaryRows.map(row => String(row._id)), [secondAudio.id]);
    assert.deepEqual((await audioService.listPublic(chapter.id)).map(item => item.id).sort(), [uploadingAudio.id, secondAudio.id].sort());
    assert.equal((await audioService.getDefaultPlayback(chapter.id)).id, secondAudio.id);

    await audioService.remove(secondAudio.id, creator);
    storedAudio = await Audio.findById(secondAudio.id).lean().exec();
    assert.ok(storedAudio.deletedAt);
    assert.equal(storedAudio.isPrimary, false);
    await getContentRepositories().audio.restore(secondAudio.id);
    storedAudio = await Audio.findById(secondAudio.id).lean().exec();
    assert.equal(storedAudio.deletedAt, null);
    assert.equal(storedAudio.isPrimary, false);

    const searchResult = await searchService.search({keyword: 'searchable', page: 1, limit: 10});
    assert.equal(searchResult.items.some(item => item.id === story.id), true);
    assert.equal(searchResult.items.some(item => item.id === draftStory.id), false);

    apiServer = http.createServer(app);
    await new Promise(resolve => apiServer.listen(0, resolve));
    const port = apiServer.address().port;
    for (const path of [`/api/genres`, `/api/stories/${story.slug}`, `/api/stories/${story.id}/chapters`, `/api/chapters/${chapter.id}/audio`, `/api/search?q=searchable`]) {
      const response = await request(port, path);
      assert.equal(response.status, 200, path);
      const serialized = JSON.stringify(response.body);
      assert.equal(serialized.includes('"_id"'), false);
      assert.equal(serialized.includes('"__v"'), false);
    }
    await assert.rejects(() => storyService.getById('not-an-objectid', null), error => error.code === 'INVALID_ID');

    await storyService.remove(story.id, creator);
    assert.deepEqual(await audioService.listPublic(chapter.id), []);
    const softDeletedStory = await Story.findById(story.id).lean().exec();
    assert.ok(softDeletedStory.deletedAt);
    assert.equal(String(softDeletedStory.deletedBy), creator.id);

    await disconnectDatabase();
    await connectDatabase(testUri);
    assertTestDatabase(databaseName);
    assert.ok(await Genre.findById(activeGenre.id).lean().exec());
    assert.ok(await Story.findById(story.id).lean().exec());
    assert.ok(await Chapter.findById(chapter.id).lean().exec());
    const reconnectedAudio = await Audio.findById(uploadingAudio.id).lean().exec();
    assert.equal(String(reconnectedAudio.chapterId), chapter.id);
    assert.ok((await Story.findById(story.id).lean().exec()).deletedAt);
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
  }
});
