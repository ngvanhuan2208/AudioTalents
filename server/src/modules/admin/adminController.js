const {success} = require('../../utils/response');
const authorApplicationService = require('../authorApplications/authorApplicationService');
const storyService = require('../stories/storyService');
const chapterService = require('../chapters/chapterService');
const audioService = require('../audio/audioService');
const {getContentRepositories} = require('../../repositories/contentRuntime');
const {auditLogService} = require('../../services/auditLogService');

async function listAuthorApplications(req, res) {
  return success(res, 'Author applications retrieved', await authorApplicationService.list());
}

async function getAuthorApplication(req, res) {
  return success(res, 'Author application retrieved', await authorApplicationService.getById(req.params.id));
}

async function approveAuthorApplication(req, res) {
  const result = await authorApplicationService.review(req.params.id, req.user.id, 'APPROVED', req.body?.reviewNote);
  await auditLogService.record({actorId: req.user.id, action: 'AUTHOR_APPLICATION_APPROVED', targetType: 'AUTHOR_APPLICATION', targetId: req.params.id, metadata: {reviewNote: req.body?.reviewNote || null}});
  return success(res, 'Author application approved', result);
}

async function rejectAuthorApplication(req, res) {
  const result = await authorApplicationService.review(req.params.id, req.user.id, 'REJECTED', req.body?.reviewNote);
  await auditLogService.record({actorId: req.user.id, action: 'AUTHOR_APPLICATION_REJECTED', targetType: 'AUTHOR_APPLICATION', targetId: req.params.id, metadata: {reviewNote: req.body?.reviewNote || null}});
  return success(res, 'Author application rejected', result);
}

async function listPendingContent(req, res) {
  const repositories = getContentRepositories();
  return success(res, 'Pending content retrieved', {
    stories: await repositories.story.findByReviewStatus('PENDING_REVIEW'),
    chapters: await repositories.chapter.findByModerationStatus('PENDING_REVIEW'),
    audio: await repositories.audio.findByModerationStatus('PENDING_REVIEW')
  });
}

async function approveStory(req, res) {
  const result = await storyService.moderate(req.params.id, 'APPROVED', req.user);
  await auditLogService.record({actorId: req.user.id, action: 'STORY_APPROVED', targetType: 'STORY', targetId: req.params.id, metadata: {}});
  return success(res, 'Story approved', result);
}

async function rejectStory(req, res) {
  const result = await storyService.moderate(req.params.id, 'REJECTED', req.user);
  await auditLogService.record({actorId: req.user.id, action: 'STORY_REJECTED', targetType: 'STORY', targetId: req.params.id, metadata: {}});
  return success(res, 'Story rejected', result);
}

async function revisionStory(req, res) {
  const result = await storyService.moderate(req.params.id, 'REVISION_REQUIRED', req.user);
  await auditLogService.record({actorId: req.user.id, action: 'STORY_REVISION_REQUIRED', targetType: 'STORY', targetId: req.params.id, metadata: {}});
  return success(res, 'Story revision requested', result);
}

async function approveChapter(req, res) {
  const result = await chapterService.moderate(req.params.id, 'APPROVED', req.user);
  await auditLogService.record({actorId: req.user.id, action: 'CHAPTER_APPROVED', targetType: 'CHAPTER', targetId: req.params.id, metadata: {}});
  return success(res, 'Chapter approved', result);
}

async function rejectChapter(req, res) {
  const result = await chapterService.moderate(req.params.id, 'REJECTED', req.user);
  await auditLogService.record({actorId: req.user.id, action: 'CHAPTER_REJECTED', targetType: 'CHAPTER', targetId: req.params.id, metadata: {}});
  return success(res, 'Chapter rejected', result);
}

async function revisionChapter(req, res) {
  const result = await chapterService.moderate(req.params.id, 'REVISION_REQUIRED', req.user);
  await auditLogService.record({actorId: req.user.id, action: 'CHAPTER_REVISION_REQUIRED', targetType: 'CHAPTER', targetId: req.params.id, metadata: {}});
  return success(res, 'Chapter revision requested', result);
}

async function approveAudio(req, res) {
  const result = await audioService.moderate(req.params.id, 'APPROVED', req.user);
  await auditLogService.record({actorId: req.user.id, action: 'AUDIO_APPROVED', targetType: 'AUDIO', targetId: req.params.id, metadata: {}});
  return success(res, 'Audio approved', result);
}

async function rejectAudio(req, res) {
  const result = await audioService.moderate(req.params.id, 'REJECTED', req.user);
  await auditLogService.record({actorId: req.user.id, action: 'AUDIO_REJECTED', targetType: 'AUDIO', targetId: req.params.id, metadata: {}});
  return success(res, 'Audio rejected', result);
}

async function revisionAudio(req, res) {
  const result = await audioService.moderate(req.params.id, 'REVISION_REQUIRED', req.user);
  await auditLogService.record({actorId: req.user.id, action: 'AUDIO_REVISION_REQUIRED', targetType: 'AUDIO', targetId: req.params.id, metadata: {}});
  return success(res, 'Audio revision requested', result);
}

module.exports = {
  listAuthorApplications, getAuthorApplication, approveAuthorApplication, rejectAuthorApplication,
  listPendingContent,
  approveStory, rejectStory, revisionStory,
  approveChapter, rejectChapter, revisionChapter,
  approveAudio, rejectAudio, revisionAudio
};
