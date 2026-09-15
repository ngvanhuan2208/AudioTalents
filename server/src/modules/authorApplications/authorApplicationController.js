const {success} = require('../../utils/response');
const service = require('./authorApplicationService');
async function submit(req, res) { return success(res, 'Author application submitted', await service.submit(req.user.id, req.body), 201); }
async function getMine(req, res) { return success(res, 'Author application retrieved', await service.getMine(req.user.id)); }
async function list(req, res) { return success(res, 'Pending author applications retrieved', await service.list()); }
async function getById(req, res) { return success(res, 'Author application retrieved', await service.getById(req.params.id)); }
async function approve(req, res) { return success(res, 'Author application approved', await service.review(req.params.id, req.user.id, 'APPROVED', req.body.reviewNote)); }
async function reject(req, res) { return success(res, 'Author application rejected', await service.review(req.params.id, req.user.id, 'REJECTED', req.body.reviewNote)); }
module.exports = {submit, getMine, list, getById, approve, reject};
