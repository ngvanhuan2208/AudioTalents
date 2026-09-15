const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const app = require('../../app');
const {startServer} = require('../../server');
const {connectDatabase, disconnectDatabase, getDatabaseStatus} = require('../../src/config/database');
const {User, Genre, Story, Chapter, Audio, LibraryItem, ListenHistory, Playlist} = require('../../src/models');
const {getIdentityRepositories, resetIdentityRepositoriesToProduction} = require('../../src/repositories/identityRuntime');
const {getContentRepositories, resetContentRepositoriesToProduction} = require('../../src/repositories/contentRuntime');
const {getPersonalizationRepositories, resetPersonalizationRepositoriesToProduction} = require('../../src/repositories/personalizationRuntime');
const authService = require('../../src/modules/auth/authService');
const genreService = require('../../src/modules/genres/genreService');
const storyService = require('../../src/modules/stories/storyService');
const chapterService = require('../../src/modules/chapters/chapterService');
const audioService = require('../../src/modules/audio/audioService');
const libraryService = require('../../src/modules/library/libraryService');
const playlistService = require('../../src/modules/playlists/playlistService');
const emailService = require('../../src/services/emailService');
const {AUTHOR_STATUS, ROLES} = require('../../src/constants/roles');

function testDatabaseName(uri) {
  if (!uri) throw new Error('TEST_DATABASE_SAFETY_ERROR: MONGODB_TEST_URI is required');
  let name;
  try { name = decodeURIComponent(new URL(uri).pathname).replace(/^\/+/, '').split('/')[0]; } catch { throw new Error('TEST_DATABASE_SAFETY_ERROR: MONGODB_TEST_URI is invalid'); }
  const normalized = name.toLowerCase();
  if (normalized === 'audiotalents' || !normalized.includes('phase36c') || !normalized.includes('test')) throw new Error('TEST_DATABASE_SAFETY_ERROR: only phase36c test database is permitted');
  return name;
}
function assertTestDatabase(expected) { const status = getDatabaseStatus(); assert.equal(status.state, 'CONNECTED'); assert.equal(status.database, expected); assert.notEqual(status.database, 'audiotalents'); }
async function closeServer(server) { if (server?.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
async function request(port, path, options = {}) { const response = await fetch(`http://127.0.0.1:${port}${path}`, options); return {status: response.status, body: await response.json()}; }
function latestCode(deliveries, email) { const message = [...deliveries].reverse().find(item => item.to === email && item.purpose === 'EMAIL_VERIFICATION'); assert.ok(message); return message.code; }

test('Personalization Mongo persistence, resume, favorites, playlists, and reconnect use only a disposable test database', {timeout: 60_000}, async () => {
  const testUri = process.env.MONGODB_TEST_URI;
  const databaseName = testDatabaseName(testUri);
  const deliveries = [];
  let startupServer;
  let apiServer;
  resetIdentityRepositoriesToProduction();
  resetContentRepositoriesToProduction();
  resetPersonalizationRepositoriesToProduction();
  emailService.setTestDelivery(async message => { deliveries.push(message); });

  try {
    await connectDatabase(testUri);
    assertTestDatabase(databaseName);
    await User.db.dropDatabase();
    await disconnectDatabase();

    startupServer = await startServer({databaseUri: testUri, port: 0});
    assertTestDatabase(databaseName);
    assert.equal(await LibraryItem.countDocuments(), 0);
    assert.equal(await ListenHistory.countDocuments(), 0);
    assert.equal(await Playlist.countDocuments(), 0);
    await closeServer(startupServer);
    startupServer = null;
    await disconnectDatabase();

    await connectDatabase(testUri);
    assertTestDatabase(databaseName);
    // Index initialization is scoped exclusively to the guarded disposable DB.
    await Promise.all([User.init(), Genre.init(), Story.init(), Chapter.init(), Audio.init(), LibraryItem.init(), ListenHistory.init(), Playlist.init()]);

    const email = 'phase36c-owner@example.test';
    const password = 'password123';
    await authService.register({username: 'Phase 36C Owner', email, password});
    await authService.verifyEmail(email, latestCode(deliveries, email));
    let owner = await getIdentityRepositories().user.findByEmail(email);
    await getIdentityRepositories().user.setAuthorStatus(owner.id, AUTHOR_STATUS.APPROVED);
    owner = await getIdentityRepositories().user.findById(owner.id);
    const adminActor = {...owner, role: ROLES.ADMIN};
    const otherEmail = 'phase36c-other@example.test';
    await authService.register({username: 'Phase 36C Other', email: otherEmail, password});
    await authService.verifyEmail(otherEmail, latestCode(deliveries, otherEmail));
    const other = await getIdentityRepositories().user.findByEmail(otherEmail);

    const genre = await genreService.create({name: 'Phase 36C Genre', slug: 'phase36c-genre'});
    const publicStory = await storyService.create({title: 'Phase 36C Public', description: 'Persistent public content', genres: [genre.slug]}, owner);
    const draftStory = await storyService.create({title: 'Phase 36C Draft', description: 'Private content', genres: [genre.slug]}, owner);
    const privateStory = await storyService.create({title: 'Phase 36C Private', description: 'Private approved content', genres: [genre.slug]}, owner);
    const deletedStory = await storyService.create({title: 'Phase 36C Deleted', description: 'Deleted content', genres: [genre.slug]}, owner);
    await storyService.moderate(publicStory.id, 'APPROVED', adminActor);
    await storyService.moderate(privateStory.id, 'APPROVED', adminActor);
    await getContentRepositories().story.updateEditable(privateStory.id, {visibility: 'PRIVATE'});
    await storyService.moderate(deletedStory.id, 'APPROVED', adminActor);

    const chapter = await chapterService.create(publicStory.id, {chapterNumber: 1, title: 'One'}, owner);
    await chapterService.moderate(chapter.id, 'APPROVED', adminActor);
    const audioA = await audioService.create({chapterId: chapter.id, title: 'Default voice', audioUrl: 'https://cdn.example.test/phase36c-a.mp3', durationSec: 100, status: 'UPLOADING'}, owner);
    const audioB = await audioService.create({chapterId: chapter.id, title: 'Second voice', audioUrl: 'https://cdn.example.test/phase36c-b.mp3', durationSec: 200, status: 'UPLOADING'}, owner);
    for (const audio of [audioA, audioB]) { await audioService.moderate(audio.id, 'APPROVED', adminActor); await getContentRepositories().audio.updateProcessing(audio.id, 'READY'); }
    await audioService.setPrimaryAudio(chapter.id, audioA.id, owner);

    const beforeListenCount = (await Story.findById(publicStory.id).lean().exec()).listenCount;
    const favoriteOn = await libraryService.toggle({...owner, userId: 'attacker'}, publicStory.id, 'FAVORITE');
    assert.equal(favoriteOn.active, true);
    await libraryService.toggle(owner, publicStory.id, 'FOLLOW');
    let libraryRows = await LibraryItem.find({userId: owner.id, storyId: publicStory.id}).lean().exec();
    assert.equal(libraryRows.length, 1);
    assert.equal(libraryRows[0].isFavorite, true);
    assert.equal(libraryRows[0].followed, true);
    assert.equal(libraryRows[0].type, undefined);
    assert.equal(String(libraryRows[0].userId), owner.id);
    assert.equal((await Story.findById(publicStory.id).lean().exec()).favoriteCount, 1);
    await assert.rejects(() => getPersonalizationRepositories().libraryItem.createLibraryItem({userId: owner.id, storyId: publicStory.id, isFavorite: true}), error => error.code === 'LIBRARY_ITEM_EXISTS');
    await libraryService.toggle(owner, publicStory.id, 'FAVORITE');
    assert.equal((await Story.findById(publicStory.id).lean().exec()).favoriteCount, 0);
    await libraryService.toggle(owner, publicStory.id, 'FOLLOW');
    assert.equal(await LibraryItem.countDocuments({userId: owner.id, storyId: publicStory.id}), 0);

    await libraryService.toggle(owner, publicStory.id, 'FAVORITE');
    const progressA = await libraryService.saveProgress(owner, {storyId: publicStory.id, chapterId: chapter.id, audioId: audioA.id, positionSeconds: 50, durationSec: 100});
    const progressB = await libraryService.saveProgress(owner, {storyId: publicStory.id, chapterId: chapter.id, audioId: audioB.id, positionSeconds: 50, durationSec: 200});
    assert.equal(progressA.id, progressB.id);
    assert.equal(await ListenHistory.countDocuments({userId: owner.id, chapterId: chapter.id}), 1);
    let history = await ListenHistory.findOne({userId: owner.id, chapterId: chapter.id}).lean().exec();
    assert.equal(String(history.audioId), audioB.id);
    assert.equal(history.positionSec, 50);
    assert.equal(history.progressPercent, 25);
    await getContentRepositories().audio.unsetPrimaryForChapter(chapter.id);
    await assert.rejects(() => libraryService.saveProgress(owner, {storyId: publicStory.id, chapterId: chapter.id, positionSeconds: 1}), error => error.code === 'NOT_FOUND');
    await audioService.setPrimaryAudio(chapter.id, audioA.id, owner);
    const legacyProgress = await libraryService.saveProgress(owner, {storyId: publicStory.id, chapterId: chapter.id, positionSeconds: 20});
    history = await ListenHistory.findById(legacyProgress.id).lean().exec();
    assert.equal(String(history.audioId), audioA.id);
    assert.equal((await Story.findById(publicStory.id).lean().exec()).listenCount, beforeListenCount);
    for (const invalid of [{positionSeconds: -1}, {positionSeconds: 1, durationSec: -1}, {positionSeconds: 1, progressPercent: 101}]) {
      await assert.rejects(() => libraryService.saveProgress(owner, {storyId: publicStory.id, chapterId: chapter.id, ...invalid}), error => error.code === 'PERSISTENCE_VALIDATION_ERROR');
    }
    await libraryService.saveProgress(owner, {storyId: publicStory.id, chapterId: chapter.id, positionSeconds: 100, durationSec: 100, completed: true});
    assert.equal(await ListenHistory.countDocuments({userId: owner.id, chapterId: chapter.id}), 1);
    assert.equal((await getPersonalizationRepositories().listenHistory.listContinueListening(owner.id)).length, 0);
    await assert.rejects(() => libraryService.saveProgress(owner, {storyId: publicStory.id, chapterId: chapter.id, audioId: draftStory.id, positionSeconds: 1}), error => error.code === 'NOT_FOUND');
    await assert.rejects(() => getPersonalizationRepositories().listenHistory.createHistory({userId: owner.id, storyId: publicStory.id, chapterId: chapter.id, audioId: audioA.id}), error => error.code === 'LISTEN_HISTORY_EXISTS');

    const privatePlaylist = await playlistService.create(owner, {name: 'Private', userId: other.id});
    assert.equal(privatePlaylist.userId, owner.id);
    await assert.rejects(() => playlistService.update(other, privatePlaylist.id, {name: 'Hack'}), error => error.code === 'NOT_FOUND');
    await assert.rejects(() => playlistService.getPublic(privatePlaylist.id), error => error.code === 'NOT_FOUND');
    const publicPlaylist = await playlistService.create(owner, {name: 'Public list'});
    for (const story of [publicStory, draftStory, privateStory, deletedStory]) await playlistService.changeStory(owner, publicPlaylist.id, story.id, true);
    await playlistService.changeStory(owner, publicPlaylist.id, publicStory.id, true);
    await getPersonalizationRepositories().playlist.setVisibility(publicPlaylist.id, 'PUBLIC');
    await storyService.remove(deletedStory.id, owner);
    let storedPlaylist = await Playlist.findById(publicPlaylist.id).lean().exec();
    assert.equal(String(storedPlaylist.userId), owner.id);
    assert.equal(storedPlaylist.storyIds.length, 4);
    assert.equal(storedPlaylist.visibility, 'PUBLIC');
    assert.equal(storedPlaylist.playlistItems, undefined);
    const publicView = await playlistService.getPublic(publicPlaylist.id);
    assert.deepEqual(publicView.storyIds, [publicStory.id]);
    await playlistService.changeStory(owner, publicPlaylist.id, draftStory.id, false);
    storedPlaylist = await Playlist.findById(publicPlaylist.id).lean().exec();
    assert.equal(storedPlaylist.storyIds.map(String).includes(draftStory.id), false);
    await assert.rejects(() => getPersonalizationRepositories().playlist.createPlaylist({userId: owner.id, name: 'Bad', visibility: 'UNLISTED'}), error => error.code === 'PERSISTENCE_VALIDATION_ERROR');
    await assert.rejects(() => playlistService.update(owner, 'not-an-objectid', {name: 'Bad'}), error => error.code === 'INVALID_ID');

    const login = await authService.login({email, password});
    apiServer = http.createServer(app);
    await new Promise(resolve => apiServer.listen(0, resolve));
    const port = apiServer.address().port;
    for (const path of ['/api/library', '/api/library/favorites', '/api/library/progress', '/api/playlists']) {
      const response = await request(port, path, {headers: {authorization: `Bearer ${login.accessToken}`}});
      assert.equal(response.status, 200, path);
      const serialized = JSON.stringify(response.body);
      assert.equal(serialized.includes('"_id"'), false);
      assert.equal(serialized.includes('"__v"'), false);
    }

    await disconnectDatabase();
    await connectDatabase(testUri);
    assertTestDatabase(databaseName);
    assert.ok(await LibraryItem.findOne({userId: owner.id, storyId: publicStory.id}).lean().exec());
    history = await ListenHistory.findOne({userId: owner.id, chapterId: chapter.id}).lean().exec();
    assert.equal(String(history.audioId), audioA.id);
    assert.equal(history.completed, true);
    storedPlaylist = await Playlist.findById(publicPlaylist.id).lean().exec();
    assert.equal(storedPlaylist.visibility, 'PUBLIC');
  } finally {
    await closeServer(apiServer);
    await closeServer(startupServer);
    emailService.clearTestDelivery();
    if (getDatabaseStatus().state === 'CONNECTED') { assertTestDatabase(databaseName); await User.db.dropDatabase(); await disconnectDatabase(); }
    resetIdentityRepositoriesToProduction();
    resetContentRepositoriesToProduction();
    resetPersonalizationRepositoriesToProduction();
  }
});
