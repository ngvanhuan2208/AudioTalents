const {success} = require('../../utils/response');
const service = require('./userService');
async function getMe(req, res) { return success(res, 'Current profile', await service.getById(req.user.id)); }
async function me(req, res) { return success(res, 'Profile updated', await service.updateMe(req.user.id, req.body)); }
async function getById(req, res) { return success(res, 'User profile', await service.getById(req.params.id)); }
module.exports = {getMe, me, getById};
