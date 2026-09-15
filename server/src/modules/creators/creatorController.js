const {success} = require('../../utils/response');
const service = require('./creatorService');
const authorApplicationService = require('../authorApplications/authorApplicationService');
async function apply(req, res) { return success(res, 'Author application submitted', await authorApplicationService.submit(req.user.id, req.body), 201); }
function list(req, res) { return success(res, 'Creators retrieved', service.list()); }
function getBySlug(req, res) { return success(res, 'Creator retrieved', service.getBySlug(req.params.slug)); }
function follow(req, res) { return success(res, 'Creator follow is ready for implementation', {creatorId: req.params.id}); }
module.exports = {apply, list, getBySlug, follow};
