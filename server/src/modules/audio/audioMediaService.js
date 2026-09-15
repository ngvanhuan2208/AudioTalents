const crypto = require('node:crypto');
const {AppError} = require('../../utils/AppError');
const {ROLES} = require('../../constants/roles');
const {getContentRepositories} = require('../../repositories/contentRuntime');
const {getStorageProvider} = require('../../media/storage');
const {DefaultMediaInspector, MediaInspectionError} = require('../../media/inspection');
const {UploadGrantService, UploadGrantError} = require('../../media/upload');
const {PlaybackGrantService, PlaybackGrantError} = require('../../media/playback');
const {getIdentityRepositories} = require('../../repositories/identityRuntime');
const {StorageError} = require('../../media/storage');
const {getMediaPolicy, SUPPORTED_CONTENT_TYPES} = require('../../media/mediaPolicy');
const {assertStorageKey} = require('../../media/storage/storageKey');

const UPLOADABLE_STATUSES = new Set(['DRAFT', 'REJECTED', 'REVISION_REQUIRED']);
const EXPECTED_PROCESSING = new Set(['PENDING', 'READY']);
const PLAYBACK_TTL_SEC = 15 * 60;
const sameId = (a, b) => String(a) === String(b);
const playbackPath = id => `/api/audio/${id}/playback`;

function mapFoundationError(error) {
  if (error instanceof AppError) throw error;
  if (error instanceof UploadGrantError) throw new AppError(error.message, error.code === 'UPLOAD_EXPIRED' ? 401 : 422, error.code);
  if (error instanceof MediaInspectionError) throw new AppError(error.message, 422, error.code);
  if (error instanceof StorageError) {
    const status = error.code === 'OBJECT_NOT_FOUND' ? 404 : error.code === 'STORAGE_UNAVAILABLE' || error.code === 'STORAGE_CONFIGURATION_ERROR' ? 503 : 422;
    throw new AppError(error.message, status, error.code);
  }
  throw new AppError('Media operation failed', 500, 'INTERNAL_SERVER_ERROR');
}

function playbackNotFound() {
  return new AppError('Audio not found', 404, 'AUDIO_NOT_FOUND');
}

function mapPlaybackStorageError(error) {
  if (error instanceof AppError) throw error;
  // Signing failures must not disclose a bucket, endpoint, object key, or
  // provider-specific error. This is deliberately distinct from upload errors.
  throw new AppError('Media storage is unavailable', 503, 'STORAGE_UNAVAILABLE');
}

class AudioMediaService {
  constructor({repositories, storageProvider, inspector, grantService, playbackGrantService, identityRepositories, policy, nonce = crypto.randomUUID} = {}) {
    this.repositories = repositories;
    this.storageProvider = storageProvider;
    this.inspector = inspector;
    this.grantService = grantService;
    this.playbackGrantService = playbackGrantService;
    this.identityRepositories = identityRepositories;
    this.policy = policy;
    this.nonce = nonce;
  }

  #deps() {
    return {
      repositories: this.repositories || getContentRepositories(),
      storage: this.storageProvider || getStorageProvider(),
      inspector: this.inspector || new DefaultMediaInspector(),
      grants: this.grantService || new UploadGrantService(),
      policy: this.policy || getMediaPolicy(),
    };
  }

  #playbackDeps() {
    return {
      repositories: this.repositories || getContentRepositories(),
      storage: this.storageProvider || getStorageProvider(),
    };
  }

  #playbackGrants() { return this.playbackGrantService || new PlaybackGrantService(); }

  async #authorizedAudio(audioId, user, repositories) {
    const audio = await repositories.audio.findById(audioId);
    if (!audio) throw new AppError('Audio not found', 404, 'AUDIO_NOT_FOUND');
    const chapter = await repositories.chapter.findById(audio.chapterId);
    const story = chapter && await repositories.story.findById(chapter.storyId);
    if (!chapter || !story || !sameId(audio.storyId, story.id) || !sameId(audio.chapterId, chapter.id) || !sameId(audio.creatorId, story.creatorId)) {
      throw new AppError('Audio ownership chain is invalid', 409, 'UPLOAD_CONFLICT');
    }
    if (user.role !== ROLES.ADMIN) {
      if (user.authorStatus !== 'APPROVED') throw new AppError('Approved author permission is required', 403, 'AUTHOR_NOT_APPROVED');
      if (!sameId(story.creatorId, user.id) || !sameId(audio.creatorId, user.id)) throw new AppError('You do not own this audio', 403, 'AUDIO_NOT_OWNED');
    }
    return {audio, chapter, story};
  }

  #assertUploadable(audio) {
    if (!UPLOADABLE_STATUSES.has(audio.status) || !EXPECTED_PROCESSING.has(audio.processingStatus)) {
      throw new AppError('Audio is not in an uploadable state', 409, 'UPLOAD_CONFLICT');
    }
  }

  async #playbackChain(audioId, repositories) {
    const audio = await repositories.audio.findById(audioId);
    if (!audio) throw playbackNotFound();
    const chapter = await repositories.chapter.findById(audio.chapterId);
    const story = chapter && await repositories.story.findById(chapter.storyId);
    // Default repository reads exclude soft-deleted records. Validate every
    // relation here: a child record can never authorize itself by claiming IDs.
    if (!chapter || !story
      || !sameId(audio.chapterId, chapter.id)
      || !sameId(audio.storyId, story.id)
      || !sameId(chapter.storyId, story.id)
      || !sameId(audio.creatorId, story.creatorId)
      || !sameId(chapter.creatorId, story.creatorId)) {
      throw playbackNotFound();
    }
    return {audio, chapter, story};
  }

  #isPublicPlayback({audio, chapter, story}) {
    return story.reviewStatus === 'APPROVED'
      && story.visibility === 'PUBLIC'
      && chapter.status === 'APPROVED'
      && audio.status === 'APPROVED'
      && audio.processingStatus === 'READY';
  }

  #canPreview(user, {audio, story}) {
    if (!user) return false;
    if (user.role === ROLES.ADMIN) return true;
    return user.role === ROLES.USER
      && user.authorStatus === 'APPROVED'
      && sameId(user.id, story.creatorId)
      && sameId(user.id, audio.creatorId);
  }

  async issuePlaybackCapability(audioId, user) {
    try {
      const {repositories} = this.#playbackDeps();
      const chain = await this.#playbackChain(audioId, repositories);
      if (!this.#canPreview(user, chain)) throw playbackNotFound();
      if (chain.audio.processingStatus !== 'READY') throw new AppError('Audio is not ready for playback', 422, 'MEDIA_NOT_READY');
      const grant = this.#playbackGrants().issue({audioId: chain.audio.id, actorId: user.id});
      return {playbackUrl: `${playbackPath(chain.audio.id)}?capability=${encodeURIComponent(grant.token)}`, expiresAt: grant.expiresAt};
    } catch (error) { mapPlaybackStorageError(error); }
  }

  async #redeemPlaybackCapability(audioId, token, chain) {
    let claims;
    try { claims = this.#playbackGrants().verify(token); }
    catch (error) {
      if (error instanceof PlaybackGrantError) throw new AppError(error.message, 401, error.code);
      throw error;
    }
    if (!sameId(claims.audioId, audioId)) throw new AppError('Playback capability is invalid', 401, 'INVALID_PLAYBACK_TOKEN');
    const identity = this.identityRepositories || getIdentityRepositories();
    const actor = await identity.user.findById(claims.actorId);
    if (!actor || actor.accountStatus !== 'ACTIVE' || !this.#canPreview(actor, chain)) throw playbackNotFound();
    return actor;
  }

  #assertPlaybackStorageKey(storageKey, audioId) {
    try {
      assertStorageKey(storageKey, {allowedPrefixes: [`audio/${audioId}/`]});
    } catch {
      throw new AppError('Audio media data is invalid', 409, 'MEDIA_INTEGRITY_ERROR');
    }
  }

  #hints(input, policy) {
    const contentTypeHint = input?.contentType;
    const contentLength = input?.contentLength;
    if (!SUPPORTED_CONTENT_TYPES.has(contentTypeHint)) throw new AppError('Unsupported media content type', 422, 'UNSUPPORTED_MEDIA');
    if (!Number.isSafeInteger(contentLength) || contentLength <= 0) throw new AppError('contentLength must be a positive safe integer', 422, 'OBJECT_VALIDATION_FAILED');
    const maxBytes = Math.min(policy.maxBytes, policy.creatorMaxBytes ?? policy.maxBytes);
    if (contentLength > maxBytes) throw new AppError('Media exceeds upload size limit', 422, 'MEDIA_TOO_LARGE');
    if (typeof input.filename !== 'undefined' && (typeof input.filename !== 'string' || input.filename.length > 255)) throw new AppError('Invalid filename', 422, 'OBJECT_VALIDATION_FAILED');
    return {contentTypeHint, maxBytes};
  }

  async authorizeUpload(audioId, input, user) {
    try {
      const {repositories, storage, grants, policy} = this.#deps();
      const {audio} = await this.#authorizedAudio(audioId, user, repositories);
      this.#assertUploadable(audio);
      const {contentTypeHint, maxBytes} = this.#hints(input, policy);
      const nonce = this.nonce();
      const pendingKey = `uploads/pending/${audio.id}/${nonce}`;
      const finalKey = `audio/${audio.id}/${nonce}`;
      const snapshot = {audioId: audio.id, actorId: user.id, pendingKey, finalKey, expectedStorageKey: audio.storageKey ?? null, expectedProcessingStatus: audio.processingStatus, expectedUpdatedAt: new Date(audio.updatedAt).toISOString(), contentTypeHint, maxBytes};
      const [directUpload, grant] = await Promise.all([
        storage.createDirectUpload({key: pendingKey, contentTypeHint, expiresInSec: policy.uploadTtlSec}),
        Promise.resolve(grants.issue(snapshot)),
      ]);
      return {uploadUrl: directUpload.url, method: directUpload.method, headers: directUpload.headers, expiresAt: directUpload.expiresAt, uploadToken: grant.token};
    } catch (error) { mapFoundationError(error); }
  }

  async confirmUpload(audioId, {uploadToken}, user) {
    try {
      const {repositories, storage, inspector, grants, policy} = this.#deps();
      if (typeof uploadToken !== 'string' || !uploadToken) throw new AppError('uploadToken is required', 422, 'INVALID_UPLOAD_TOKEN');
      const token = grants.verify(uploadToken);
      if (!sameId(token.audioId, audioId) || !sameId(token.actorId, user.id)) throw new AppError('Upload token is invalid', 422, 'INVALID_UPLOAD_TOKEN');
      const {audio} = await this.#authorizedAudio(audioId, user, repositories);
      if (audio.processingStatus === 'READY' && audio.storageKey === token.finalKey) return audio;
      this.#assertUploadable(audio);
      if (audio.storageKey !== token.expectedStorageKey || audio.processingStatus !== token.expectedProcessingStatus || new Date(audio.updatedAt).toISOString() !== token.expectedUpdatedAt) {
        throw new AppError('Upload grant has been superseded', 409, 'UPLOAD_SUPERSEDED');
      }
      const head = await storage.headObject({key: token.pendingKey});
      if (!head.etag || typeof head.etag !== 'string') throw new AppError('Storage object identity is required', 422, 'OBJECT_VALIDATION_FAILED');
      if (!Number.isSafeInteger(head.size) || head.size <= 0) throw new AppError('Storage object is invalid', 422, 'OBJECT_VALIDATION_FAILED');
      if (head.size > token.maxBytes || head.size > policy.hardMaxBytes) throw new AppError('Media exceeds upload size limit', 422, 'MEDIA_TOO_LARGE');
      const read = await storage.openReadStream({key: token.pendingKey, ifMatch: head.etag});
      const inspection = await inspector.inspectAudio({stream: read.stream, size: head.size});
      const maxDurationSec = Math.min(policy.maxDurationSec, policy.creatorMaxDurationSec ?? policy.maxDurationSec);
      if (inspection.durationSec > maxDurationSec) throw new AppError('Media duration exceeds upload limit', 422, 'MEDIA_TOO_LONG');
      await storage.copyObject({sourceKey: token.pendingKey, destinationKey: token.finalKey, contentType: inspection.detectedMimeType, sourceETag: head.etag});
      const committed = await repositories.audio.commitMediaUpload(audio.id, {
        expectedStorageKey: token.expectedStorageKey, expectedProcessingStatus: token.expectedProcessingStatus,
        expectedUpdatedAt: token.expectedUpdatedAt, allowedStatuses: [...UPLOADABLE_STATUSES],
      }, {
        storageKey: token.finalKey, audioUrl: playbackPath(audio.id), fileSize: head.size,
        mimeType: inspection.detectedMimeType, durationSec: inspection.durationSec, bitrate: inspection.bitrate,
        processingStatus: 'READY',
      });
      if (committed) return committed;
      const current = await repositories.audio.findById(audio.id);
      if (current?.processingStatus === 'READY' && current.storageKey === token.finalKey) return current;
      if (!current) throw new AppError('Audio not found', 404, 'AUDIO_NOT_FOUND');
      throw new AppError('Upload grant has been superseded', 409, 'UPLOAD_SUPERSEDED');
    } catch (error) { mapFoundationError(error); }
  }

  async authorizePlayback(audioId, user, {playbackCapability} = {}) {
    try {
      const {repositories, storage} = this.#playbackDeps();
      const chain = await this.#playbackChain(audioId, repositories);
      const isPublic = this.#isPublicPlayback(chain);
      const capabilityUser = playbackCapability ? await this.#redeemPlaybackCapability(audioId, playbackCapability, chain) : null;
      const canPreview = this.#canPreview(user, chain) || Boolean(capabilityUser);

      // Private/unlisted and unapproved media is concealed unless the current
      // caller has canonical creator or administrator preview capability.
      if (!isPublic && !canPreview) throw playbackNotFound();
      if (chain.audio.processingStatus !== 'READY') {
        throw new AppError('Audio is not ready for playback', 422, 'MEDIA_NOT_READY');
      }

      this.#assertPlaybackStorageKey(chain.audio.storageKey, chain.audio.id);
      const signed = await storage.createReadUrl({key: chain.audio.storageKey, expiresInSec: PLAYBACK_TTL_SEC});
      if (!signed || typeof signed.url !== 'string' || !signed.url) {
        throw new AppError('Media storage is unavailable', 503, 'STORAGE_UNAVAILABLE');
      }
      return signed;
    } catch (error) {
      mapPlaybackStorageError(error);
    }
  }
}

module.exports = {AudioMediaService, playbackPath, UPLOADABLE_STATUSES, EXPECTED_PROCESSING, PLAYBACK_TTL_SEC};
