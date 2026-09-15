const {Readable} = require('node:stream');
const {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');
const {getSignedUrl} = require('@aws-sdk/s3-request-presigner');
const {StorageProvider} = require('./StorageProvider');
const {assertStorageKey, assertStoragePrefix} = require('./storageKey');
const {storageError, mapStorageError, isMissingObjectError} = require('./storageErrors');

const MAX_PRESIGN_SECONDS = 15 * 60;
const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 1000;

function assertExpiry(expiresInSec) {
  if (!Number.isInteger(expiresInSec) || expiresInSec < 1 || expiresInSec > MAX_PRESIGN_SECONDS) {
    throw storageError('OBJECT_VALIDATION_FAILED', 'presign');
  }
  return expiresInSec;
}

function assertContentType(contentType) {
  if (typeof contentType !== 'string' || !/^[^\s/;]+\/[^\s;]+(?:\s*;[^\r\n]+)?$/.test(contentType)) {
    throw storageError('OBJECT_VALIDATION_FAILED', 'contentType');
  }
  return contentType;
}

function assertETag(etag, operation) {
  if (typeof etag !== 'string' || !etag || etag.trim() !== etag || /[\u0000-\u001F\u007F]/.test(etag)) {
    throw storageError('OBJECT_VALIDATION_FAILED', operation);
  }
  return etag;
}

function normalizeSize(value, operation) {
  if (!Number.isSafeInteger(value) || value < 0) throw storageError('OBJECT_VALIDATION_FAILED', operation);
  return value;
}

function normalizeDate(value, operation) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw storageError('OBJECT_VALIDATION_FAILED', operation);
  return date;
}

function normalizeListLimit(limit = DEFAULT_LIST_LIMIT) {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIST_LIMIT) {
    throw storageError('OBJECT_VALIDATION_FAILED', 'listObjects');
  }
  return limit;
}

function encodeCopySource(bucket, key) {
  return `${encodeURIComponent(bucket)}/${key.split('/').map(segment => encodeURIComponent(segment)).join('/')}`;
}

function isNodeReadable(value) {
  return value instanceof Readable || (value && typeof value.pipe === 'function' && typeof value.on === 'function');
}

class S3CompatibleStorageProvider extends StorageProvider {
  constructor({config, client, presign = getSignedUrl} = {}) {
    super();
    if (!config?.bucket || !config?.endpoint || !config?.region || !config?.credentials?.accessKeyId || !config?.credentials?.secretAccessKey) {
      throw storageError('STORAGE_CONFIGURATION_ERROR', 'createStorageProvider');
    }
    this.config = config;
    this.client = client || new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: config.credentials,
    });
    this.presign = presign;
  }

  async createDirectUpload({key, contentTypeHint, expiresInSec}) {
    assertStorageKey(key);
    const contentType = assertContentType(contentTypeHint);
    const expiresIn = assertExpiry(expiresInSec);
    try {
      const command = new PutObjectCommand({Bucket: this.config.bucket, Key: key, ContentType: contentType, IfNoneMatch: '*'});
      const url = await this.presign(this.client, command, {expiresIn});
      return {url, method: 'PUT', headers: {'Content-Type': contentType, 'If-None-Match': '*'}, expiresAt: new Date(Date.now() + expiresIn * 1000)};
    } catch (error) { throw mapStorageError(error, 'createDirectUpload'); }
  }

  async headObject({key}) {
    assertStorageKey(key);
    try {
      const result = await this.client.send(new HeadObjectCommand({Bucket: this.config.bucket, Key: key}));
      return {size: normalizeSize(result.ContentLength, 'headObject'), contentType: result.ContentType, etag: result.ETag, lastModified: normalizeDate(result.LastModified, 'headObject')};
    } catch (error) { throw mapStorageError(error, 'headObject'); }
  }

  async openReadStream({key, ifMatch}) {
    assertStorageKey(key);
    const condition = ifMatch === undefined ? undefined : assertETag(ifMatch, 'openReadStream');
    try {
      const result = await this.client.send(new GetObjectCommand({Bucket: this.config.bucket, Key: key, ...(condition ? {IfMatch: condition} : {})}));
      if (!isNodeReadable(result.Body)) throw storageError('OBJECT_VALIDATION_FAILED', 'openReadStream');
      return {stream: result.Body, size: normalizeSize(result.ContentLength, 'openReadStream')};
    } catch (error) { throw mapStorageError(error, 'openReadStream'); }
  }

  async copyObject({sourceKey, destinationKey, contentType, sourceETag}) {
    assertStorageKey(sourceKey);
    assertStorageKey(destinationKey);
    const validatedContentType = assertContentType(contentType);
    const condition = sourceETag === undefined ? undefined : assertETag(sourceETag, 'copyObject');
    try {
      await this.client.send(new CopyObjectCommand({
        Bucket: this.config.bucket,
        Key: destinationKey,
        CopySource: encodeCopySource(this.config.bucket, sourceKey),
        MetadataDirective: 'REPLACE',
        ContentType: validatedContentType,
        ...(condition ? {CopySourceIfMatch: condition} : {}),
      }));
    } catch (error) { throw mapStorageError(error, 'copyObject'); }
  }

  async createReadUrl({key, expiresInSec}) {
    assertStorageKey(key);
    const expiresIn = assertExpiry(expiresInSec);
    try {
      const url = await this.presign(this.client, new GetObjectCommand({Bucket: this.config.bucket, Key: key}), {expiresIn});
      return {url, expiresAt: new Date(Date.now() + expiresIn * 1000)};
    } catch (error) { throw mapStorageError(error, 'createReadUrl'); }
  }

  async deleteObject({key}) {
    assertStorageKey(key);
    try {
      await this.client.send(new DeleteObjectCommand({Bucket: this.config.bucket, Key: key}));
    } catch (error) {
      if (!isMissingObjectError(error)) throw mapStorageError(error, 'deleteObject');
    }
  }

  async listObjects({prefix, olderThan, cursor, limit}) {
    assertStoragePrefix(prefix);
    const cutoff = normalizeDate(olderThan, 'listObjects');
    const maxKeys = normalizeListLimit(limit);
    if (cursor !== undefined && (typeof cursor !== 'string' || !cursor)) throw storageError('OBJECT_VALIDATION_FAILED', 'listObjects');
    try {
      const result = await this.client.send(new ListObjectsV2Command({
        Bucket: this.config.bucket, Prefix: prefix, ContinuationToken: cursor, MaxKeys: maxKeys,
      }));
      const objects = (result.Contents || []).flatMap(item => {
        try {
          if (!item?.Key || !item.LastModified || item.LastModified >= cutoff) return [];
          assertStorageKey(item.Key);
          return [{key: item.Key, lastModified: normalizeDate(item.LastModified, 'listObjects'), size: normalizeSize(item.Size, 'listObjects')}];
        } catch { return []; }
      });
      return {objects, nextCursor: result.NextContinuationToken || undefined};
    } catch (error) { throw mapStorageError(error, 'listObjects'); }
  }
}

module.exports = {S3CompatibleStorageProvider, MAX_PRESIGN_SECONDS, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT, normalizeListLimit, encodeCopySource, assertETag};
