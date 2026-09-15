const {success} = require('../../utils/response');
const service = require('./communityService');
async function comments(req, res) { return success(res, 'Comments retrieved', await service.comments(req.params.id)); }
async function addComment(req, res) { return success(res, 'Comment created', await service.addComment(req.user.id, req.params.id, req.body.text), 201); }
async function rate(req, res) { return success(res, 'Rating saved', await service.rate(req.user.id, req.params.id, req.body.value)); }
async function ratings(req, res) { return success(res, 'Ratings retrieved', await service.ratings(req.params.id)); }
async function report(req, res) { return success(res, 'Report created', await service.report(req.user.id, req.params.id, req.body), 201); }
async function removeComment(req, res) { await service.removeComment(req.user.id, req.params.id, req.user.role === 'ADMIN'); return success(res, 'Comment deleted'); }
module.exports = {comments, addComment, rate, ratings, report, removeComment};
