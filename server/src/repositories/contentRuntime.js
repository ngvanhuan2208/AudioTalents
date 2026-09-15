const {GenreMongoRepository} = require('./mongo/GenreMongoRepository');
const {TagMongoRepository} = require('./mongo/TagMongoRepository');
const {TaxonomyProposalMongoRepository} = require('./mongo/TaxonomyProposalMongoRepository');
const {StoryMongoRepository} = require('./mongo/StoryMongoRepository');
const {ChapterMongoRepository} = require('./mongo/ChapterMongoRepository');
const {AudioMongoRepository} = require('./mongo/AudioMongoRepository');
const {InMemoryRepository} = require('./InMemoryRepository');

function productionContentRepositories() {
  return {genre: new GenreMongoRepository(), tag: new TagMongoRepository(), proposal: new TaxonomyProposalMongoRepository(), story: new StoryMongoRepository(), chapter: new ChapterMongoRepository(), audio: new AudioMongoRepository(), runtime: 'MONGO'};
}

// Explicit unit-test adapter only. Production never selects this adapter.
function createInMemoryContentRepositories({genreRepository, storyRepository, chapterRepository, audioRepository, tagRepository = new InMemoryRepository(), proposalRepository = new InMemoryRepository()}) {
  const update = (repository, id, changes) => repository.update(id, changes);
  const runtimeChapter = item => item && item.status === 'PUBLISHED' ? {...item, status: 'APPROVED'} : item;
  return {
    runtime: 'INMEMORY_TEST',
    tag: {
      async findById(id) { return tagRepository.findById(id); }, async findByNormalizedName(name) { return tagRepository.findOne(item => item.normalizedName === String(name).trim().replace(/\s+/g, ' ').toLowerCase()); }, async listActive() { return tagRepository.findMany(item => item.isActive !== false); }, async listAll() { return tagRepository.findMany(); }, async createTag(input) { if (tagRepository.findOne(item => item.normalizedName === input.normalizedName)) { const error = new Error('Tag exists'); error.code = 'TAG_EXISTS'; throw error; } return tagRepository.create(input); }, async updateTag(id, input) { return update(tagRepository, id, input); }, async setActive(id, active) { return update(tagRepository, id, {isActive: Boolean(active)}); },
    },
    proposal: {
      async findById(id) { return proposalRepository.findById(id); }, async list(filter = {}) { return proposalRepository.findMany(item => Object.entries(filter).every(([key, value]) => item[key] === value)); }, async createProposal(input) { return proposalRepository.create(input); }, async review(id, snapshot, changes) { const row = proposalRepository.findById(id); if (!row || !Object.entries(snapshot).every(([key, value]) => row[key] === value)) return null; return update(proposalRepository, id, changes); },
    },
    genre: {
      async findById(id) { return genreRepository.findById(id); }, async findBySlug(slug) { return genreRepository.findBySlug(slug); },
      async listActive() { return genreRepository.findMany(item => item.isActive !== false); }, async listAll() { return genreRepository.findMany(); },
      async createGenre(input) { return genreRepository.create(input); }, async updateGenre(id, input) { return update(genreRepository, id, input); }, async setActive(id, isActive) { return update(genreRepository, id, {isActive}); },
    },
    story: {
      async findById(id, {includeDeleted = false} = {}) { const item = storyRepository.findById(id); return item && (includeDeleted || !item.deletedAt) ? item : null; },
      async findBySlug(slug, {includeDeleted = false} = {}) { const item = storyRepository.findBySlug(slug); return item && (includeDeleted || !item.deletedAt) ? item : null; },
      async findByCreator(id) { return storyRepository.findByCreator(id).filter(item => !item.deletedAt); },
      async findByReviewStatus(status) { return storyRepository.findMany(item => item.reviewStatus === status && !item.deletedAt); },
      async findPublicBySlug(slug) { const item = storyRepository.findBySlug(slug); return item && item.reviewStatus === 'APPROVED' && item.visibility === 'PUBLIC' && !item.deletedAt ? item : null; },
      async listPublic() { return {items: storyRepository.findMany(item => item.reviewStatus === 'APPROVED' && item.visibility === 'PUBLIC' && !item.deletedAt), pagination: null}; },
      async searchPublic(search, {page = 1, limit = 10, genreId} = {}) { const keyword = String(search).toLowerCase(); const items = storyRepository.findMany(item => item.reviewStatus === 'APPROVED' && item.visibility === 'PUBLIC' && !item.deletedAt && (!keyword || item.title.toLowerCase().includes(keyword) || item.description.toLowerCase().includes(keyword)) && (!genreId || (item.genreIds || item.genres || []).includes(genreId))); return {items, pagination: {page, limit, total: items.length}}; },
      async createStory(input) { return storyRepository.create(input); }, async updateEditable(id, input) { return update(storyRepository, id, input); },
      async submitForModeration(id) { return update(storyRepository, id, {reviewStatus: 'PENDING_REVIEW', visibility: 'PRIVATE'}); },
      async reviewModeration(id, input) { return update(storyRepository, id, input); }, async softDelete(id, deletedBy) { return update(storyRepository, id, {deletedAt: new Date().toISOString(), deletedBy}); }, async restore(id) { return update(storyRepository, id, {deletedAt: null, deletedBy: null}); },
      async incrementChapterCount(id, n = 1) { const item = storyRepository.findById(id); return update(storyRepository, id, {chapterCount: (item.chapterCount || 0) + n}); },
    },
    chapter: {
      async findById(id, {includeDeleted = false} = {}) { const item = chapterRepository.findById(id); return item && (includeDeleted || !item.deletedAt) ? runtimeChapter(item) : null; },
      async findByStory(id) { return chapterRepository.findByStory(id).filter(item => !item.deletedAt).map(runtimeChapter); }, async findByStoryAndNumber(id, n) { return runtimeChapter(chapterRepository.findByStoryAndNumber(id, n)); },
      async findByModerationStatus(status) { return chapterRepository.findMany(item => item.status === status && !item.deletedAt); },
      async findPublicByStory(id) { return chapterRepository.findByStory(id).filter(item => item.status === 'APPROVED' || item.status === 'PUBLISHED').filter(item => !item.deletedAt).map(runtimeChapter); },
      async createChapter(input) { return chapterRepository.create(input); }, async updateEditable(id, input) { return update(chapterRepository, id, input); },
      async submitForModeration(id) { return update(chapterRepository, id, {status: 'PENDING_REVIEW'}); }, async reviewModeration(id, input) { return update(chapterRepository, id, input); }, async softDelete(id, deletedBy) { return update(chapterRepository, id, {deletedAt: new Date().toISOString(), deletedBy}); }, async restore(id) { return update(chapterRepository, id, {deletedAt: null, deletedBy: null}); },
    },
    audio: {
      async findById(id, {includeDeleted = false} = {}) { const item = audioRepository.findById(id); return item && (includeDeleted || !item.deletedAt) ? item : null; }, async findByChapter(id) { return audioRepository.findByChapter(id).filter(item => !item.deletedAt).sort((a, b) => (a.partNumber ?? Number.MAX_SAFE_INTEGER) - (b.partNumber ?? Number.MAX_SAFE_INTEGER)); }, async findDeletedByChapter(id) { return audioRepository.findByChapter(id).filter(item => Boolean(item.deletedAt)).sort((a, b) => (a.partNumber ?? Number.MAX_SAFE_INTEGER) - (b.partNumber ?? Number.MAX_SAFE_INTEGER)); }, async findMaxPartNumberByChapter(id) { return audioRepository.findMaxPartNumberByChapter(id); }, async findByModerationStatus(status) { return audioRepository.findMany(item => item.status === status && !item.deletedAt); },
      async findByStorageKey(key, {includeDeleted = true} = {}) { return audioRepository.findMany(item => item.storageKey === key && (includeDeleted || !item.deletedAt)); },
      async findPublicVoicesForChapter(id) { return audioRepository.findByChapter(id).filter(item => item.status === 'APPROVED' && !item.deletedAt).sort((a, b) => (a.partNumber ?? Number.MAX_SAFE_INTEGER) - (b.partNumber ?? Number.MAX_SAFE_INTEGER)); }, async findDefaultPlaybackForChapter(id) { return audioRepository.findByChapter(id).find(item => item.status === 'APPROVED' && item.isPrimary && !item.deletedAt) || null; }, async findPrimaryByChapter(id) { return audioRepository.findByChapter(id).find(item => item.isPrimary && !item.deletedAt) || null; },
      async createAudio(input) { return audioRepository.createAudio(input); }, async updateMetadata(id, input) { return update(audioRepository, id, input); }, async submitForModeration(id) { return update(audioRepository, id, {status: 'PENDING_REVIEW'}); }, async reviewModeration(id, status) { return update(audioRepository, id, {status}); },
      async softDelete(id, deletedBy) { return update(audioRepository, id, {deletedAt: new Date().toISOString(), deletedBy}); }, async restoreWithinRetention(id, cutoff) { const item = audioRepository.findById(id); if (!item || !item.deletedAt || new Date(item.deletedAt) <= new Date(cutoff)) return null; if (Number.isInteger(item.partNumber) && audioRepository.findByChapter(item.chapterId).some(candidate => candidate.id !== item.id && !candidate.deletedAt && candidate.partNumber === item.partNumber)) { const error = new Error('Audio part number already exists'); error.code = 'AUDIO_PART_CONFLICT'; throw error; } return update(audioRepository, id, {deletedAt: null, deletedBy: null, isPrimary: false}); }, async unsetPrimaryForChapter(id) { for (const item of audioRepository.findByChapter(id)) if (item.isPrimary) update(audioRepository, item.id, {isPrimary: false}); }, async setPrimary(id) { return update(audioRepository, id, {isPrimary: true}); },
    },
  };
}

let activeRepositories = productionContentRepositories();
function getContentRepositories() { return activeRepositories; }
function configureContentRepositoriesForTests(repositories) { if (!repositories?.genre || !repositories?.story || !repositories?.chapter || !repositories?.audio) throw new Error('All Content repositories are required'); activeRepositories = repositories; }
function resetContentRepositoriesToProduction() { activeRepositories = productionContentRepositories(); }
module.exports = {productionContentRepositories, createInMemoryContentRepositories, getContentRepositories, configureContentRepositoriesForTests, resetContentRepositoriesToProduction};
