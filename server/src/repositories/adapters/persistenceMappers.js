const mongoose = require('mongoose');
const {RepositoryError} = require('../errors/mongoErrorMapper');
const {toRuntimeId} = require('./objectId');
const {serializeTranscript} = require('./transcript');

const STORY_PROGRESS = new Set(['ONGOING', 'COMPLETED', 'PAUSED']);
const MODERATION_STATUS = new Set(['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED']);
const CHAPTER_STATUS = new Set(['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED']);
const AUDIO_PROCESSING_STATUS = new Set(['PENDING', 'PROCESSING', 'READY', 'FAILED']);

function pickDefined(source, fields) {
  const result = {};
  for (const field of fields) if (source?.[field] !== undefined) result[field] = source[field];
  return result;
}

function normalizePlainValue(value) {
  if (value == null || value instanceof Date) return value;
  if (value instanceof mongoose.Types.ObjectId || mongoose.isObjectIdOrHexString(value)) return toRuntimeId(value);
  if (Array.isArray(value)) return value.map(normalizePlainValue);
  if (typeof value === 'object') {
    const result = {};
    for (const [key, nestedValue] of Object.entries(value)) result[key] = normalizePlainValue(nestedValue);
    return result;
  }
  return value;
}

function toRuntimeObject(value) {
  if (value == null) return value;
  const source = typeof value.toObject === 'function' ? value.toObject() : value;
  const plain = normalizePlainValue(source);
  if (plain._id !== undefined) {
    plain.id = toRuntimeId(plain._id);
    delete plain._id;
  }
  delete plain.__v;
  return plain;
}

function buildEqualityFilter(input, allowedFields) {
  const filter = {};
  for (const field of allowedFields) {
    if (input?.[field] === undefined) continue;
    const value = input[field];
    if (value !== null && typeof value === 'object' && !(value instanceof Date) && !mongoose.isObjectIdOrHexString(value)) {
      throw new RepositoryError(`Invalid filter value for ${field}`, {code: 'INVALID_FILTER', status: 422});
    }
    filter[field] = value;
  }
  return filter;
}

function buildSetUpdate(input, allowedFields) {
  const update = pickDefined(input, allowedFields);
  if (Object.keys(update).length === 0) {
    throw new RepositoryError('No allowed fields supplied for update', {code: 'EMPTY_UPDATE', status: 422});
  }
  return {$set: update};
}

function mapUserRuntimeToPersistence(input, {allowProtected = false} = {}) {
  const result = pickDefined(input, ['email', 'passwordHash']);
  const username = input?.username ?? input?.displayName;
  if (username !== undefined) result.username = username;
  const profile = pickDefined(input?.profile || {}, ['bio', 'avatar']);
  if (input?.bio !== undefined) profile.bio = input.bio;
  if (input?.avatarUrl !== undefined) profile.avatar = input.avatarUrl;
  if (Object.keys(profile).length) result.profile = profile;
  if (allowProtected) {
    Object.assign(result, pickDefined(input, ['role', 'authorStatus', 'accountStatus', 'emailVerified', 'tokenVersion']));
    if (result.accountStatus === undefined && input?.status !== undefined) result.accountStatus = input.status;
  }
  return result;
}

function mapAuthorApplicationRuntimeToPersistence(input) {
  const result = pickDefined(input, ['contentTypes', 'experience', 'status', 'submittedAt', 'reviewedAt', 'reviewedBy']);
  result.displayName = input?.displayName ?? input?.penName;
  result.bio = input?.bio ?? input?.introduction;
  result.reviewNote = input?.reviewNote ?? input?.adminNote ?? '';
  return pickDefined(result, ['displayName', 'bio', 'contentTypes', 'experience', 'status', 'submittedAt', 'reviewedAt', 'reviewedBy', 'reviewNote']);
}

function mapStoryRuntimeToPersistence(input) {
  const result = pickDefined(input, ['creatorId', 'title', 'slug', 'description', 'tags', 'visibility', 'submittedAt', 'reviewedBy', 'reviewedAt', 'moderationNote', 'publishedAt', 'deletedAt', 'deletedBy']);
  if (input?.coverUrl !== undefined || input?.cover !== undefined) result.coverUrl = input.coverUrl ?? input.cover;
  if (input?.genreIds !== undefined || input?.genres !== undefined) result.genreIds = input.genreIds ?? input.genres;
  if (STORY_PROGRESS.has(input?.status)) result.status = input.status;
  else result.status = 'ONGOING';
  if (input?.status === 'DRAFT') result.reviewStatus = 'DRAFT';
  else if (MODERATION_STATUS.has(input?.reviewStatus)) result.reviewStatus = input.reviewStatus;
  else result.reviewStatus = 'DRAFT';
  return result;
}

function mapChapterRuntimeToPersistence(input) {
  if (input?.status === 'HIDDEN') {
    throw new RepositoryError('Legacy Chapter status HIDDEN requires manual migration handling', {
      code: 'UNMAPPABLE_LEGACY_STATUS', status: 422,
    });
  }
  const result = pickDefined(input, ['storyId', 'creatorId', 'chapterNumber', 'title', 'slug', 'submittedAt', 'reviewedBy', 'reviewedAt', 'moderationNote', 'publishedAt', 'deletedAt', 'deletedBy']);
  if (input?.textContent !== undefined || input?.content !== undefined) result.textContent = input.textContent ?? input.content;
  result.status = input?.status === 'PUBLISHED' ? 'APPROVED' : input?.status;
  if (!CHAPTER_STATUS.has(result.status)) result.status = 'DRAFT';
  return result;
}

function mapAudioRuntimeToPersistence(input) {
  const result = pickDefined(input, ['storyId', 'chapterId', 'creatorId', 'title', 'partNumber', 'audioUrl', 'storageKey', 'durationSec', 'fileSize', 'mimeType', 'bitrate', 'voiceType', 'sourceType', 'isPrimary', 'deletedAt', 'deletedBy']);
  if (result.creatorId === undefined && input?.ownerId !== undefined) result.creatorId = input.ownerId;
  if (input?.transcript !== undefined) result.transcript = serializeTranscript(input.transcript);
  const isLegacyUploading = input?.status === 'UPLOADING';
  if (isLegacyUploading) {
    // Legacy runtime overloaded `status` with a processing signal. It has no
    // moderation meaning, so omit status and let the canonical schema default
    // DRAFT apply while preserving the locked processing compatibility.
    result.processingStatus = 'PENDING';
  } else {
    const processingStatus = mapAudioProcessingStatus(input?.processingStatus);
    if (processingStatus !== undefined) result.processingStatus = processingStatus;
    if (input?.status !== undefined) result.status = mapAudioModerationStatus(input.status);
  }
  return result;
}

function mapAudioModerationStatus(status) {
  if (!MODERATION_STATUS.has(status)) {
    throw new RepositoryError('Invalid audio moderation status', {code: 'INVALID_AUDIO_MODERATION_STATUS', status: 422});
  }
  return status;
}

function mapAudioProcessingStatus(processingStatus) {
  if (processingStatus === undefined) return undefined;
  if (processingStatus === 'UPLOADING') return 'PENDING';
  if (!AUDIO_PROCESSING_STATUS.has(processingStatus)) {
    throw new RepositoryError('Invalid audio processing status', {code: 'INVALID_AUDIO_PROCESSING_STATUS', status: 422});
  }
  return processingStatus;
}

function mapLibraryRuntimeToPersistence(input) {
  const type = input?.type;
  if (!['LIBRARY', 'FAVORITE', 'FOLLOWED'].includes(type)) {
    throw new RepositoryError('Legacy Library record requires separate compatibility handling', {
      code: 'UNMAPPABLE_LEGACY_LIBRARY_RECORD', status: 422,
    });
  }
  return {
    ...pickDefined(input, ['userId', 'storyId', 'addedAt']),
    isFavorite: type === 'FAVORITE',
    followed: type === 'FOLLOWED',
  };
}

function mapReportRuntimeToPersistence(input) {
  const result = pickDefined(input, ['reporterId', 'targetType', 'targetId', 'description', 'status', 'resolutionNote']);
  result.reportType = input?.reportType ?? input?.type;
  result.reviewedBy = input?.reviewedBy ?? input?.handledBy;
  result.reviewedAt = input?.reviewedAt ?? input?.resolvedAt;
  return pickDefined(result, ['reporterId', 'targetType', 'targetId', 'reportType', 'description', 'status', 'reviewedBy', 'reviewedAt', 'resolutionNote']);
}

module.exports = {
  pickDefined,
  toRuntimeObject,
  buildEqualityFilter,
  buildSetUpdate,
  mapUserRuntimeToPersistence,
  mapAuthorApplicationRuntimeToPersistence,
  mapStoryRuntimeToPersistence,
  mapChapterRuntimeToPersistence,
  mapAudioRuntimeToPersistence,
  mapAudioModerationStatus,
  mapAudioProcessingStatus,
  mapLibraryRuntimeToPersistence,
  mapReportRuntimeToPersistence,
};
