const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {
  CURRENT_REPOSITORY_RUNTIME,
  UserMongoRepository,
  OtpTokenMongoRepository,
  AuthorApplicationMongoRepository,
} = require('../src/repositories');

function objectId() {
  return new mongoose.Types.ObjectId();
}

function queryResult(value, capture = {}) {
  return {
    select(selection) {
      capture.select = selection;
      return this;
    },
    sort(sort) {
      capture.sort = sort;
      return this;
    },
    lean() {
      return {exec: async () => value};
    },
  };
}

test('UserMongoRepository normalizes email and only exposes passwordHash through explicit authentication lookup', async () => {
  const id = objectId();
  const captures = [];
  const fakeModel = {
    findOne(filter) {
      const capture = {filter};
      captures.push(capture);
      return queryResult({_id: id, email: filter.email, passwordHash: 'bcrypt-hash'}, capture);
    },
  };
  const repository = new UserMongoRepository(fakeModel);

  const generic = await repository.findByEmail('  PERSON@Example.Test ');
  const auth = await repository.findForAuthenticationByEmail('PERSON@example.test');
  assert.equal(captures[0].filter.email, 'person@example.test');
  assert.equal(captures[0].select, undefined);
  assert.equal(generic.passwordHash, undefined);
  assert.equal(captures[1].select, '+passwordHash');
  assert.equal(auth.passwordHash, 'bcrypt-hash');
  assert.equal(auth.id, id.toString());
});

test('UserMongoRepository creates only trusted registration fields and targets security updates atomically', async () => {
  const id = objectId();
  const captures = {};
  const fakeModel = {
    async create(input) {
      captures.create = input;
      return {_id: id, ...input};
    },
    findByIdAndUpdate(targetId, update, options) {
      captures.update = {targetId, update, options};
      return queryResult({_id: id, username: 'Person', ...update.$set}, captures);
    },
  };
  const repository = new UserMongoRepository(fakeModel);
  const created = await repository.createRegisteredUser({
    displayName: 'Person', email: 'PERSON@Example.Test', passwordHash: 'bcrypt-hash',
    role: 'ADMIN', authorStatus: 'APPROVED', accountStatus: 'SUSPENDED', emailVerified: true, tokenVersion: 77,
  });
  assert.equal(captures.create.username, 'Person');
  assert.equal(captures.create.email, 'person@example.test');
  assert.equal(captures.create.role, 'USER');
  assert.equal(captures.create.authorStatus, 'NONE');
  assert.equal(captures.create.accountStatus, 'ACTIVE');
  assert.equal(captures.create.emailVerified, false);
  assert.equal(captures.create.tokenVersion, 0);
  assert.equal(created.passwordHash, undefined);

  await repository.incrementTokenVersion(id);
  assert.deepEqual(captures.update.update, {$inc: {tokenVersion: 1}});
  assert.equal(captures.update.options.returnDocument, 'after');
  await repository.setEmailVerified(id);
  assert.deepEqual(captures.update.update, {$set: {emailVerified: true}});
});

test('UserMongoRepository maps E11000 email duplicates to the domain error without Mongo internals', async () => {
  const fakeModel = {
    async create() {
      throw {code: 11000, keyPattern: {email: 1}, keyValue: {email: 'person@example.test'}};
    },
  };
  const repository = new UserMongoRepository(fakeModel);
  await assert.rejects(
    () => repository.createRegisteredUser({username: 'Person', email: 'person@example.test', passwordHash: 'bcrypt-hash'}),
    error => error.code === 'EMAIL_ALREADY_REGISTERED' && error.status === 409
  );
});

test('OtpTokenMongoRepository persists codeHash only and uses controlled atomic state operations', async () => {
  const userId = objectId();
  const tokenId = objectId();
  const captures = {};
  const fakeModel = {
    async create(input) {
      captures.create = input;
      return {_id: tokenId, ...input};
    },
    findOne(filter) {
      captures.findOne = filter;
      return queryResult({_id: tokenId, ...filter, codeHash: 'sha256-hash'}, captures);
    },
    updateMany(filter, update) {
      captures.invalidate = {filter, update};
      return Promise.resolve({modifiedCount: 1});
    },
    findByIdAndUpdate(id, update, options) {
      captures.update = {id, update, options};
      return queryResult({_id: tokenId, codeHash: 'sha256-hash'}, captures);
    },
  };
  const repository = new OtpTokenMongoRepository(fakeModel);
  const created = await repository.createOtp({
    userId, email: ' OTP@Example.Test ', code: '123456', codeHash: 'sha256-hash',
    purpose: 'EMAIL_VERIFICATION', expiresAt: new Date(), maxAttempts: 5,
  });
  assert.equal(captures.create.email, 'otp@example.test');
  assert.equal(captures.create.code, undefined);
  assert.equal(captures.create.codeHash, 'sha256-hash');
  assert.equal(created.codeHash, undefined);

  const verification = await repository.findLatestForVerification(userId, 'EMAIL_VERIFICATION');
  assert.deepEqual(captures.findOne, {userId, purpose: 'EMAIL_VERIFICATION'});
  assert.equal(captures.select, '+codeHash');
  assert.equal(verification.codeHash, 'sha256-hash');

  await repository.invalidateActive(userId, 'EMAIL_VERIFICATION');
  assert.deepEqual(captures.invalidate.filter, {userId, purpose: 'EMAIL_VERIFICATION', usedAt: null, invalidatedAt: null});
  assert.ok(captures.invalidate.update.$set.invalidatedAt instanceof Date);
  await repository.incrementAttempts(tokenId);
  assert.deepEqual(captures.update.update, {$inc: {attempts: 1}});
  await repository.markUsed(tokenId);
  assert.ok(captures.update.update.$set.usedAt instanceof Date);
});

test('AuthorApplicationMongoRepository uses canonical fields, pending query, duplicate mapping, and no user sync', async () => {
  const userId = objectId();
  const applicationId = objectId();
  const captures = {};
  const fakeModel = {
    async create(input) {
      captures.create = input;
      return {_id: applicationId, ...input};
    },
    findOne(filter) {
      captures.pending = filter;
      return queryResult(null, captures);
    },
    findByIdAndUpdate(id, update, options) {
      captures.review = {id, update, options};
      return queryResult({_id: applicationId, ...update.$set}, captures);
    },
  };
  const repository = new AuthorApplicationMongoRepository(fakeModel);
  await repository.createPendingApplication({
    userId, penName: 'Legacy Name', introduction: 'Legacy bio', adminNote: 'ignore', portfolioLinks: ['ignore'],
  });
  assert.equal(captures.create.userId.toString(), userId.toString());
  assert.equal(captures.create.displayName, 'Legacy Name');
  assert.equal(captures.create.bio, 'Legacy bio');
  assert.equal(captures.create.status, 'PENDING');
  assert.equal(captures.create.penName, undefined);
  assert.equal(captures.create.introduction, undefined);
  assert.equal(captures.create.adminNote, undefined);
  assert.equal(captures.create.portfolioLinks, undefined);

  await repository.findPendingByUserId(userId);
  assert.deepEqual(captures.pending, {userId, status: 'PENDING'});
  await repository.reviewApplication(applicationId, {status: 'APPROVED', reviewedBy: userId, reviewNote: 'Approved'});
  assert.deepEqual(captures.review.update.$set.status, 'APPROVED');
  assert.equal(captures.review.update.$set.reviewedBy.toString(), userId.toString());
  assert.equal(captures.review.update.$set.reviewNote, 'Approved');
  assert.equal(captures.userUpdate, undefined);

  const duplicateRepository = new AuthorApplicationMongoRepository({
    async create() { throw {code: 11000, keyPattern: {userId: 1}}; },
  });
  await assert.rejects(
    () => duplicateRepository.createPendingApplication({userId, displayName: 'Name', bio: 'Bio'}),
    error => error.code === 'APPLICATION_ALREADY_PENDING' && error.status === 409
  );
});

test('repository registry declares the explicit Mongo Identity and Content runtime', () => {
  assert.equal(CURRENT_REPOSITORY_RUNTIME, 'MONGO_IDENTITY_CONTENT_PERSONALIZATION_COMMUNITY_AND_AUDIT');
});
