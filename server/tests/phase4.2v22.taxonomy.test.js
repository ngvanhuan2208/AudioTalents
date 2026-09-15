const test = require('node:test');
const assert = require('node:assert/strict');
const {InMemoryRepository} = require('../src/repositories/InMemoryRepository');
const {createInMemoryContentRepositories, configureContentRepositoriesForTests, resetContentRepositoriesToProduction} = require('../src/repositories/contentRuntime');
const taxonomyService = require('../src/modules/taxonomy/taxonomyService');
const storyService = require('../src/modules/stories/storyService');

const creator = {id: 'creator-1', role: 'USER', authorStatus: 'APPROVED'};
const otherCreator = {id: 'creator-2', role: 'USER', authorStatus: 'APPROVED'};
const admin = {id: 'admin-1', role: 'ADMIN', authorStatus: 'NONE'};

function setup() {
  const genreRepository = new InMemoryRepository([{id: 'genre-1', name: 'Fantasy', slug: 'fantasy', isActive: true}]);
  const storyRepository = new InMemoryRepository([{id: 'story-1', creatorId: creator.id, genres: [], genreIds: [], tags: []}]);
  const repos = createInMemoryContentRepositories({genreRepository, storyRepository, chapterRepository: new InMemoryRepository(), audioRepository: new InMemoryRepository()});
  configureContentRepositoriesForTests(repos);
  return {repos, genreRepository, storyRepository};
}

test('V2.2 active catalogs are selectable and duplicate names are rejected', async t => {
  const {repos} = setup();
  t.after(resetContentRepositoriesToProduction);
  assert.equal((await taxonomyService.listTags()).length, 0);
  await taxonomyService.createTag({name: '  Dark  Space '}, admin);
  await assert.rejects(() => taxonomyService.createTag({name: 'dark space'}, admin), error => error.code === 'CONFLICT');
  const tag = (await taxonomyService.listTags())[0];
  await taxonomyService.setTagActive(tag.id, false, admin);
  assert.equal((await taxonomyService.listTags()).length, 0);
  assert.equal((await taxonomyService.listTags({all: true})).length, 1);
  assert.ok(repos.tag);
});

test('Creator proposal is ownership- and author-status-gated and stays separate while pending', async t => {
  const {storyRepository} = setup();
  t.after(resetContentRepositoriesToProduction);
  const proposal = await taxonomyService.createProposal({type: 'TAG', proposedName: 'New Voice', reason: 'This tag describes the narration style.', storyId: 'story-1'}, creator);
  assert.equal(proposal.status, 'PENDING');
  assert.deepEqual(storyRepository.findById('story-1').tags, []);
  await assert.rejects(() => taxonomyService.createProposal({type: 'TAG', proposedName: 'Other', reason: 'Valid reason', storyId: 'story-1'}, otherCreator), error => error.code === 'FORBIDDEN');
  await assert.rejects(() => taxonomyService.createProposal({type: 'TAG', proposedName: 'Other', reason: 'Valid reason', storyId: 'story-1'}, {id: 'creator-1', role: 'USER', authorStatus: 'PENDING'}), error => error.code === 'FORBIDDEN');
});

test('Admin approval creates canonical Tag, attaches its name, and is idempotently guarded', async t => {
  const {storyRepository} = setup();
  t.after(resetContentRepositoriesToProduction);
  const proposal = await taxonomyService.createProposal({type: 'TAG', proposedName: 'New Voice', reason: 'This tag describes the narration style.', storyId: 'story-1'}, creator);
  const approved = await taxonomyService.approveProposal(proposal.id, {}, admin);
  assert.equal(approved.status, 'APPROVED');
  assert.deepEqual(storyRepository.findById('story-1').tags, ['New Voice']);
  await assert.rejects(() => taxonomyService.approveProposal(proposal.id, {}, admin), error => error.code === 'PROPOSAL_REVIEWED');
});

test('Admin approval resolves an existing Genre without creating a duplicate', async t => {
  const {genreRepository, storyRepository} = setup();
  t.after(resetContentRepositoriesToProduction);
  const proposal = await taxonomyService.createProposal({type: 'GENRE', proposedName: ' fantasy ', reason: 'This is the correct story classification.', storyId: 'story-1'}, creator);
  const approved = await taxonomyService.approveProposal(proposal.id, {}, admin);
  assert.equal(approved.resolvedTaxonomyId, 'genre-1');
  assert.equal(genreRepository.count(), 1);
  assert.deepEqual(storyRepository.findById('story-1').genres, ['genre-1']);
});

test('Rejecting a proposal requires a review note and never changes Story taxonomy', async t => {
  const {storyRepository} = setup();
  t.after(resetContentRepositoriesToProduction);
  const proposal = await taxonomyService.createProposal({type: 'GENRE', proposedName: 'Mystery', reason: 'This is the correct story classification.', storyId: 'story-1'}, creator);
  await assert.rejects(() => taxonomyService.rejectProposal(proposal.id, {}, admin), error => error.code === 'VALIDATION_ERROR');
  const rejected = await taxonomyService.rejectProposal(proposal.id, {reviewNote: 'Already covered by an existing category.'}, admin);
  assert.equal(rejected.status, 'REJECTED');
  assert.deepEqual(storyRepository.findById('story-1').genres, []);
});

test('Story submission accepts a pending Genre proposal, while Admin approval still requires canonical Genre', async t => {
  const genreRepository = new InMemoryRepository();
  const storyRepository = new InMemoryRepository([{id: 'story-1', creatorId: creator.id, title: 'A Story', description: 'Long enough description', genres: [], genreIds: [], tags: [], reviewStatus: 'DRAFT', visibility: 'PRIVATE'}]);
  const repos = createInMemoryContentRepositories({genreRepository, storyRepository, chapterRepository: new InMemoryRepository(), audioRepository: new InMemoryRepository()});
  configureContentRepositoriesForTests(repos);
  t.after(resetContentRepositoriesToProduction);
  await taxonomyService.createProposal({type: 'GENRE', proposedName: 'Mystery', reason: 'This is the correct story classification.', storyId: 'story-1'}, creator);
  const submitted = await storyService.submit('story-1', creator);
  assert.equal(submitted.reviewStatus, 'PENDING_REVIEW');
  await assert.rejects(() => storyService.moderate('story-1', 'APPROVED', admin), error => error.code === 'TAXONOMY_REQUIRED');
});
