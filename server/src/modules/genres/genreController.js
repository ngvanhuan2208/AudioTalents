const {success} = require('../../utils/response');
const service = require('./genreService');
async function list(req, res) { return success(res, 'Genres retrieved', await service.list()); }
async function listAll(req, res) { return success(res, 'All genres retrieved', await service.listAll()); }
async function getBySlug(req, res) { return success(res, 'Genre retrieved', await service.getBySlug(req.params.slug)); }
async function create(req, res) { return success(res, 'Genre created', await service.create(req.body), 201); }
async function update(req, res) { return success(res, 'Genre updated', await service.update(req.params.id, req.body)); }
async function setActive(req, res) { return success(res, 'Genre active state updated', await service.setActive(req.params.id, req.body?.isActive === true)); }
module.exports = {list, listAll, getBySlug, create, update, setActive};
