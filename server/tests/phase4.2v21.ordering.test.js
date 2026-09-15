const test = require('node:test');
const assert = require('node:assert/strict');
const {AudioRepository} = require('../src/repositories/audioRepository');
const {AudioMongoRepository} = require('../src/repositories/mongo/AudioMongoRepository');
const {create: createAudio} = require('../src/modules/audio/audioService');

const ids = {story: 'story-1', chapterA: 'chapter-a', chapterB: 'chapter-b', user: 'user-1'};
const actor = {id: ids.user, role: 'USER', authorStatus: 'APPROVED'};

function repositories() {
  const audio = new AudioRepository();
  const chapters = new Map([[ids.chapterA, {id: ids.chapterA, storyId: ids.story}], [ids.chapterB, {id: ids.chapterB, storyId: ids.story}]]);
  const stories = new Map([[ids.story, {id: ids.story, creatorId: ids.user}]]);
  return {
    audio: {
      findById: async id => audio.findById(id),
      findByChapter: async id => audio.findByChapter(id),
      findMaxPartNumberByChapter: async id => audio.findMaxPartNumberByChapter(id),
      createAudio: async input => audio.createAudio(input),
    },
    chapter: {findById: async id => chapters.get(id)},
    story: {findById: async id => stories.get(id)},
  };
}

test('V2.1 assigns monotonic part numbers per chapter and isolates chapters', async () => {
  const repos = repositories();
  const first = await createAudio({chapterId: ids.chapterA}, actor, {repositories: repos});
  const second = await createAudio({chapterId: ids.chapterA}, actor, {repositories: repos});
  const otherChapter = await createAudio({chapterId: ids.chapterB}, actor, {repositories: repos});
  assert.equal(first.partNumber, 1);
  assert.equal(second.partNumber, 2);
  assert.equal(otherChapter.partNumber, 1);
  const deleted = await repos.audio.findByChapter(ids.chapterA);
  deleted[1].deletedAt = new Date().toISOString();
  const next = await createAudio({chapterId: ids.chapterA}, actor, {repositories: repos});
  assert.equal(next.partNumber, 3);
});

test('V2.1 concurrent same-chapter creation has one winner and controlled conflict', async () => {
  const repos = repositories();
  const results = await Promise.allSettled([
    createAudio({chapterId: ids.chapterA}, actor, {repositories: repos}),
    createAudio({chapterId: ids.chapterA}, actor, {repositories: repos}),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected' && result.reason.code === 'AUDIO_PART_CONFLICT').length, 1);
});

test('V2.1 Mongo repository sorts by partNumber and maps the canonical field', async () => {
  const captures = {};
  const query = value => ({sort(value) { captures.sort = value; return this; }, select(value) { captures.select = value; return this; }, lean() { return {exec: async () => value}; }});
  const model = {
    find(filter) { captures.filter = filter; return query([{_id: '507f1f77bcf86cd799439011', chapterId: '507f1f77bcf86cd799439012', partNumber: 2}, {_id: '507f1f77bcf86cd799439013', chapterId: '507f1f77bcf86cd799439012', partNumber: 1}]); },
    findOne(filter) { captures.maxFilter = filter; return query({_id: '507f1f77bcf86cd799439011', partNumber: 7}); },
    findOneAndUpdate(filter, update) { captures.restore = {filter, update}; return query({_id: '507f1f77bcf86cd799439011', chapterId: '507f1f77bcf86cd799439012', partNumber: 7, ...update.$set}); },
    async create(input) { captures.create = input; return {_id: '507f1f77bcf86cd799439011', ...input}; },
  };
  const repository = new AudioMongoRepository(model);
  const rows = await repository.findByChapter('507f1f77bcf86cd799439012');
  assert.deepEqual(captures.sort, {partNumber: 1});
  assert.deepEqual(rows.map(row => row.partNumber), [2, 1]);
  assert.equal(await repository.findMaxPartNumberByChapter('507f1f77bcf86cd799439012'), 7);
  assert.deepEqual(captures.maxFilter.partNumber, {$type: 'number'});
  await repository.createAudio({storyId: '507f1f77bcf86cd799439013', chapterId: '507f1f77bcf86cd799439012', creatorId: '507f1f77bcf86cd799439014', partNumber: 3, title: 'Part', audioUrl: '/api/audio/a/playback'});
  assert.equal(captures.create.partNumber, 3);
  await repository.restoreWithinRetention('507f1f77bcf86cd799439011', new Date('2026-01-01T00:00:00.000Z'));
  assert.deepEqual(captures.restore.update.$set, {deletedAt: null, deletedBy: null, isPrimary: false});
});
