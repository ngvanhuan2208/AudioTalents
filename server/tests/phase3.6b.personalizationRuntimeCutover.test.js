const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getPersonalizationRepositories,
  configurePersonalizationRepositoriesForTests,
  resetPersonalizationRepositoriesToProduction,
  getContentRepositories,
  configureContentRepositoriesForTests,
  resetContentRepositoriesToProduction,
  LibraryItemMongoRepository,
  ListenHistoryMongoRepository,
  PlaylistMongoRepository,
  getIdentityRepositories,
  UserMongoRepository,
} = require('../src/repositories');
const libraryService = require('../src/modules/library/libraryService');
const playlistService = require('../src/modules/playlists/playlistService');
const {ROLES} = require('../src/constants/roles');

function fixtures({counterFails = false} = {}) {
  const story = {id: 'story-public', creatorId: 'creator', reviewStatus: 'APPROVED', visibility: 'PUBLIC', favoriteCount: 0};
  const hiddenStory = {id: 'story-private', creatorId: 'creator', reviewStatus: 'DRAFT', visibility: 'PRIVATE', favoriteCount: 0};
  const states = new Map();
  const histories = new Map();
  const playlists = new Map([['playlist-1', {id: 'playlist-1', userId: 'owner', name: 'List', visibility: 'PRIVATE', storyIds: []}], ['playlist-public', {id: 'playlist-public', userId: 'owner', name: 'Public', visibility: 'PUBLIC', storyIds: [story.id, hiddenStory.id]}]]);
  const counters = [];
  const libraryItem = {
    async findByUserAndStory(userId, storyId) { return states.get(`${userId}:${storyId}`) || null; },
    async upsertState(input) { const item = states.get(`${input.userId}:${input.storyId}`) || {id: `library-${states.size + 1}`, userId: input.userId, storyId: input.storyId, isFavorite: false, followed: false}; Object.assign(item, input); states.set(`${input.userId}:${input.storyId}`, item); return item; },
    async listByUser(userId) { return [...states.values()].filter(item => item.userId === userId); },
    async listFavoritesByUser(userId) { return [...states.values()].filter(item => item.userId === userId && item.isFavorite); },
    async listFollowedByUser(userId) { return [...states.values()].filter(item => item.userId === userId && item.followed); },
    async setFavorite(userId, storyId, isFavorite) { const item = states.get(`${userId}:${storyId}`); if (!item || item.isFavorite === isFavorite) return {changed: false, previous: item, isFavorite}; const previous = {...item}; item.isFavorite = isFavorite; return {changed: true, previous, isFavorite}; },
    async setFollowed(userId, storyId, followed) { const item = states.get(`${userId}:${storyId}`); item.followed = followed; return item; },
    async removeIfEmpty(userId, storyId) { const item = states.get(`${userId}:${storyId}`); if (item && !item.isFavorite && !item.followed) states.delete(`${userId}:${storyId}`); return item; },
  };
  const listenHistory = {
    async upsertProgress(input) { const key = `${input.userId}:${input.chapterId}`; const item = {...(histories.get(key) || {id: `history-${histories.size + 1}`}), ...input}; histories.set(key, item); return item; },
    async listContinueListening(userId) { return [...histories.values()].filter(item => item.userId === userId && !item.completed).sort((a, b) => b.lastListenedAt - a.lastListenedAt); },
    async removeByIdAndUser(id, userId) { const entry = [...histories.entries()].find(([, item]) => item.id === id && item.userId === userId); if (!entry) return null; histories.delete(entry[0]); return entry[1]; },
  };
  const playlist = {
    async findById(id) { return playlists.get(id) || null; },
    async listByOwner(userId) { return [...playlists.values()].filter(item => item.userId === userId); },
    async findPublicById(id) { const item = playlists.get(id); return item?.visibility === 'PUBLIC' ? item : null; },
    async createPlaylist(input) { const item = {id: `playlist-${playlists.size + 1}`, visibility: 'PRIVATE', ...input}; playlists.set(item.id, item); return item; },
    async updateMetadata(id, input) { const item = playlists.get(id); Object.assign(item, input); return item; },
    async deleteById(id) { const item = playlists.get(id); playlists.delete(id); return item; },
    async addStory(id, storyId) { const item = playlists.get(id); item.storyIds = [...new Set([...item.storyIds, storyId])]; return item; },
    async removeStory(id, storyId) { const item = playlists.get(id); item.storyIds = item.storyIds.filter(value => value !== storyId); return item; },
  };
  const content = {
    runtime: 'FAKE_CONTENT', genre: {},
    story: {
      async findById(id) { return id === story.id ? story : id === hiddenStory.id ? hiddenStory : null; },
      async incrementFavoriteCount(id, delta) { if (counterFails) throw new Error('counter persistence failed'); counters.push({id, delta}); story.favoriteCount += delta; return story; },
    },
    chapter: {async findById(id) { return id === 'chapter-1' ? {id, storyId: story.id} : null; }},
    audio: {async findById(id) { return id === 'audio-1' ? {id, chapterId: 'chapter-1', storyId: story.id, durationSec: 100} : null; }, async findDefaultPlaybackForChapter() { return {id: 'audio-1', chapterId: 'chapter-1', storyId: story.id, durationSec: 100}; }},
  };
  return {repositories: {runtime: 'FAKE_TEST', libraryItem, listenHistory, playlist}, content, states, histories, playlists, counters};
}

test.afterEach(() => { resetPersonalizationRepositoriesToProduction(); resetContentRepositoriesToProduction(); });

test('production Personalization provider is Mongo while Identity and Content remain Mongo', () => {
  const repositories = getPersonalizationRepositories();
  assert.equal(repositories.runtime, 'MONGO');
  assert.ok(repositories.libraryItem instanceof LibraryItemMongoRepository);
  assert.ok(repositories.listenHistory instanceof ListenHistoryMongoRepository);
  assert.ok(repositories.playlist instanceof PlaylistMongoRepository);
  assert.ok(getIdentityRepositories().user instanceof UserMongoRepository);
  assert.equal(getContentRepositories().runtime, 'MONGO');
});

test('favorite transitions coordinate Story.favoriteCount once and compensate on counter failure', async () => {
  const data = fixtures();
  configurePersonalizationRepositoriesForTests(data.repositories);
  configureContentRepositoriesForTests(data.content);
  const user = {id: 'user-1', role: ROLES.USER};
  assert.equal((await libraryService.toggle(user, 'story-public', 'FAVORITE')).active, true);
  assert.deepEqual(data.counters, [{id: 'story-public', delta: 1}]);
  assert.equal((await libraryService.toggle(user, 'story-public', 'FAVORITE')).active, false);
  assert.deepEqual(data.counters, [{id: 'story-public', delta: 1}, {id: 'story-public', delta: -1}]);

  const failing = fixtures({counterFails: true});
  configurePersonalizationRepositoriesForTests(failing.repositories);
  configureContentRepositoriesForTests(failing.content);
  await assert.rejects(() => libraryService.toggle(user, 'story-public', 'FAVORITE'), /counter persistence failed/);
  assert.equal(failing.states.get('user-1:story-public').isFavorite, false);
});

test('Library, progress, and Playlist services derive trusted user IDs and validate content chains', async () => {
  const data = fixtures();
  configurePersonalizationRepositoriesForTests(data.repositories);
  configureContentRepositoriesForTests(data.content);
  const owner = {id: 'owner', role: ROLES.USER};
  const other = {id: 'other', role: ROLES.USER};
  const favorite = await libraryService.toggle({...owner, id: 'user-1'}, 'story-public', 'FAVORITE');
  assert.equal(favorite.item.type, 'FAVORITE');
  assert.equal(favorite.item.userId, 'user-1');
  const progress = await libraryService.saveProgress({...owner, id: 'user-1'}, {userId: 'attacker', storyId: 'story-public', chapterId: 'chapter-1', audioId: 'audio-1', positionSeconds: 25});
  assert.equal(progress.userId, 'user-1');
  assert.equal(data.histories.size, 1);
  await libraryService.saveProgress({...owner, id: 'user-1'}, {storyId: 'story-public', chapterId: 'chapter-1', audioId: 'audio-1', positionSeconds: 50});
  assert.equal(data.histories.size, 1);
  await assert.rejects(() => libraryService.saveProgress(owner, {storyId: 'story-public', chapterId: 'chapter-1', audioId: 'bad', positionSeconds: 1}), error => error.code === 'NOT_FOUND');
  const created = await playlistService.create({...owner, id: 'owner'}, {name: 'Mine', userId: 'attacker'});
  assert.equal(created.userId, 'owner');
  await assert.rejects(() => playlistService.update(other, 'playlist-1', {name: 'Hack'}), error => error.code === 'NOT_FOUND');
  await playlistService.changeStory(owner, 'playlist-1', 'story-public', true);
  await playlistService.changeStory(owner, 'playlist-1', 'story-public', true);
  assert.deepEqual(data.playlists.get('playlist-1').storyIds, ['story-public']);
  const publicView = await playlistService.getPublic('playlist-public');
  assert.deepEqual(publicView.storyIds, ['story-public']);
});
