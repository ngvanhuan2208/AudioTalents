const {success} = require('../../utils/response');
const service = require('./libraryService');
async function list(req, res) { return success(res, 'Library retrieved', await service.list(req.user)); }
async function addStory(req, res) { return success(res, 'Story saved to library', await service.addStory(req.user, req.params.storyId), 201); }
async function removeStory(req, res) { await service.removeStory(req.user, req.params.storyId); return success(res, 'Story removed from library'); }
async function toggleFavorite(req, res) { return success(res, 'Favorite updated', await service.toggle(req.user, req.params.storyId, 'FAVORITE')); }
async function toggleFollow(req, res) { return success(res, 'Follow updated', await service.toggle(req.user, req.params.storyId, 'FOLLOW')); }
async function favorites(req, res) { return success(res, 'Favorites retrieved', await service.list(req.user, 'FAVORITE')); }
async function history(req, res) { return success(res, 'History retrieved', await service.list(req.user, 'HISTORY')); }
async function progress(req, res) { return success(res, 'Progress retrieved', await service.list(req.user, 'PROGRESS')); }
async function saveProgress(req, res) { return success(res, 'Progress saved', await service.saveProgress(req.user, req.body), 201); }
async function removeHistory(req, res) { await service.removeHistory(req.user, req.params.id); return success(res, 'History deleted'); }
module.exports = {list, addStory, removeStory, toggleFavorite, toggleFollow, favorites, history, progress, saveProgress, removeHistory};
