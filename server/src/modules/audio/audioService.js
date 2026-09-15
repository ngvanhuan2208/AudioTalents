const {AppError} = require('../../utils/AppError');
const {getContentRepositories} = require('../../repositories/contentRuntime');
const {ROLES} = require('../../constants/roles');
const {getStorageProvider, assertStorageKey, StorageError} = require('../../media/storage');
const mongoose = require('mongoose');
function sameId(a, b) { return String(a) === String(b); }
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
function deletedAudioDto(audio) {
  const {id, chapterId, partNumber, title, processingStatus, status, isPrimary, sourceType, voiceType, durationSec, fileSize, mimeType, bitrate, deletedAt, createdAt, updatedAt} = audio;
  return {id, chapterId, partNumber, title, processingStatus, status, isPrimary, sourceType, voiceType, durationSec, fileSize, mimeType, bitrate, deletedAt, createdAt, updatedAt};
}
function assertOwner(audio, user) { if (!audio) throw new AppError('Audio not found', 404, 'NOT_FOUND'); if (user.role !== ROLES.ADMIN && !sameId(audio.creatorId || audio.ownerId, user.id)) throw new AppError('You do not own this audio', 403, 'FORBIDDEN'); }
function assertAudioReference(audioUrl) { if (typeof audioUrl !== 'string' || /^data:audio\//i.test(audioUrl)) throw new AppError('audioUrl must be a non-binary storage reference', 422, 'VALIDATION_ERROR'); }
async function create(data, user, {repositories = getContentRepositories()} = {}) { if (user.role !== ROLES.ADMIN && user.authorStatus !== 'APPROVED') throw new AppError('Approved author permission is required', 403, 'FORBIDDEN'); const repos = repositories; if (!data.chapterId) throw new AppError('chapterId is required', 422, 'VALIDATION_ERROR'); const chapter = await repos.chapter.findById(data.chapterId); if (!chapter) throw new AppError('Chapter not found', 404, 'NOT_FOUND'); const story = await repos.story.findById(chapter.storyId); if (!story || (user.role !== ROLES.ADMIN && !sameId(story.creatorId, user.id))) throw new AppError('You do not own this chapter', 403, 'FORBIDDEN'); const maxPart = repos.audio.findMaxPartNumberByChapter ? await repos.audio.findMaxPartNumberByChapter(chapter.id) : Math.max(0, ...(await repos.audio.findByChapter(chapter.id)).map(item => Number.isInteger(item.partNumber) ? item.partNumber : 0)); const partNumber = maxPart + 1; const id = new mongoose.Types.ObjectId().toString(); try { return await repos.audio.createAudio({id, storyId: story.id, chapterId: chapter.id, creatorId: story.creatorId, partNumber, title: data.title || 'Untitled Audio', sourceType: data.sourceType || 'HUMAN', voiceType: data.voiceType, transcript: data.transcript, status: 'DRAFT', processingStatus: 'PENDING', storageKey: null, audioUrl: `/api/audio/${id}/playback`, fileSize: null, mimeType: null, durationSec: null, bitrate: null}); } catch (error) { if (error.code === 'AUDIO_PART_CONFLICT') throw new AppError('Tập Audio vừa được tạo bởi phiên khác. Vui lòng tải lại danh sách và thử lại.', 409, 'AUDIO_PART_CONFLICT'); throw error; } }
async function list(chapterId, user, {deleted = false, repositories = getContentRepositories()} = {}) {
  if (!user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  if (!chapterId) { if (user.role === ROLES.ADMIN) return []; throw new AppError('chapterId is required', 422, 'VALIDATION_ERROR'); }
  const chapter = await repositories.chapter.findById(chapterId);
  if (!chapter) throw new AppError('Chapter not found', 404, 'NOT_FOUND');
  const story = await repositories.story.findById(chapter.storyId);
  if (user.role !== ROLES.ADMIN && !sameId(story?.creatorId, user.id)) throw new AppError('You do not own this chapter', 403, 'FORBIDDEN');
  if (deleted && user.role !== ROLES.ADMIN && user.authorStatus !== 'APPROVED') throw new AppError('Approved author permission is required', 403, 'FORBIDDEN');
  const rows = deleted ? await repositories.audio.findDeletedByChapter(chapter.id) : await repositories.audio.findByChapter(chapter.id);
  return deleted ? rows.map(deletedAudioDto) : rows;
}
async function listPublic(chapterId) { const repos = getContentRepositories(); const chapter = await repos.chapter.findById(chapterId); if (!chapter) throw new AppError('Chapter not found', 404, 'NOT_FOUND'); const story = await repos.story.findById(chapter.storyId); if (chapter.status !== 'APPROVED' || story?.reviewStatus !== 'APPROVED' || story.visibility !== 'PUBLIC') return []; return repos.audio.findPublicVoicesForChapter(chapter.id); }
async function getDefaultPlayback(chapterId) { const repos = getContentRepositories(); const chapter = await repos.chapter.findById(chapterId); if (!chapter) throw new AppError('Chapter not found', 404, 'NOT_FOUND'); const story = await repos.story.findById(chapter.storyId); if (chapter.status !== 'APPROVED' || story?.reviewStatus !== 'APPROVED' || story.visibility !== 'PUBLIC') return null; return repos.audio.findDefaultPlaybackForChapter(chapter.id); }
async function update(id, data, user) { const audio = await getContentRepositories().audio.findById(id); assertOwner(audio, user); const changes = {...data}; for (const key of ['ownerId','creatorId','storyId','chapterId','partNumber','status','processingStatus','isPrimary','storageKey','audioUrl','fileSize','mimeType','durationSec','bitrate']) delete changes[key]; return getContentRepositories().audio.updateMetadata(id, changes); }
async function remove(id, user) { const repos = getContentRepositories(); const audio = await repos.audio.findById(id); assertOwner(audio, user); if (audio.isPrimary) await repos.audio.unsetPrimaryForChapter(audio.chapterId); await repos.audio.softDelete(id, user.id); return audio; }
// There is intentionally no route for this internal lifecycle operation yet.
// Keeping it here means any future caller shares the same retention, parent,
// and storage invariants instead of calling the repository's legacy restore().
async function restore(id, user, {now = new Date(), repositories = getContentRepositories(), storageProvider = getStorageProvider()} = {}) {
  const current = now instanceof Date ? new Date(now) : new Date(now);
  if (Number.isNaN(current.getTime())) throw new AppError('Invalid restore clock', 422, 'VALIDATION_ERROR');
  const audio = await repositories.audio.findById(id, {includeDeleted: true});
  assertOwner(audio, user);
  if (!audio.deletedAt) throw new AppError('Audio is not deleted', 409, 'RESTORE_CONFLICT');
  const cutoff = new Date(current.getTime() - RETENTION_MS);
  if (new Date(audio.deletedAt) <= cutoff) throw new AppError('Audio restore retention has expired', 409, 'RESTORE_RETENTION_EXPIRED');
  const chapter = await repositories.chapter.findById(audio.chapterId, {includeDeleted: true});
  const story = chapter && await repositories.story.findById(chapter.storyId, {includeDeleted: true});
  if (!chapter || !story || chapter.deletedAt || story.deletedAt
    || !sameId(audio.chapterId, chapter.id) || !sameId(audio.storyId, story.id)
    || !sameId(chapter.storyId, story.id) || !sameId(audio.creatorId, story.creatorId)) {
    throw new AppError('Audio ownership chain is invalid', 409, 'RESTORE_CONFLICT');
  }
  try { assertStorageKey(audio.storageKey, {allowedPrefixes: [`audio/${audio.id}/`]}); }
  catch { throw new AppError('Audio media data is invalid', 409, 'MEDIA_INTEGRITY_ERROR'); }
  try { await storageProvider.headObject({key: audio.storageKey}); }
  catch (error) {
    if (error instanceof StorageError) {
      const status = error.code === 'OBJECT_NOT_FOUND' ? 409 : 503;
      const message = error.code === 'OBJECT_NOT_FOUND' ? 'Audio media object is missing' : 'Media storage is unavailable';
      throw new AppError(message, status, error.code);
    }
    throw new AppError('Media storage is unavailable', 503, 'STORAGE_UNAVAILABLE');
  }
  const restored = await repositories.audio.restoreWithinRetention(id, cutoff);
  if (!restored) throw new AppError('Audio restore retention has expired', 409, 'RESTORE_RETENTION_EXPIRED');
  return restored;
}
async function submit(id, user) { const audio = await getContentRepositories().audio.findById(id); assertOwner(audio, user); if (audio.processingStatus !== 'READY') throw new AppError('Audio is not ready for moderation', 422, 'MEDIA_NOT_READY'); return getContentRepositories().audio.submitForModeration(id); }
async function moderate(id, status, user) { if (user.role !== ROLES.ADMIN) throw new AppError('Admin permission is required', 403, 'FORBIDDEN'); if (!['APPROVED', 'REJECTED', 'REVISION_REQUIRED'].includes(status)) throw new AppError('Invalid audio moderation status', 422, 'INVALID_AUDIO_MODERATION_STATUS'); const audio = await getContentRepositories().audio.findById(id); if (!audio) throw new AppError('Audio not found', 404, 'NOT_FOUND'); if (status === 'APPROVED' && audio.processingStatus !== 'READY') throw new AppError('Audio is not ready for approval', 422, 'MEDIA_NOT_READY'); return getContentRepositories().audio.reviewModeration(id, status); }
async function setPrimaryAudio(chapterId, audioId, actor) { const repos = getContentRepositories(); const chapter = await repos.chapter.findById(chapterId); const story = chapter && await repos.story.findById(chapter.storyId); const audio = await repos.audio.findById(audioId); if (!chapter || !story || !audio || !sameId(audio.chapterId, chapter.id)) throw new AppError('Audio not found', 404, 'NOT_FOUND'); if (actor.role !== ROLES.ADMIN && !sameId(story.creatorId, actor.id)) throw new AppError('You do not own this chapter', 403, 'FORBIDDEN'); if (audio.status !== 'APPROVED' || audio.processingStatus !== 'READY') throw new AppError('Audio is not ready for primary playback', 422, 'VALIDATION_ERROR'); const previous = repos.audio.findPrimaryByChapter ? await repos.audio.findPrimaryByChapter(chapter.id) : null; await repos.audio.unsetPrimaryForChapter(chapter.id); try { return await repos.audio.setPrimary(audio.id); } catch (error) { if (previous) { try { await repos.audio.setPrimary(previous.id); } catch {} } throw error; } }
module.exports = {create, list, listPublic, getDefaultPlayback, update, remove, restore, submit, moderate, setPrimaryAudio, RETENTION_MS, deletedAudioDto};
