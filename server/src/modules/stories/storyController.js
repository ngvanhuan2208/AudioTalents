const {success, paginated} = require('../../utils/response');
const {getPagination, buildPagination} = require('../../utils/pagination');
const service = require('./storyService');
async function list(req, res) { const allStories = await service.list(req.query, req.user); const {page, limit, skip} = getPagination(req.query); const items = allStories.slice(skip, skip + limit); return paginated(res, 'Stories retrieved', items, buildPagination(page, limit, allStories.length)); }
async function listMine(req, res) { return success(res, 'Your stories retrieved', await service.listByOwner(req.user)); }
async function getById(req, res) { return success(res, 'Story retrieved', await service.getById(req.params.id, req.user)); }
async function getBySlug(req, res) { return success(res, 'Story retrieved', await service.getBySlug(req.params.slug, req.user)); }
async function create(req, res) { return success(res, 'Story created', await service.create(req.body, req.user), 201); }
async function update(req, res) { return success(res, 'Story updated', await service.update(req.params.id, req.body, req.user)); }
async function remove(req, res) { await service.remove(req.params.id, req.user); return success(res, 'Story deleted'); }
async function submit(req, res) { return success(res, 'Story submitted for review', await service.submit(req.params.id, req.user)); }
async function moderate(req, res) { return success(res, 'Story moderation updated', await service.moderate(req.params.id, req.body.status, req.user)); }
module.exports = {list, listMine, getById, getBySlug, create, update, remove, submit, moderate};
