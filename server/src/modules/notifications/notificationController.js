const {success} = require('../../utils/response');
const {AppError} = require('../../utils/AppError');
const service = require('./notificationService');

async function list(req, res) {
  return success(res, 'Notifications retrieved', await service.list(req.user.id));
}

async function markRead(req, res) {
  const result = await service.markRead(req.user.id, req.params.id);
  if (!result) throw new AppError('Notification not found', 404, 'NOT_FOUND');
  return success(res, 'Notification marked as read', result);
}

async function markAllRead(req, res) {
  return success(res, 'All notifications marked as read', await service.markAllRead(req.user.id));
}

module.exports = {list, markRead, markAllRead};
