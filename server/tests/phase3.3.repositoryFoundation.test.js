const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {
  CURRENT_REPOSITORY_RUNTIME,
  selectCurrentRepository,
  MongooseRepository,
  RepositoryError,
  mapMongoError,
  isValidObjectId,
  normalizeObjectId,
  toObjectId,
  toRuntimeObject,
  buildEqualityFilter,
  buildSetUpdate,
  serializeTranscript,
  safeParseTranscript,
  mapUserRuntimeToPersistence,
  mapAuthorApplicationRuntimeToPersistence,
  mapStoryRuntimeToPersistence,
  mapChapterRuntimeToPersistence,
  mapAudioRuntimeToPersistence,
  mapLibraryRuntimeToPersistence,
  mapReportRuntimeToPersistence,
} = require('../src/repositories');

function objectId() {
  return new mongoose.Types.ObjectId();
}

test('ObjectId and plain-object adapters preserve runtime id without Mongoose internals', () => {
  const id = objectId();
  assert.equal(isValidObjectId(id), true);
  assert.equal(normalizeObjectId(id), id.toString());
  assert.equal(toObjectId(id.toString()).toString(), id.toString());
  assert.throws(() => normalizeObjectId('invalid-object-id'), error => error.code === 'INVALID_ID');

  const runtime = toRuntimeObject({_id: id, __v: 4, nested: {ownerId: id}, items: [{_id: id}]});
  assert.deepEqual(runtime, {
    id: id.toString(),
    nested: {ownerId: id.toString()},
    items: [{_id: id.toString()}],
  });
});

test('transcript adapter serializes structured input and safely falls back for malformed persistence strings', () => {
  const segments = [{start: 0, end: 1.2, text: 'Hello'}];
  const serialized = serializeTranscript(segments);
  assert.equal(serialized, JSON.stringify(segments));
  assert.deepEqual(safeParseTranscript(serialized), segments);
  assert.deepEqual(safeParseTranscript('{malformed'), []);
  assert.deepEqual(safeParseTranscript('{"not":"an array"}'), []);
  assert.deepEqual(safeParseTranscript(''), []);
  assert.throws(() => serializeTranscript('{"raw":"persistence"}'), error => error.code === 'INVALID_TRANSCRIPT');
});

test('canonical compatibility mappers centralize legacy field and status transformations', () => {
  assert.deepEqual(
    mapUserRuntimeToPersistence({displayName: 'Legacy Name', bio: 'Bio', avatarUrl: 'avatar.png', role: 'ADMIN', status: 'SUSPENDED'}),
    {username: 'Legacy Name', profile: {bio: 'Bio', avatar: 'avatar.png'}}
  );
  assert.deepEqual(
    mapUserRuntimeToPersistence({status: 'SUSPENDED'}, {allowProtected: true}),
    {accountStatus: 'SUSPENDED'}
  );
  assert.deepEqual(
    mapAuthorApplicationRuntimeToPersistence({penName: 'Narrator', introduction: 'About', adminNote: 'Review', portfolioLinks: ['ignored']}),
    {displayName: 'Narrator', bio: 'About', reviewNote: 'Review'}
  );
  assert.deepEqual(
    mapStoryRuntimeToPersistence({status: 'DRAFT', cover: 'cover.jpg', genres: ['genre-id']}),
    {coverUrl: 'cover.jpg', genreIds: ['genre-id'], status: 'ONGOING', reviewStatus: 'DRAFT'}
  );
  assert.deepEqual(
    mapStoryRuntimeToPersistence({status: 'COMPLETED', reviewStatus: 'APPROVED'}),
    {status: 'COMPLETED', reviewStatus: 'APPROVED'}
  );
  assert.deepEqual(mapChapterRuntimeToPersistence({status: 'PUBLISHED', content: 'Text'}), {textContent: 'Text', status: 'APPROVED'});
  assert.throws(() => mapChapterRuntimeToPersistence({status: 'HIDDEN'}), error => error.code === 'UNMAPPABLE_LEGACY_STATUS');
  assert.deepEqual(
    mapAudioRuntimeToPersistence({ownerId: 'creator-id', processingStatus: 'UPLOADING', transcript: []}),
    {creatorId: 'creator-id', transcript: '[]', processingStatus: 'PENDING'}
  );
  assert.throws(() => mapAudioRuntimeToPersistence({transcript: 'not-structured'}), error => error.code === 'INVALID_TRANSCRIPT');
  assert.deepEqual(mapLibraryRuntimeToPersistence({userId: 'u', storyId: 's', type: 'FAVORITE'}), {
    userId: 'u', storyId: 's', isFavorite: true, followed: false,
  });
  assert.throws(() => mapLibraryRuntimeToPersistence({type: 'PROGRESS'}), error => error.code === 'UNMAPPABLE_LEGACY_LIBRARY_RECORD');
  assert.deepEqual(
    mapReportRuntimeToPersistence({reporterId: 'u', targetType: 'CHAPTER', targetId: 'c', type: 'COPYRIGHT', handledBy: 'admin', resolvedAt: 'date'}),
    {reporterId: 'u', targetType: 'CHAPTER', targetId: 'c', reportType: 'COPYRIGHT', reviewedBy: 'admin', reviewedAt: 'date'}
  );
});

test('allowlisted query and update helpers reject operator-shaped input and mass-assignment fields', () => {
  assert.deepEqual(buildEqualityFilter({email: 'person@example.test', role: 'ADMIN'}, ['email']), {email: 'person@example.test'});
  assert.throws(
    () => buildEqualityFilter({email: {$ne: 'person@example.test'}}, ['email']),
    error => error.code === 'INVALID_FILTER'
  );
  assert.deepEqual(buildSetUpdate({username: 'Safe', role: 'ADMIN', tokenVersion: 99}, ['username']), {$set: {username: 'Safe'}});
  assert.throws(() => buildSetUpdate({role: 'ADMIN'}, ['username']), error => error.code === 'EMPTY_UPDATE');
});

test('Mongo error mapper normalizes database errors without leaking raw internals', () => {
  const duplicate = mapMongoError({code: 11000, keyPattern: {email: 1}, keyValue: {email: 'person@example.test'}});
  assert.equal(duplicate.code, 'DUPLICATE_KEY');
  assert.equal(duplicate.status, 409);
  assert.deepEqual(duplicate.details, {keyPattern: {email: 1}, keyValue: {email: 'person@example.test'}});
  assert.equal(mapMongoError({name: 'ValidationError'}).code, 'PERSISTENCE_VALIDATION_ERROR');
  assert.equal(mapMongoError({name: 'CastError'}).code, 'INVALID_ID');
  assert.equal(mapMongoError(new Error('mongodb host credentials')).code, 'PERSISTENCE_ERROR');
});

test('MongooseRepository read helper normalizes fake-model results without database access', async () => {
  const id = objectId();
  let capturedId;
  const fakeModel = {
    findById(value) {
      capturedId = value;
      return {lean: () => ({exec: async () => ({_id: id, title: 'Read only'})})};
    },
  };
  const repository = new MongooseRepository(fakeModel);
  const result = await repository.findById(id.toString());
  assert.equal(capturedId.toString(), id.toString());
  assert.deepEqual(result, {id: id.toString(), title: 'Read only'});
});

test('repository utilities remain explicit and do not choose a fallback runtime', () => {
  assert.equal(CURRENT_REPOSITORY_RUNTIME, 'MONGO_IDENTITY_CONTENT_PERSONALIZATION_COMMUNITY_AND_AUDIT');
  assert.ok(selectCurrentRepository().user);
  assert.equal(selectCurrentRepository().user.rawRepository, undefined);
  assert.ok(RepositoryError);
});
