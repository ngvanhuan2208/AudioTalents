const test = require('node:test');
const assert = require('node:assert/strict');
const {MediaCleanupService, DAY_MS, RETENTION_MS} = require('../src/media/cleanup/MediaCleanupService');

const NOW = new Date('2026-09-12T00:00:00.000Z');
function fixture({objects, refs = {}, failLookup, failDelete} = {}) {
  const deleted = [];
  const storage = {
    async listObjects({prefix}) { return {objects: objects.filter(item => item.key.startsWith(prefix) && item.lastModified <= new Date(NOW - DAY_MS)), nextCursor: undefined}; },
    async deleteObject({key}) { if (key === failDelete) throw new Error('storage'); deleted.push(key); },
  };
  const audio = {async findByStorageKey(key) { if (key === failLookup) throw new Error('mongo'); return refs[key] || []; }};
  return {deleted, service: new MediaCleanupService({audioRepository: audio, storageProvider: storage, now: () => NOW})};
}

test('D2 deletes expired pending and canonical orphan objects, but keeps active and recent-deleted references', async () => {
  const old = new Date(NOW - DAY_MS);
  const {service, deleted} = fixture({objects: [
    {key: 'uploads/pending/old', lastModified: old}, {key: 'audio/orphan', lastModified: old},
    {key: 'audio/active', lastModified: old}, {key: 'audio/retained', lastModified: old},
  ], refs: {
    'audio/active': [{id: 'a', deletedAt: null}],
    'audio/retained': [{id: 'b', deletedAt: new Date(NOW - 29 * DAY_MS)}],
  }});
  const result = await service.run();
  assert.deepEqual(deleted.sort(), ['audio/orphan', 'uploads/pending/old']);
  assert.equal(result.canonicalOrphan.kept, 2);
});

test('D2 deletes only expired soft-deleted references and fails closed on lookup/delete errors', async () => {
  const old = new Date(NOW - DAY_MS);
  const {service, deleted} = fixture({objects: [
    {key: 'audio/expired', lastModified: old}, {key: 'audio/fail-lookup', lastModified: old}, {key: 'audio/fail-delete', lastModified: old},
  ], refs: {
    'audio/expired': [{id: 'a', deletedAt: new Date(NOW - RETENTION_MS)}],
    'audio/fail-delete': [{id: 'b', deletedAt: new Date(NOW - RETENTION_MS)}],
  }, failLookup: 'audio/fail-lookup', failDelete: 'audio/fail-delete'});
  const result = await service.run();
  assert.deepEqual(deleted, ['audio/expired']);
  assert.equal(result.canonicalOrphan.failed, 1);
  assert.equal(result.softDeletedRetention.failed, 1);
});

test('D2 exhausts cursors, rechecks expired soft-delete references, and can retry a transient delete failure', async () => {
  const old = new Date(NOW - DAY_MS);
  const deleted = [];
  let page = 0;
  let lookupCount = 0;
  let failOnce = true;
  const storage = {
    async listObjects({prefix, cursor}) {
      if (prefix === 'uploads/pending/') return {objects: [], nextCursor: undefined};
      if (!cursor) return {objects: [{key: 'audio/rechecked', lastModified: old}], nextCursor: 'page-2'};
      return {objects: [{key: 'audio/retry', lastModified: old}], nextCursor: undefined};
    },
    async deleteObject({key}) {
      page += 1;
      if (key === 'audio/retry' && failOnce) { failOnce = false; throw new Error('temporary storage failure'); }
      deleted.push(key);
    },
  };
  const audio = {
    async findByStorageKey(key) {
      if (key === 'audio/rechecked') {
        lookupCount += 1;
        return lookupCount === 1 ? [{id: 'rechecked', deletedAt: new Date(NOW - RETENTION_MS)}] : [{id: 'rechecked', deletedAt: null}];
      }
      return [];
    },
  };
  const service = new MediaCleanupService({audioRepository: audio, storageProvider: storage, now: () => NOW, pageLimit: 1});
  const first = await service.run();
  assert.equal(first.canonicalOrphan.scanned, 2);
  assert.equal(first.softDeletedRetention.kept, 1, 'final recheck must keep a restored reference');
  assert.equal(first.canonicalOrphan.failed, 1, 'the failed orphan delete is recorded');
  assert.deepEqual(deleted, []);
  const second = await service.run();
  assert.equal(second.canonicalOrphan.deleted, 1);
  assert.deepEqual(deleted, ['audio/retry']);
  assert.equal(page, 2);
});
