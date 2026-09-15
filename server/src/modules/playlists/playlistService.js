const {AppError} = require('../../utils/AppError');
const {getPersonalizationRepositories} = require('../../repositories/personalizationRuntime');
const {getContentRepositories} = require('../../repositories/contentRuntime');
const {ROLES} = require('../../constants/roles');
function actor(user) { return typeof user === 'string' ? {id: user, role: ROLES.USER} : user; }
function sameId(left, right) { return String(left) === String(right); }
function readableStory(story, user) { return story && (user.role === ROLES.ADMIN || sameId(story.creatorId, user.id) || (story.reviewStatus === 'APPROVED' && story.visibility === 'PUBLIC' && !story.deletedAt)); }
async function ownedPlaylist(user, id) { const playlist = await getPersonalizationRepositories().playlist.findById(id); if (!playlist || !sameId(playlist.userId, actor(user).id)) throw new AppError('Playlist not found', 404, 'NOT_FOUND'); return playlist; }
async function list(user) { return getPersonalizationRepositories().playlist.listByOwner(actor(user).id); }
async function create(user, data) { if (!data.name || data.name.trim().length < 1) throw new AppError('Playlist name is required', 422, 'VALIDATION_ERROR'); return getPersonalizationRepositories().playlist.createPlaylist({userId: actor(user).id, name: data.name.trim(), storyIds: []}); }
async function update(user, id, data) { const playlist = await ownedPlaylist(user, id); return getPersonalizationRepositories().playlist.updateMetadata(id, {name: data.name === undefined ? playlist.name : data.name.trim()}); }
async function remove(user, id) { const playlist = await ownedPlaylist(user, id); await getPersonalizationRepositories().playlist.deleteById(id); return playlist; }
async function changeStory(user, id, storyId, add) { const currentUser = actor(user); await ownedPlaylist(currentUser, id); if (add) { const story = await getContentRepositories().story.findById(storyId); if (!readableStory(story, currentUser)) throw new AppError('Story not found', 404, 'NOT_FOUND'); return getPersonalizationRepositories().playlist.addStory(id, story.id); } return getPersonalizationRepositories().playlist.removeStory(id, storyId); }
async function getPublic(id) { const playlist = await getPersonalizationRepositories().playlist.findPublicById(id); if (!playlist) throw new AppError('Playlist not found', 404, 'NOT_FOUND'); const publicStoryIds = []; for (const storyId of playlist.storyIds) { const story = await getContentRepositories().story.findById(storyId); if (story && story.reviewStatus === 'APPROVED' && story.visibility === 'PUBLIC' && !story.deletedAt) publicStoryIds.push(story.id); } return {...playlist, storyIds: publicStoryIds}; }
module.exports = {list, create, update, remove, changeStory, getPublic};
