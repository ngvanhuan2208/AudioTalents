const {getCommunityRepositories} = require('../../repositories/communityRuntime');

function legacyNotification(notification) {
  if (!notification) return notification;
  const result = {};
  for (const field of ['id', 'userId', 'type', 'title', 'message', 'readAt', 'createdAt', 'updatedAt']) {
    if (notification[field] !== undefined) result[field] = notification[field];
  }
  return result;
}

async function list(userId) { return (await getCommunityRepositories().notification.listByUser(userId)).map(legacyNotification); }
async function markRead(userId, id) { return legacyNotification(await getCommunityRepositories().notification.markRead(userId, id, new Date())); }
async function markAllRead(userId) {
  const repository = getCommunityRepositories().notification;
  await repository.markAllRead(userId, new Date());
  return (await repository.listByUser(userId)).map(legacyNotification);
}

// This is trusted internal input only. There is no public notification-create
// route, so a user request cannot choose notification type or ownership.
async function createInternal(input) { return getCommunityRepositories().notification.createNotification(input); }

module.exports = {list, markRead, markAllRead, createInternal, legacyNotification};
