const {AppError} = require('../../utils/AppError');
const {ROLES} = require('../../constants/roles');
const {getPersonalizationRepositories} = require('../../repositories/personalizationRuntime');
const {getContentRepositories} = require('../../repositories/contentRuntime');

function actor(user) { return typeof user === 'string' ? {id: user, role: ROLES.USER} : user; }
function sameId(left, right) { return String(left) === String(right); }
function legacyLibraryItem(item, type = 'LIBRARY') { return {...item, type}; }
function legacyProgress(item, type = 'PROGRESS') { return {...item, type, positionSeconds: item.positionSec}; }

async function requireStory(storyId, user) {
  const story = await getContentRepositories().story.findById(storyId);
  if (!story) throw new AppError('Story not found', 404, 'NOT_FOUND');
  const owner = user.role === ROLES.ADMIN || sameId(story.creatorId, user.id);
  if (!owner && (story.reviewStatus !== 'APPROVED' || story.visibility !== 'PUBLIC')) throw new AppError('Story not found', 404, 'NOT_FOUND');
  return story;
}

async function getOrCreateAggregate(userId, storyId) {
  const repository = getPersonalizationRepositories().libraryItem;
  let item = await repository.findByUserAndStory(userId, storyId);
  if (!item) item = await repository.upsertState({userId, storyId, isFavorite: false, followed: false});
  return item;
}

async function visibleItems(items, user, map) {
  const visible = [];
  for (const item of items) {
    try { await requireStory(item.storyId, user); visible.push(map(item)); } catch (error) { if (error.code !== 'NOT_FOUND') throw error; }
  }
  return visible;
}

async function list(user, type) {
  const currentUser = actor(user);
  const repositories = getPersonalizationRepositories();
  if (type === 'FAVORITE') return visibleItems(await repositories.libraryItem.listFavoritesByUser(currentUser.id), currentUser, item => legacyLibraryItem(item, 'FAVORITE'));
  if (type === 'FOLLOW' || type === 'FOLLOWED') return visibleItems(await repositories.libraryItem.listFollowedByUser(currentUser.id), currentUser, item => legacyLibraryItem(item, 'FOLLOW'));
  if (type === 'PROGRESS') return (await repositories.listenHistory.listContinueListening(currentUser.id)).map(item => legacyProgress(item));
  if (type === 'HISTORY') return (await repositories.listenHistory.listContinueListening(currentUser.id)).map(item => legacyProgress(item, 'HISTORY'));
  return visibleItems(await repositories.libraryItem.listByUser(currentUser.id), currentUser, item => legacyLibraryItem(item));
}

async function addStory(user, storyId) {
  const currentUser = actor(user);
  await requireStory(storyId, currentUser);
  return legacyLibraryItem(await getOrCreateAggregate(currentUser.id, storyId));
}

async function removeStory(user, storyId) {
  const currentUser = actor(user);
  const repository = getPersonalizationRepositories().libraryItem;
  const item = await repository.findByUserAndStory(currentUser.id, storyId);
  if (!item || item.isFavorite || item.followed) throw new AppError('Story not found in library', 404, 'NOT_FOUND');
  await repository.removeIfEmpty(currentUser.id, storyId);
  return legacyLibraryItem(item);
}

async function toggle(user, storyId, type) {
  const currentUser = actor(user);
  const story = await requireStory(storyId, currentUser);
  const repository = getPersonalizationRepositories().libraryItem;
  const existing = await getOrCreateAggregate(currentUser.id, story.id);
  if (type === 'FAVORITE') {
    const desired = !existing.isFavorite;
    const transition = await repository.setFavorite(currentUser.id, story.id, desired);
    if (transition.changed && (desired || (story.favoriteCount || 0) > 0)) {
      const delta = desired ? 1 : -1;
      try { await getContentRepositories().story.incrementFavoriteCount(story.id, delta); }
      catch (error) { await repository.setFavorite(currentUser.id, story.id, !desired).catch(() => {}); throw error; }
    }
    const item = await repository.findByUserAndStory(currentUser.id, story.id);
    if (!desired) await repository.removeIfEmpty(currentUser.id, story.id);
    return {active: desired, item: legacyLibraryItem(item, 'FAVORITE')};
  }
  if (type === 'FOLLOW') {
    const desired = !existing.followed;
    const item = await repository.setFollowed(currentUser.id, story.id, desired);
    if (!desired) await repository.removeIfEmpty(currentUser.id, story.id);
    return {active: desired, item: legacyLibraryItem(item, 'FOLLOW')};
  }
  throw new AppError('Unsupported library action', 422, 'VALIDATION_ERROR');
}

async function saveProgress(user, data) {
  const currentUser = actor(user);
  if (!data.storyId || !data.chapterId || data.positionSeconds === undefined) throw new AppError('storyId, chapterId and positionSeconds are required', 422, 'VALIDATION_ERROR');
  const story = await requireStory(data.storyId, currentUser);
  const chapter = await getContentRepositories().chapter.findById(data.chapterId);
  if (!chapter || !sameId(chapter.storyId, story.id)) throw new AppError('Chapter not found', 404, 'NOT_FOUND');
  const audio = data.audioId ? await getContentRepositories().audio.findById(data.audioId) : await getContentRepositories().audio.findDefaultPlaybackForChapter(chapter.id);
  if (!audio || !sameId(audio.chapterId, chapter.id) || !sameId(audio.storyId, story.id)) throw new AppError('Audio not found', 404, 'NOT_FOUND');
  const positionSec = Number(data.positionSeconds);
  const durationSec = data.durationSec === undefined ? (audio.durationSec ?? null) : data.durationSec;
  const progressPercent = data.progressPercent === undefined ? (durationSec && Number(durationSec) > 0 ? (positionSec / Number(durationSec)) * 100 : 0) : Number(data.progressPercent);
  const item = await getPersonalizationRepositories().listenHistory.upsertProgress({userId: currentUser.id, storyId: story.id, chapterId: chapter.id, audioId: audio.id, positionSec, durationSec, progressPercent, completed: Boolean(data.completed)});
  return legacyProgress(item);
}

async function removeHistory(user, id) {
  const item = await getPersonalizationRepositories().listenHistory.removeByIdAndUser(id, actor(user).id);
  if (!item) throw new AppError('History item not found', 404, 'NOT_FOUND');
  return item;
}
module.exports = {toggle, list, addStory, removeStory, saveProgress, removeHistory};
