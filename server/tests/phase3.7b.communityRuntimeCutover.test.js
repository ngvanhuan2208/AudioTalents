const test = require('node:test');
const assert = require('node:assert/strict');

const communityService = require('../src/modules/community/communityService');
const notificationService = require('../src/modules/notifications/notificationService');
const {
  getCommunityRepositories, configureCommunityRepositoriesForTests, resetCommunityRepositoriesToProduction,
  getContentRepositories, configureContentRepositoriesForTests, resetContentRepositoriesToProduction,
  getIdentityRepositories, configureIdentityRepositoriesForTests, resetIdentityRepositoriesToProduction,
  NotificationMongoRepository, CommentMongoRepository, RatingMongoRepository, ReportMongoRepository,
  UserMongoRepository, StoryMongoRepository, LibraryItemMongoRepository,
} = require('../src/repositories');

function communityProvider(overrides = {}) {
  return {
    runtime: 'TEST',
    notification: {
      async listByUser() { return []; }, async listUnreadByUser() { return []; }, async countUnread() { return 0; },
      async markRead() { return null; }, async markAllRead() { return {modifiedCount: 0}; }, async createNotification() { return null; },
      ...overrides.notification,
    },
    comment: {
      async findById() { return null; }, async listByStory() { return []; }, async listByChapter() { return []; }, async listReplies() { return []; },
      async createComment() { return null; }, async markDeleted() { return null; }, async setStatus() { return null; },
      ...overrides.comment,
    },
    rating: {
      async findByUserAndStory() { return null; }, async createRating() { return null; }, async updateRating() { return null; },
      async deleteById() { return null; }, async aggregateForStory() { return {ratingCount: 0, ratingAverage: 0}; },
      ...overrides.rating,
    },
    report: {
      async createReport() { return null; }, async findById() { return null; },
      ...overrides.report,
    },
  };
}

function contentProvider(overrides = {}) {
  const empty = {async findById() { return null; }};
  return {
    runtime: 'TEST', genre: {},
    story: {...empty, async setRatingAggregate() { return {id: 'story-1'}; }, ...overrides.story},
    chapter: {...empty, ...overrides.chapter},
    audio: {...empty, ...overrides.audio},
  };
}

function identityProvider(overrides = {}) {
  return {user: {async findById() { return null; }, ...overrides.user}, otpToken: {}, authorApplication: {}};
}

test.afterEach(() => {
  resetCommunityRepositoriesToProduction();
  resetContentRepositoriesToProduction();
  resetIdentityRepositoriesToProduction();
});

test('production Community provider remains Mongo-only after the Audit runtime cutover', () => {
  const community = getCommunityRepositories();
  assert.equal(community.runtime, 'MONGO');
  assert.ok(community.notification instanceof NotificationMongoRepository);
  assert.ok(community.comment instanceof CommentMongoRepository);
  assert.ok(community.rating instanceof RatingMongoRepository);
  assert.ok(community.report instanceof ReportMongoRepository);
  assert.equal(getContentRepositories().runtime, 'MONGO');
  assert.ok(getContentRepositories().story instanceof StoryMongoRepository);
  assert.ok(getIdentityRepositories().user instanceof UserMongoRepository);
  assert.ok(require('../src/repositories/personalizationRuntime').getPersonalizationRepositories().libraryItem instanceof LibraryItemMongoRepository);
  assert.equal(require('../src/repositories').getAuditRepositories().runtime, 'MONGO');
  assert.equal(typeof require('../src/repositories').AuditLogMongoRepository, 'function');
  assert.equal(require('../src/modules/notifications/notificationService').notificationRepository, undefined);
});

test('Notification service scopes every operation to the authenticated user and has no public creation path', async () => {
  const calls = [];
  configureCommunityRepositoriesForTests(communityProvider({notification: {
    async listByUser(userId) { calls.push(['list', userId]); return [{id: 'n-1', userId}]; },
    async markRead(userId, id) { calls.push(['read', userId, id]); return userId === 'user-1' ? {id, userId, isRead: true} : null; },
    async markAllRead(userId) { calls.push(['all', userId]); return {modifiedCount: 1}; },
  }}));
  assert.deepEqual(await notificationService.list('user-1'), [{id: 'n-1', userId: 'user-1'}]);
  assert.equal((await notificationService.markRead('user-2', 'n-1')), null);
  await notificationService.markAllRead('user-1');
  assert.deepEqual(calls, [['list', 'user-1'], ['read', 'user-2', 'n-1'], ['all', 'user-1'], ['list', 'user-1']]);
  assert.equal(typeof notificationService.createInternal, 'function');
});

test('Comment service derives ownership, validates Story/Chapter/reply context, hides deleted rows, and uses DELETED mutation', async () => {
  const created = [];
  const deleted = [];
  configureContentRepositoriesForTests(contentProvider({
    story: {async findById(id) { return id === 'story-1' ? {id, visibility: 'PUBLIC', reviewStatus: 'APPROVED'} : null; }, async setRatingAggregate() { return {id: 'story-1'}; }},
    chapter: {async findById(id) { return id === 'chapter-1' ? {id, storyId: 'story-1'} : {id, storyId: 'other-story'}; }},
  }));
  configureCommunityRepositoriesForTests(communityProvider({comment: {
    async findById(id) { return id === 'parent-1' ? {id, storyId: 'story-1', chapterId: 'chapter-1', userId: 'owner'} : id === 'comment-1' ? {id, storyId: 'story-1', userId: 'owner'} : null; },
    async createComment(input) { created.push(input); return {id: 'comment-2', ...input, status: 'ACTIVE'}; },
    async listByStory() { return [{id: 'active', content: 'visible', status: 'ACTIVE'}]; },
    async markDeleted(id) { deleted.push(id); return {id, status: 'DELETED'}; },
  }}));
  const comment = await communityService.addComment('actor', 'story-1', '  Hello  ', {chapterId: 'chapter-1', parentCommentId: 'parent-1'});
  assert.equal(created[0].userId, 'actor');
  assert.equal(created[0].content, 'Hello');
  assert.equal(comment.text, 'Hello');
  assert.equal(comment.content, undefined);
  await assert.rejects(() => communityService.addComment('actor', 'story-1', 'x', {chapterId: 'chapter-other'}), error => error.code === 'NOT_FOUND');
  await assert.rejects(() => communityService.addComment('actor', 'story-1', 'x', {parentCommentId: 'unknown'}), error => error.code === 'NOT_FOUND');
  await assert.rejects(() => communityService.removeComment('attacker', 'comment-1'), error => error.code === 'FORBIDDEN');
  await communityService.removeComment('owner', 'comment-1');
  assert.deepEqual(deleted, ['comment-1']);
  assert.deepEqual((await communityService.comments('story-1')).map(item => item.text), ['visible']);
});

test('Rating upsert recomputes Story aggregate, does not increase count on update, and fails visibly after unsuccessful reconciliation', async () => {
  const ratings = [];
  const aggregateWrites = [];
  const ratingRepository = {
    async findByUserAndStory(userId, storyId) { return ratings.find(item => item.userId === userId && item.storyId === storyId) || null; },
    async createRating(input) { const rating = {id: `rating-${ratings.length + 1}`, ...input}; ratings.push(rating); return rating; },
    async updateRating(id, update) { const rating = ratings.find(item => item.id === id); Object.assign(rating, update); return {...rating}; },
    async deleteById(id) { const index = ratings.findIndex(item => item.id === id); return index < 0 ? null : ratings.splice(index, 1)[0]; },
    async aggregateForStory(storyId) { const values = ratings.filter(item => item.storyId === storyId); return {ratingCount: values.length, ratingAverage: values.length ? values.reduce((sum, item) => sum + item.stars, 0) / values.length : 0}; },
  };
  configureContentRepositoriesForTests(contentProvider({story: {
    async findById(id) { return id === 'story-1' ? {id} : null; },
    async setRatingAggregate(id, aggregate) { aggregateWrites.push({id, aggregate}); return {id, ...aggregate}; },
  }}));
  configureCommunityRepositoriesForTests(communityProvider({rating: ratingRepository}));
  assert.equal((await communityService.rate('user-1', 'story-1', 4)).value, 4);
  assert.equal(aggregateWrites.at(-1).aggregate.ratingCount, 1);
  assert.equal((await communityService.rate('user-1', 'story-1', 5)).value, 5);
  assert.equal(ratings.length, 1);
  assert.equal(aggregateWrites.at(-1).aggregate.ratingCount, 1);
  await communityService.removeRating('user-1', 'story-1');
  assert.deepEqual(aggregateWrites.at(-1).aggregate, {ratingCount: 0, ratingAverage: 0});
  await assert.rejects(() => communityService.rate('user-1', 'story-1', 2.5), error => error.code === 'VALIDATION_ERROR');

  configureContentRepositoriesForTests(contentProvider({story: {
    async findById(id) { return {id}; }, async setRatingAggregate() { throw new Error('simulated aggregate failure'); },
  }}));
  await assert.rejects(() => communityService.rate('user-2', 'story-1', 3), error => error.code === 'PERSISTENCE_ERROR');
  assert.equal(ratings.some(item => item.userId === 'user-2'), false);
});

test('Report flow takes reporter from auth context, maps the legacy chapter route once, and resolves target repositories by canonical type', async () => {
  const creates = [];
  configureContentRepositoriesForTests(contentProvider({
    story: {async findById(id) { return id === 'story-1' ? {id} : null; }, async setRatingAggregate() { return {id: 'story-1'}; }},
    chapter: {async findById(id) { return id === 'chapter-1' ? {id} : null; }},
    audio: {async findById(id) { return id === 'audio-1' ? {id} : null; }},
  }));
  configureIdentityRepositoriesForTests(identityProvider({user: {async findById(id) { return id === 'user-1' ? {id} : null; }}}));
  configureCommunityRepositoriesForTests(communityProvider({
    comment: {async findById(id) { return id === 'comment-1' ? {id} : null; }},
    report: {async createReport(input) { creates.push(input); return {id: 'report-1', ...input, status: 'OPEN', reviewedAt: null}; }},
  }));
  const report = await communityService.report('user-1', 'chapter-1', {type: 'COPYRIGHT', reporterId: 'attacker', status: 'RESOLVED'});
  assert.equal(creates[0].reporterId, 'user-1');
  assert.equal(creates[0].targetType, 'CHAPTER');
  assert.equal(creates[0].targetId, 'chapter-1');
  assert.equal(creates[0].reportType, 'COPYRIGHT');
  assert.equal(creates[0].status, undefined);
  assert.equal(report.type, 'REPORT');
  assert.equal(report.chapterId, 'chapter-1');
  assert.equal((await communityService.findReportTarget('COMMENT', 'comment-1')).id, 'comment-1');
  assert.equal((await communityService.findReportTarget('USER', 'user-1')).id, 'user-1');
  await assert.rejects(() => communityService.findReportTarget('INVALID', 'x'), error => error.code === 'VALIDATION_ERROR');
});
