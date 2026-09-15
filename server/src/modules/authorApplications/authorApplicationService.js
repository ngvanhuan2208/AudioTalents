const {AppError} = require('../../utils/AppError');
const {creatorRepository} = require('../../repositories/creatorRepository');
const {getIdentityRepositories} = require('../../repositories/identityRuntime');
const {AUTHOR_STATUS} = require('../../constants/roles');

async function submit(userId, data) {
  const repositories = getIdentityRepositories();
  const user = await repositories.user.findById(userId);
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
  if (!user.emailVerified) throw new AppError('Email verification is required', 403, 'EMAIL_NOT_VERIFIED');
  if (user.authorStatus === AUTHOR_STATUS.APPROVED) throw new AppError('User is already an approved author', 409, 'CONFLICT');
  if (user.authorStatus === AUTHOR_STATUS.PENDING || await repositories.authorApplication.findPendingByUserId(userId)) {
    throw new AppError('Author application is already pending', 409, 'CONFLICT');
  }
  if (!data.displayName || !data.bio || data.copyrightAgreement !== true) throw new AppError('displayName, bio and copyrightAgreement are required', 422, 'VALIDATION_ERROR');

  let application;
  try {
    application = await repositories.authorApplication.createPendingApplication({
      userId, displayName: data.displayName.trim(), bio: data.bio.trim(), contentTypes: data.contentTypes || [],
      experience: data.experience || '', submittedAt: new Date(),
    });
  } catch (error) {
    if (error.code === 'APPLICATION_ALREADY_PENDING') throw new AppError('Author application is already pending', 409, 'CONFLICT');
    throw error;
  }

  try {
    const updatedUser = await repositories.user.setAuthorStatus(userId, AUTHOR_STATUS.PENDING);
    if (!updatedUser) throw new AppError('User not found', 404, 'NOT_FOUND');
  } catch (error) {
    // A standalone Mongo deployment has no cross-collection transaction here.
    // Cancel the just-created pending row so retries cannot leave a silent split state.
    try {
      await repositories.authorApplication.cancelPendingApplication(application.id, 'Submission compensation: user status update failed');
    } catch (compensationError) {
      throw new AppError('Author application persistence could not be reconciled', 500, 'PERSISTENCE_ERROR');
    }
    throw error;
  }
  return application;
}

async function getMine(userId) { return getIdentityRepositories().authorApplication.findByUserId(userId); }
async function list() { return getIdentityRepositories().authorApplication.listPending(); }
async function getById(id) {
  const application = await getIdentityRepositories().authorApplication.findById(id);
  if (!application) throw new AppError('Author application not found', 404, 'NOT_FOUND');
  return application;
}

async function review(id, adminId, status, reviewNote) {
  const repositories = getIdentityRepositories();
  const application = await getById(id);
  if (application.status !== AUTHOR_STATUS.PENDING) throw new AppError('Author application is no longer pending', 409, 'CONFLICT');
  if (![AUTHOR_STATUS.APPROVED, AUTHOR_STATUS.REJECTED].includes(status)) throw new AppError('Invalid review status', 422, 'VALIDATION_ERROR');
  if (status === AUTHOR_STATUS.REJECTED && !reviewNote) throw new AppError('Review note is required when rejecting', 422, 'VALIDATION_ERROR');

  const previousAuthorStatus = (await repositories.user.findById(application.userId))?.authorStatus || AUTHOR_STATUS.NONE;
  const updatedUser = await repositories.user.setAuthorStatus(application.userId, status);
  if (!updatedUser) throw new AppError('User not found', 404, 'NOT_FOUND');
  let updated;
  try {
    updated = await repositories.authorApplication.reviewApplication(id, {
      status, reviewedAt: new Date(), reviewedBy: adminId, reviewNote: reviewNote || null,
    });
    if (!updated) throw new AppError('Author application not found', 404, 'NOT_FOUND');
  } catch (error) {
    try {
      await repositories.user.setAuthorStatus(application.userId, previousAuthorStatus);
    } catch (compensationError) {
      throw new AppError('Author application persistence could not be reconciled', 500, 'PERSISTENCE_ERROR');
    }
    throw error;
  }

  if (status === AUTHOR_STATUS.APPROVED && !creatorRepository.findByUserId(application.userId)) {
    const user = await repositories.user.findById(application.userId);
    const slug = `${application.displayName}-${application.userId.slice(0, 8)}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    creatorRepository.create({userId: application.userId, displayName: application.displayName, slug, avatar: user.profile?.avatar || null, bio: application.bio, description: '', verificationStatus: 'APPROVED', followerCount: 0});
  }
  return updated;
}

module.exports = {submit, getMine, list, getById, review};
