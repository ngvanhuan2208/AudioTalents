const test = require('node:test');
const assert = require('node:assert/strict');
const {Readable} = require('node:stream');

const {
  createStorageProvider,
  parseStorageConfig,
  toPublicStorageConfig,
  StorageError,
  assertStorageKey,
  assertMediaStorageKey,
} = require('../src/media/storage');
const {S3CompatibleStorageProvider, encodeCopySource} = require('../src/media/storage/S3CompatibleStorageProvider');

function r2Environment(overrides = {}) {
  return {
    MEDIA_STORAGE_PROVIDER: 'r2',
    MEDIA_STORAGE_ENDPOINT: 'https://account-id.r2.cloudflarestorage.com',
    MEDIA_STORAGE_BUCKET: 'audio-private',
    MEDIA_STORAGE_REGION: 'auto',
    MEDIA_STORAGE_ACCESS_KEY_ID: 'test-access-key',
    MEDIA_STORAGE_SECRET_ACCESS_KEY: 'test-secret-key',
    ...overrides,
  };
}

function minioEnvironment(overrides = {}) {
  return {
    MEDIA_STORAGE_PROVIDER: 'minio',
    MEDIA_STORAGE_ENDPOINT: 'http://127.0.0.1:9000',
    MEDIA_STORAGE_BUCKET: 'audio-private',
    MEDIA_STORAGE_ACCESS_KEY_ID: 'test-access-key',
    MEDIA_STORAGE_SECRET_ACCESS_KEY: 'test-secret-key',
    ...overrides,
  };
}

function fakeClient(respond) {
  const commands = [];
  return {commands, async send(command) { commands.push(command); return respond(command); }};
}

function provider({environment = r2Environment(), respond = async () => ({}), presign} = {}) {
  const client = fakeClient(respond);
  return {
    provider: createStorageProvider({environment, client, presign: presign || (async () => 'https://signed.example.invalid/object')}),
    client,
  };
}

test('storage config supports R2 and MinIO without exposing credentials in public configuration', async () => {
  const r2 = parseStorageConfig(r2Environment());
  assert.equal(r2.mode, 'r2');
  assert.equal(r2.region, 'auto');
  assert.equal(r2.forcePathStyle, false);
  assert.equal(toPublicStorageConfig(r2).credentials, undefined);
  assert.equal(JSON.stringify(toPublicStorageConfig(r2)).includes('test-secret-key'), false);
  const r2Provider = new S3CompatibleStorageProvider({config: r2});
  assert.equal(r2Provider.client.config.forcePathStyle, false);
  assert.equal(await r2Provider.client.config.region(), 'auto');

  const minio = parseStorageConfig(minioEnvironment());
  assert.equal(minio.mode, 'minio');
  assert.equal(minio.region, 'us-east-1');
  assert.equal(minio.forcePathStyle, true);
  const minioProvider = new S3CompatibleStorageProvider({config: minio});
  assert.equal(minioProvider.client.config.forcePathStyle, true);
  assert.equal(await minioProvider.client.config.region(), 'us-east-1');
  assert.throws(() => parseStorageConfig(r2Environment({MEDIA_STORAGE_BUCKET: ''})), error => error.code === 'STORAGE_CONFIGURATION_ERROR');
  assert.throws(() => parseStorageConfig(r2Environment({MEDIA_STORAGE_PROVIDER: 'filesystem'})), error => error.code === 'STORAGE_CONFIGURATION_ERROR');
  assert.throws(() => parseStorageConfig(r2Environment({MEDIA_STORAGE_FORCE_PATH_STYLE: 'sometimes'})), error => error.code === 'STORAGE_CONFIGURATION_ERROR');
});

test('storage modules and provider construction have no S3 operation side effects', () => {
  const client = fakeClient(async () => { throw new Error('must not be called'); });
  const created = createStorageProvider({environment: r2Environment(), client});
  assert.ok(created instanceof S3CompatibleStorageProvider);
  assert.equal(client.commands.length, 0);
  assert.equal(typeof require('../src/media/storage').getStorageProvider, 'function');
});

test('storage keys reject unsafe path and URL forms while accepting locked namespaces', () => {
  for (const value of ['', '../audio', 'audio/../../secret', '/absolute/key', 'C:\\something', 'https://example.com/file', 'audio/has\u0000null']) {
    assert.throws(() => assertStorageKey(value), error => error instanceof StorageError && error.code === 'OBJECT_VALIDATION_FAILED');
  }
  assert.equal(assertMediaStorageKey('uploads/pending/audio-id/nonce'), 'uploads/pending/audio-id/nonce');
  assert.equal(assertMediaStorageKey('audio/audio-id/nonce'), 'audio/audio-id/nonce');
  assert.equal(assertMediaStorageKey('audio/audio-id/nonce.mp3'), 'audio/audio-id/nonce.mp3');
  assert.throws(() => assertMediaStorageKey('other/object.mp3'), error => error.code === 'OBJECT_VALIDATION_FAILED');
});

test('createDirectUpload presigns an exact PUT and returns only temporary authorization', async () => {
  const captures = {};
  const {provider: storage, client} = provider({presign: async (clientArg, command, options) => {
    captures.client = clientArg;
    captures.command = command;
    captures.options = options;
    return 'https://signed.example.invalid/put?signature=redacted';
  }});
  const result = await storage.createDirectUpload({key: 'uploads/pending/audio-id/nonce', contentTypeHint: 'audio/mpeg', expiresInSec: 600});
  assert.equal(captures.client, client);
  assert.equal(captures.command.constructor.name, 'PutObjectCommand');
  assert.deepEqual(captures.command.input, {Bucket: 'audio-private', Key: 'uploads/pending/audio-id/nonce', ContentType: 'audio/mpeg', IfNoneMatch: '*'});
  assert.deepEqual(captures.options, {expiresIn: 600});
  assert.equal(result.method, 'PUT');
  assert.deepEqual(result.headers, {'Content-Type': 'audio/mpeg', 'If-None-Match': '*'});
  assert.equal(result.accessKeyId, undefined);
  assert.equal(result.secretAccessKey, undefined);
  await assert.rejects(() => storage.createDirectUpload({key: 'uploads/pending/audio-id/nonce', contentTypeHint: 'audio/mpeg', expiresInSec: 901}), error => error.code === 'OBJECT_VALIDATION_FAILED');
});

test('headObject normalizes metadata and maps missing or malformed results safely', async () => {
  const lastModified = new Date('2026-09-12T00:00:00.000Z');
  const {provider: storage, client} = provider({respond: async () => ({ContentLength: 12, ContentType: 'not-authoritative', ETag: 'etag', LastModified: lastModified})});
  assert.deepEqual(await storage.headObject({key: 'audio/audio-id/nonce.mp3'}), {size: 12, contentType: 'not-authoritative', etag: 'etag', lastModified});
  assert.equal(client.commands[0].constructor.name, 'HeadObjectCommand');
  const missing = provider({respond: async () => { throw {name: 'NoSuchKey', message: 'sensitive endpoint'}; }}).provider;
  await assert.rejects(() => missing.headObject({key: 'audio/audio-id/missing.mp3'}), error => error.code === 'OBJECT_NOT_FOUND' && !error.message.includes('sensitive'));
  const malformed = provider({respond: async () => ({ContentLength: undefined, LastModified: lastModified})}).provider;
  await assert.rejects(() => malformed.headObject({key: 'audio/audio-id/bad.mp3'}), error => error.code === 'OBJECT_VALIDATION_FAILED');
});

test('openReadStream returns the provider Node stream without buffering the object and pins ETag when requested', async () => {
  const stream = Readable.from(['small streamed chunk']);
  const {provider: storage, client} = provider({respond: async () => ({Body: stream, ContentLength: 987})});
  const result = await storage.openReadStream({key: 'uploads/pending/audio-id/nonce'});
  assert.equal(client.commands[0].constructor.name, 'GetObjectCommand');
  assert.equal(result.stream, stream);
  assert.equal(result.size, 987);
  const conditional = provider({respond: async () => ({Body: Readable.from(['conditional']), ContentLength: 11})});
  await conditional.provider.openReadStream({key: 'uploads/pending/audio-id/nonce', ifMatch: '"source-etag"'});
  assert.deepEqual(conditional.client.commands[0].input, {Bucket: 'audio-private', Key: 'uploads/pending/audio-id/nonce', IfMatch: '"source-etag"'});
  const invalid = provider({respond: async () => ({Body: {}, ContentLength: 1})}).provider;
  await assert.rejects(() => invalid.openReadStream({key: 'audio/audio-id/no-stream.mp3'}), error => error.code === 'OBJECT_VALIDATION_FAILED');
});

test('copyObject encodes safe copy source, replaces metadata, pins source ETag, and never deletes source', async () => {
  const {provider: storage, client} = provider();
  await storage.copyObject({sourceKey: 'uploads/pending/audio-id/safe file', destinationKey: 'audio/audio-id/nonce', contentType: 'audio/mpeg', sourceETag: '"source-etag"'});
  assert.equal(client.commands.length, 1);
  const command = client.commands[0];
  assert.equal(command.constructor.name, 'CopyObjectCommand');
  assert.deepEqual(command.input, {
    Bucket: 'audio-private', Key: 'audio/audio-id/nonce',
    CopySource: 'audio-private/uploads/pending/audio-id/safe%20file',
    MetadataDirective: 'REPLACE', ContentType: 'audio/mpeg', CopySourceIfMatch: '"source-etag"',
  });
  assert.equal(encodeCopySource('bucket', 'audio/id/file name.mp3'), 'bucket/audio/id/file%20name.mp3');
});

test('createReadUrl presigns exact GET without persistence side effects', async () => {
  const captures = {};
  const {provider: storage, client} = provider({presign: async (clientArg, command, options) => {
    captures.client = clientArg; captures.command = command; captures.options = options;
    return 'https://signed.example.invalid/get';
  }});
  const result = await storage.createReadUrl({key: 'audio/audio-id/nonce.mp3', expiresInSec: 900});
  assert.equal(captures.client, client);
  assert.equal(captures.command.constructor.name, 'GetObjectCommand');
  assert.deepEqual(captures.command.input, {Bucket: 'audio-private', Key: 'audio/audio-id/nonce.mp3'});
  assert.deepEqual(captures.options, {expiresIn: 900});
  assert.equal(result.url, 'https://signed.example.invalid/get');
});

test('deleteObject is internal and idempotent for an already missing object', async () => {
  const {provider: storage, client} = provider({respond: async () => { throw {name: 'NoSuchKey'}; }});
  await storage.deleteObject({key: 'audio/audio-id/nonce.mp3'});
  assert.equal(client.commands[0].constructor.name, 'DeleteObjectCommand');
  const unavailable = provider({respond: async () => { throw {name: 'AccessDenied', message: 'key=test-secret-key'}; }}).provider;
  await assert.rejects(() => unavailable.deleteObject({key: 'audio/audio-id/nonce.mp3'}), error => error.code === 'STORAGE_UNAVAILABLE' && !error.message.includes('test-secret-key'));
});

test('listObjects uses bounded pagination and performs documented client-side olderThan filtering', async () => {
  const older = new Date('2026-09-10T00:00:00.000Z');
  const cutoff = new Date('2026-09-11T00:00:00.000Z');
  const newer = new Date('2026-09-12T00:00:00.000Z');
  const {provider: storage, client} = provider({respond: async () => ({
    Contents: [
      {Key: 'audio/old/one.mp3', LastModified: older, Size: 10},
      {Key: 'audio/new/two.mp3', LastModified: newer, Size: 20},
      {Key: '../invalid', LastModified: older, Size: 1},
    ],
    NextContinuationToken: 'next-page',
  })});
  const result = await storage.listObjects({prefix: 'audio/', olderThan: cutoff, cursor: 'cursor-1', limit: 100});
  assert.deepEqual(client.commands[0].input, {Bucket: 'audio-private', Prefix: 'audio/', ContinuationToken: 'cursor-1', MaxKeys: 100});
  assert.deepEqual(result, {objects: [{key: 'audio/old/one.mp3', lastModified: older, size: 10}], nextCursor: 'next-page'});
  await assert.rejects(() => storage.listObjects({prefix: 'audio/', olderThan: cutoff, limit: 1001}), error => error.code === 'OBJECT_VALIDATION_FAILED');
});

test('provider errors are normalized and redact credential-like SDK payloads', async () => {
  const {provider: storage} = provider({respond: async () => { throw {name: 'S3ServiceException', message: 'endpoint=https://secret.example access=test-access-key secret=test-secret-key'}; }});
  await assert.rejects(
    () => storage.headObject({key: 'audio/audio-id/nonce.mp3'}),
    error => error.code === 'STORAGE_UNAVAILABLE' && !error.message.includes('test-access-key') && !error.message.includes('test-secret-key')
  );
});

test('conditional provider failures normalize 412 responses without exposing ETag or provider details', async () => {
  const {provider: storage} = provider({respond: async () => {
    throw {name: 'PreconditionFailed', $metadata: {httpStatusCode: 412}, message: 'etag=secret-etag provider XML'};
  }});
  await assert.rejects(
    () => storage.openReadStream({key: 'uploads/pending/audio-id/nonce', ifMatch: '"secret-etag"'}),
    error => error.code === 'OBJECT_VALIDATION_FAILED' && !error.message.includes('secret-etag') && !error.message.includes('provider XML')
  );
});
