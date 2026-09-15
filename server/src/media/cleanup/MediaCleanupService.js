const {getContentRepositories} = require('../../repositories/contentRuntime');
const {getStorageProvider, assertStorageKey} = require('../storage');

const PENDING_PREFIX = 'uploads/pending/';
const CANONICAL_PREFIX = 'audio/';
const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_MS = 30 * DAY_MS;

function blank() { return {scanned: 0, eligible: 0, deleted: 0, kept: 0, failed: 0}; }
function cloneNow(now) {
  const value = now instanceof Date ? new Date(now) : new Date(now || Date.now());
  if (Number.isNaN(value.getTime())) throw new Error('MEDIA_CLEANUP_INVALID_CLOCK');
  return value;
}

class MediaCleanupService {
  constructor({audioRepository, storageProvider, now = () => new Date(), pageLimit = 100} = {}) {
    this.audioRepository = audioRepository;
    this.storageProvider = storageProvider;
    this.now = now;
    this.pageLimit = pageLimit;
  }

  #deps() { return {audio: this.audioRepository || getContentRepositories().audio, storage: this.storageProvider || getStorageProvider()}; }
  #cutoff(now, age) { return new Date(now.getTime() - age); }

  async #pages(storage, prefix, cutoff, visit) {
    let cursor;
    do {
      const page = await storage.listObjects({prefix, olderThan: new Date(cutoff.getTime() + 1), cursor, limit: this.pageLimit});
      for (const object of page.objects) await visit(object);
      cursor = page.nextCursor;
    } while (cursor);
  }

  async run({now} = {}) {
    const current = cloneNow(now === undefined ? this.now() : now);
    const {audio, storage} = this.#deps();
    const result = {now: current.toISOString(), pending: blank(), canonicalOrphan: blank(), softDeletedRetention: blank()};
    const pendingCutoff = this.#cutoff(current, DAY_MS);
    const retentionCutoff = this.#cutoff(current, RETENTION_MS);

    try { await this.#pages(storage, PENDING_PREFIX, pendingCutoff, async object => {
      const bucket = result.pending; bucket.scanned += 1;
      try {
        assertStorageKey(object.key, {allowedPrefixes: [PENDING_PREFIX]});
        bucket.eligible += 1;
        await storage.deleteObject({key: object.key});
        bucket.deleted += 1;
      } catch { bucket.failed += 1; }
    }); } catch { result.pending.failed += 1; }

    try { await this.#pages(storage, CANONICAL_PREFIX, pendingCutoff, async object => {
      result.canonicalOrphan.scanned += 1;
      let references;
      try {
        assertStorageKey(object.key, {allowedPrefixes: [CANONICAL_PREFIX]});
        references = await audio.findByStorageKey(object.key, {includeDeleted: true});
      } catch {
        result.canonicalOrphan.failed += 1;
        return;
      }
      if (references.length === 0) {
        const bucket = result.canonicalOrphan; bucket.eligible += 1;
        try { await storage.deleteObject({key: object.key}); bucket.deleted += 1; } catch { bucket.failed += 1; }
        return;
      }
      const active = references.some(item => !item.deletedAt);
      const retained = references.some(item => item.deletedAt && new Date(item.deletedAt) > retentionCutoff);
      if (active || retained) { result.canonicalOrphan.kept += 1; return; }
      const bucket = result.softDeletedRetention; bucket.scanned += 1;
      try {
        const latest = await audio.findByStorageKey(object.key, {includeDeleted: true});
        const stillEligible = latest.length > 0 && latest.every(item => item.deletedAt && new Date(item.deletedAt) <= retentionCutoff);
        if (!stillEligible) { bucket.kept += 1; return; }
        bucket.eligible += 1;
        await storage.deleteObject({key: object.key});
        bucket.deleted += 1;
      } catch { bucket.failed += 1; }
    }); } catch { result.canonicalOrphan.failed += 1; }
    return result;
  }
}

module.exports = {MediaCleanupService, PENDING_PREFIX, CANONICAL_PREFIX, DAY_MS, RETENTION_MS};
