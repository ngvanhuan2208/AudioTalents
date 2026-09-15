const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {Genre, Story, Chapter, Audio} = require('../src/models');

function objectId() {
  return new mongoose.Types.ObjectId();
}

function indexFor(schema, keys) {
  return schema.indexes().find(([definition]) => JSON.stringify(definition) === JSON.stringify(keys));
}

async function validationError(document) {
  try {
    await document.validate();
    assert.fail('Expected schema validation to fail');
  } catch (error) {
    return error;
  }
}

test('Genre has canonical defaults, normalized slug, and only contract indexes', async () => {
  const genre = new Genre({name: '  Fantasy  ', slug: '  Epic-Fantasy  '});
  await genre.validate();

  assert.equal(genre.name, 'Fantasy');
  assert.equal(genre.slug, 'epic-fantasy');
  assert.equal(genre.description, '');
  assert.equal(genre.icon, null);
  assert.equal(genre.isActive, true);
  assert.equal(genre.sortOrder, 0);
  assert.deepEqual(indexFor(Genre.schema, {slug: 1})[1], {unique: true});
  assert.deepEqual(indexFor(Genre.schema, {name: 1})[1], {});
});

test('Story separates progress, moderation, visibility, counters, and local public filter', async () => {
  const story = new Story({
    creatorId: objectId(),
    title: '  Canonical Story  ',
    slug: '  Canonical-Story  ',
    description: 'A canonical story',
    genreIds: [objectId()],
    tags: ['  fantasy  ', 'audio'],
  });
  await story.validate();

  assert.equal(story.slug, 'canonical-story');
  assert.deepEqual(story.tags, ['fantasy', 'audio']);
  assert.equal(story.status, 'ONGOING');
  assert.equal(story.reviewStatus, 'DRAFT');
  assert.equal(story.visibility, 'PRIVATE');
  for (const field of ['chapterCount', 'viewCount', 'listenCount', 'favoriteCount', 'ratingAverage', 'ratingCount']) {
    assert.equal(story[field], 0);
  }
  assert.equal(story.deletedAt, null);
  assert.equal(story.deletedBy, null);
  assert.deepEqual(Story.PUBLIC_FILTER, {reviewStatus: 'APPROVED', visibility: 'PUBLIC', deletedAt: null});

  assert.ok((await validationError(new Story({...story.toObject(), status: 'DRAFT'}))).errors.status);
  assert.ok((await validationError(new Story({...story.toObject(), reviewStatus: 'ONGOING'}))).errors.reviewStatus);
  assert.ok((await validationError(new Story({...story.toObject(), visibility: 'HIDDEN'}))).errors.visibility);
  assert.ok((await validationError(new Story({...story.toObject(), ratingAverage: 6}))).errors.ratingAverage);
  for (const field of ['cover', 'genres', 'contentStatus', 'rating', 'views', 'listens', 'duration']) {
    assert.equal(Story.schema.path(field), undefined, `${field} must not be persisted`);
  }

  assert.deepEqual(indexFor(Story.schema, {slug: 1})[1], {unique: true});
  assert.deepEqual(indexFor(Story.schema, {creatorId: 1})[1], {});
  assert.deepEqual(indexFor(Story.schema, {genreIds: 1})[1], {});
  assert.deepEqual(indexFor(Story.schema, {reviewStatus: 1, publishedAt: -1})[1], {});
  assert.deepEqual(indexFor(Story.schema, {createdAt: -1})[1], {});
  assert.deepEqual(indexFor(Story.schema, {title: 'text', description: 'text'})[1], {});
});

test('Chapter has canonical moderation status, one-based numbering, ownership fields, and local public filter', async () => {
  const chapter = new Chapter({
    storyId: objectId(),
    creatorId: objectId(),
    chapterNumber: 1,
    title: '  Chapter One  ',
    slug: '  Chapter-One  ',
  });
  await chapter.validate();

  assert.equal(chapter.title, 'Chapter One');
  assert.equal(chapter.slug, 'chapter-one');
  assert.equal(chapter.textContent, '');
  assert.equal(chapter.status, 'DRAFT');
  assert.equal(chapter.deletedAt, null);
  assert.equal(chapter.deletedBy, null);
  assert.deepEqual(Chapter.PUBLIC_FILTER, {status: 'APPROVED', deletedAt: null});
  assert.ok((await validationError(new Chapter({...chapter.toObject(), chapterNumber: 0}))).errors.chapterNumber);
  assert.ok((await validationError(new Chapter({...chapter.toObject(), status: 'PUBLISHED'}))).errors.status);
  for (const field of ['content', 'reviewStatus', 'contentStatus']) {
    assert.equal(Chapter.schema.path(field), undefined, `${field} must not be persisted`);
  }

  assert.deepEqual(indexFor(Chapter.schema, {storyId: 1, chapterNumber: 1})[1], {unique: true});
  assert.deepEqual(indexFor(Chapter.schema, {storyId: 1, status: 1})[1], {});
});

test('Audio separates source, processing, moderation, transcript, primary, and soft-delete concerns', async () => {
  const audio = new Audio({
    storyId: objectId(),
    chapterId: objectId(),
    creatorId: objectId(),
    title: '  Chapter narration  ',
    audioUrl: '  https://cdn.example.test/chapter.mp3  ',
  });
  await audio.validate();

  assert.equal(audio.title, 'Chapter narration');
  assert.equal(audio.audioUrl, 'https://cdn.example.test/chapter.mp3');
  assert.equal(audio.storageKey, null);
  assert.equal(audio.transcript, '');
  assert.equal(audio.sourceType, 'HUMAN');
  assert.equal(audio.processingStatus, 'PENDING');
  assert.equal(audio.status, 'DRAFT');
  assert.equal(audio.isPrimary, false);
  assert.equal(audio.partNumber, undefined);
  assert.equal(audio.deletedAt, null);
  assert.equal(audio.deletedBy, null);
  assert.deepEqual(Audio.PUBLIC_FILTER, {status: 'APPROVED', processingStatus: 'READY', deletedAt: null});
  assert.deepEqual(Audio.DEFAULT_PLAYBACK_FILTER, {
    status: 'APPROVED', processingStatus: 'READY', deletedAt: null, isPrimary: true,
  });

  assert.ok((await validationError(new Audio({...audio.toObject(), sourceType: 'SYNTHETIC'}))).errors.sourceType);
  assert.ok((await validationError(new Audio({...audio.toObject(), processingStatus: 'UPLOADING'}))).errors.processingStatus);
  assert.ok((await validationError(new Audio({...audio.toObject(), status: 'PROCESSING'}))).errors.status);
  assert.ok((await validationError(new Audio({...audio.toObject(), durationSec: -1}))).errors.durationSec);
  assert.ok((await validationError(new Audio({...audio.toObject(), partNumber: 0}))).errors.partNumber);
  for (const field of ['ownerId', 'contentStatus', 'buffer', 'audioData', 'base64']) {
    assert.equal(Audio.schema.path(field), undefined, `${field} must not be persisted`);
  }

  assert.deepEqual(indexFor(Audio.schema, {chapterId: 1})[1], {});
  assert.deepEqual(indexFor(Audio.schema, {creatorId: 1, status: 1})[1], {});
  assert.deepEqual(indexFor(Audio.schema, {chapterId: 1, status: 1, processingStatus: 1, isPrimary: 1})[1], {});
  assert.deepEqual(indexFor(Audio.schema, {chapterId: 1, isPrimary: 1})[1], {
    unique: true,
    partialFilterExpression: {isPrimary: true, deletedAt: null},
  });
  assert.deepEqual(indexFor(Audio.schema, {chapterId: 1, partNumber: 1})[1], {
    unique: true,
    partialFilterExpression: {partNumber: {$type: 'number'}},
  });
});

test('content models compile without connecting to MongoDB or registering duplicate models', () => {
  assert.equal(mongoose.connection.readyState, 0);
  assert.equal(mongoose.models.Genre, Genre);
  assert.equal(mongoose.models.Story, Story);
  assert.equal(mongoose.models.Chapter, Chapter);
  assert.equal(mongoose.models.Audio, Audio);
});
