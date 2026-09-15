const {AppError} = require('../../utils/AppError');
const {getCommunityRepositories} = require('../../repositories/communityRuntime');
const {getContentRepositories} = require('../../repositories/contentRuntime');
const {getIdentityRepositories} = require('../../repositories/identityRuntime');

function sameId(left, right) { return String(left) === String(right); }
function legacyFields(source, fields) {
  const result = {};
  for (const field of fields) if (source[field] !== undefined) result[field] = source[field];
  return result;
}
function legacyComment(comment) { return comment && {...legacyFields(comment, ['id', 'userId', 'storyId', 'createdAt', 'updatedAt']), type: 'COMMENT', text: comment.content}; }
function legacyRating(rating) { return rating && {...legacyFields(rating, ['id', 'userId', 'storyId', 'createdAt', 'updatedAt']), type: 'RATING', value: rating.stars}; }
function legacyReport(report) { return report && {...legacyFields(report, ['id', 'reporterId', 'reportType', 'description', 'status', 'createdAt', 'updatedAt']), type: 'REPORT', chapterId: report.targetId, resolvedAt: report.reviewedAt || null}; }

async function requireStory(storyId) {
  const story = await getContentRepositories().story.findById(storyId);
  if (!story) throw new AppError('Story not found', 404, 'NOT_FOUND');
  return story;
}

async function comments(storyId) { return (await getCommunityRepositories().comment.listByStory(storyId)).map(legacyComment); }

async function addComment(userId, storyId, text, {chapterId, parentCommentId} = {}) {
  if (!text || !String(text).trim()) throw new AppError('Comment text is required', 422, 'VALIDATION_ERROR');
  const story = await requireStory(storyId);
  const repositories = getCommunityRepositories();
  let chapter = null;
  if (chapterId !== undefined && chapterId !== null) {
    chapter = await getContentRepositories().chapter.findById(chapterId);
    if (!chapter || !sameId(chapter.storyId, story.id)) throw new AppError('Chapter not found', 404, 'NOT_FOUND');
  }
  if (parentCommentId !== undefined && parentCommentId !== null) {
    const parent = await repositories.comment.findById(parentCommentId);
    if (!parent || !sameId(parent.storyId, story.id) || (chapter && !sameId(parent.chapterId, chapter.id))) throw new AppError('Parent comment not found', 404, 'NOT_FOUND');
  }
  return legacyComment(await repositories.comment.createComment({
    userId, storyId: story.id, chapterId: chapter?.id || null, parentCommentId: parentCommentId || null, content: String(text).trim(),
  }));
}

async function synchronizeRating(storyId) {
  const aggregate = await getCommunityRepositories().rating.aggregateForStory(storyId);
  const updatedStory = await getContentRepositories().story.setRatingAggregate(storyId, aggregate);
  if (!updatedStory) throw new AppError('Story not found', 404, 'NOT_FOUND');
  return aggregate;
}

async function synchronizeRatingWithRetry(storyId) {
  try { return await synchronizeRating(storyId); }
  catch (firstError) {
    try { return await synchronizeRating(storyId); }
    catch (secondError) { throw new AppError('Rating aggregate could not be synchronized', 500, 'PERSISTENCE_ERROR'); }
  }
}

async function rate(userId, storyId, value) {
  const stars = Number(value);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new AppError('Rating must be between 1 and 5', 422, 'VALIDATION_ERROR');
  const story = await requireStory(storyId);
  const repository = getCommunityRepositories().rating;
  const existing = await repository.findByUserAndStory(userId, story.id);
  const rating = existing ? await repository.updateRating(existing.id, {stars}) : await repository.createRating({userId, storyId: story.id, stars});
  try {
    await synchronizeRatingWithRetry(story.id);
  } catch (error) {
    try {
      if (existing) await repository.updateRating(existing.id, {stars: existing.stars, review: existing.review});
      else await repository.deleteById(rating.id);
      await synchronizeRatingWithRetry(story.id);
    } catch (compensationError) {
      throw new AppError('Rating persistence could not be reconciled', 500, 'PERSISTENCE_ERROR');
    }
    throw error;
  }
  return legacyRating(rating);
}

async function removeRating(userId, storyId, isAdmin = false) {
  const story = await requireStory(storyId);
  const repository = getCommunityRepositories().rating;
  const existing = await repository.findByUserAndStory(userId, story.id);
  if (!existing) throw new AppError('Rating not found', 404, 'NOT_FOUND');
  if (!isAdmin && !sameId(existing.userId, userId)) throw new AppError('You do not own this rating', 403, 'FORBIDDEN');
  await repository.deleteById(existing.id);
  try {
    await synchronizeRatingWithRetry(story.id);
  } catch (error) {
    try {
      await repository.createRating({userId: existing.userId, storyId: existing.storyId, stars: existing.stars, review: existing.review});
      await synchronizeRatingWithRetry(story.id);
    } catch (compensationError) {
      throw new AppError('Rating persistence could not be reconciled', 500, 'PERSISTENCE_ERROR');
    }
    throw error;
  }
}

async function ratings(storyId) {
  await requireStory(storyId);
  const aggregate = await getCommunityRepositories().rating.aggregateForStory(storyId);
  return {count: aggregate.ratingCount, average: aggregate.ratingAverage};
}

async function report(userId, chapterId, data) {
  const chapter = await getContentRepositories().chapter.findById(chapterId);
  if (!chapter) throw new AppError('Chapter not found', 404, 'NOT_FOUND');
  return legacyReport(await getCommunityRepositories().report.createReport({
    reporterId: userId, targetType: 'CHAPTER', targetId: chapter.id, reportType: data?.reportType ?? data?.type, description: data?.description || '',
  }));
}

async function removeComment(userId, id, isAdmin = false) {
  const repository = getCommunityRepositories().comment;
  const comment = await repository.findById(id);
  if (!comment) throw new AppError('Comment not found', 404, 'NOT_FOUND');
  if (!isAdmin && !sameId(comment.userId, userId)) throw new AppError('You do not own this comment', 403, 'FORBIDDEN');
  await repository.markDeleted(id);
}

async function findReportTarget(targetType, targetId) {
  if (targetType === 'STORY') return getContentRepositories().story.findById(targetId);
  if (targetType === 'CHAPTER') return getContentRepositories().chapter.findById(targetId);
  if (targetType === 'AUDIO') return getContentRepositories().audio.findById(targetId);
  if (targetType === 'COMMENT') return getCommunityRepositories().comment.findById(targetId);
  if (targetType === 'USER') return getIdentityRepositories().user.findById(targetId);
  throw new AppError('Invalid report target type', 422, 'VALIDATION_ERROR');
}

module.exports = {comments, addComment, rate, removeRating, ratings, report, removeComment, findReportTarget, synchronizeRating, legacyComment, legacyRating, legacyReport};
