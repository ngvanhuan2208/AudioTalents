const {success} = require('../../utils/response');
const service = require('./chapterService');
async function list(req, res) { return success(res, 'Chapters retrieved', await service.list(req.params.storyId, req.user)); }
async function getById(req, res) { return success(res, 'Chapter retrieved', await service.getById(req.params.id, req.user)); }
async function create(req, res) { return success(res, 'Chapter created', await service.create(req.params.storyId, req.body, req.user), 201); }
async function update(req, res) { return success(res, 'Chapter updated', await service.update(req.params.id, req.body, req.user)); }
async function remove(req, res) { await service.remove(req.params.id, req.user); return success(res, 'Chapter deleted'); }
async function publish(req, res) { return success(res, 'Chapter submitted for review', await service.publish(req.params.id, req.user)); }
async function moderate(req, res) { return success(res, 'Chapter moderation updated', await service.moderate(req.params.id, req.body.status, req.user)); }
module.exports = {list, getById, create, update, remove, publish, moderate};
