const {success} = require('../../utils/response');
const service = require('./audioService');
const {AudioMediaService} = require('./audioMediaService');
const mediaService = new AudioMediaService();
async function list(req, res) { return success(res, 'Audio assets retrieved', await service.list(req.query.chapterId, req.user, {deleted: req.query.deleted === 'true'})); }
async function listPublic(req, res) { return success(res, 'Public audio assets retrieved', await service.listPublic(req.params.chapterId)); }
async function create(req, res) { return success(res, 'Audio asset created', await service.create(req.body, req.user), 201); }
async function update(req, res) { return success(res, 'Audio asset updated', await service.update(req.params.id, req.body, req.user)); }
async function remove(req, res) { await service.remove(req.params.id, req.user); return success(res, 'Audio asset deleted'); }
async function restore(req, res) { return success(res, 'Audio asset restored', await service.restore(req.params.id, req.user)); }
async function submit(req, res) { return success(res, 'Audio asset submitted for review', await service.submit(req.params.id, req.user)); }
async function authorizeUpload(req, res) { return success(res, 'Audio upload authorized', await mediaService.authorizeUpload(req.params.id, req.body || {}, req.user)); }
async function confirmUpload(req, res) { return success(res, 'Audio upload confirmed', await mediaService.confirmUpload(req.params.id, req.body || {}, req.user)); }
async function playbackCapability(req, res) {
  res.set({'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer'});
  return success(res, 'Playback capability issued', await mediaService.issuePlaybackCapability(req.params.id, req.user));
}
async function playback(req, res) {
  const capability = typeof req.query?.capability === 'string' ? req.query.capability : undefined;
  const signed = await mediaService.authorizePlayback(req.params.id, req.user, {playbackCapability: capability});
  res.set({'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer'});
  return res.redirect(302, signed.url);
}
module.exports = {list, listPublic, create, update, remove, restore, submit, authorizeUpload, confirmUpload, playbackCapability, playback};
