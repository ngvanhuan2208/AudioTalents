const {success} = require('../../utils/response');
const service = require('./taxonomyService');
async function listTags(req, res) { return success(res, 'Tags retrieved', await service.listTags()); }
async function listAllTags(req, res) { return success(res, 'All tags retrieved', await service.listTags({all: true})); }
async function createTag(req, res) { return success(res, 'Tag created', await service.createTag(req.body, req.user), 201); }
async function updateTag(req, res) { return success(res, 'Tag updated', await service.updateTag(req.params.id, req.body, req.user)); }
async function setTagActive(req, res) { return success(res, 'Tag active state updated', await service.setTagActive(req.params.id, req.body?.isActive === true, req.user)); }
async function createProposal(req, res) { return success(res, 'Taxonomy proposal created', await service.createProposal(req.body, req.user), 201); }
async function listProposals(req, res) { return success(res, 'Taxonomy proposals retrieved', await service.listProposals(req.query, req.user)); }
async function getProposal(req, res) { return success(res, 'Taxonomy proposal retrieved', await service.getProposal(req.params.id, req.user)); }
async function approveProposal(req, res) { return success(res, 'Taxonomy proposal approved', await service.approveProposal(req.params.id, req.body, req.user)); }
async function rejectProposal(req, res) { return success(res, 'Taxonomy proposal rejected', await service.rejectProposal(req.params.id, req.body, req.user)); }
module.exports = {listTags, listAllTags, createTag, updateTag, setTagActive, createProposal, listProposals, getProposal, approveProposal, rejectProposal};
