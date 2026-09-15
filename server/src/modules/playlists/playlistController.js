const {success} = require('../../utils/response');
const service = require('./playlistService');
async function list(req, res) { return success(res, 'Playlists retrieved', await service.list(req.user)); }
async function create(req, res) { return success(res, 'Playlist created', await service.create(req.user, req.body), 201); }
async function update(req, res) { return success(res, 'Playlist updated', await service.update(req.user, req.params.id, req.body)); }
async function remove(req, res) { await service.remove(req.user, req.params.id); return success(res, 'Playlist deleted'); }
async function addStory(req, res) { return success(res, 'Story added to playlist', await service.changeStory(req.user, req.params.id, req.params.storyId, true)); }
async function removeStory(req, res) { return success(res, 'Story removed from playlist', await service.changeStory(req.user, req.params.id, req.params.storyId, false)); }
module.exports = {list, create, update, remove, addStory, removeStory};
