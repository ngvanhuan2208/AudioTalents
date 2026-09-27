const {AppError} = require('../../utils/AppError');
const {getIdentityRepositories} = require('../../repositories/identityRuntime');
const {publicUser} = require('../auth/authService');

async function updateMe(userId, changes) {
  const repository = getIdentityRepositories().user;
  const user = await repository.findById(userId);
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');

  const allowed = {};
  if (changes.username !== undefined) allowed.username = String(changes.username).trim();
  if (changes.bio !== undefined || changes.avatar !== undefined) {
    allowed.profile = {
      ...(user.profile || {}),
      ...(changes.bio !== undefined ? {bio: String(changes.bio).trim()} : {}),
      ...(changes.avatar !== undefined ? {avatar: changes.avatar} : {})
    };
  }

  const safeChanges = {
    ...allowed,
    ...(allowed.profile ? {profile: allowed.profile} : {})
  };

  const updated = await repository.updateProfile(userId, safeChanges);
  return publicUser(updated);
}

async function getById(id) {
  const user = await getIdentityRepositories().user.findById(id);
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
  return publicUser(user);
}

async function getPublicById(id) {
  const user = await getIdentityRepositories().user.findById(id);
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
  const {username, role, authorStatus, profile, createdAt} = user;
  return {id: user.id, username, role, authorStatus, profile, createdAt};
}

module.exports = {updateMe, getById, getPublicById};
