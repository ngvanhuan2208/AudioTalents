const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {User, OtpToken, AuthorApplication} = require('../src/models');

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

test('User compiles with only canonical fields, defaults, private password hash, and normalized email', async () => {
  const user = new User({
    username: '  Canonical User  ',
    email: '  USER@Example.COM ',
    passwordHash: 'bcrypt-hash',
  });

  await user.validate();
  assert.equal(user.username, 'Canonical User');
  assert.equal(user.email, 'user@example.com');
  assert.equal(user.role, 'USER');
  assert.equal(user.authorStatus, 'NONE');
  assert.equal(user.accountStatus, 'ACTIVE');
  assert.equal(user.emailVerified, false);
  assert.equal(user.tokenVersion, 0);
  assert.equal(user.profile.bio, '');
  assert.equal(user.profile.avatar, null);
  assert.equal(user.lastLoginAt, null);
  assert.equal(User.schema.path('passwordHash').options.select, false);
  assert.deepEqual(User.PROTECTED_FIELDS, [
    'role', 'authorStatus', 'accountStatus', 'emailVerified', 'tokenVersion', 'passwordHash',
  ]);

  for (const field of ['displayName', 'avatarUrl', 'bio', 'status']) {
    assert.equal(User.schema.path(field), undefined, `${field} must not be persisted`);
  }
  for (const field of ['createdAt', 'updatedAt']) assert.ok(User.schema.path(field));
});

test('User rejects invalid identity and account enums', async () => {
  const base = {username: 'Valid', email: 'valid@example.com', passwordHash: 'bcrypt-hash'};
  for (const [field, value] of [
    ['role', 'MODERATOR'],
    ['authorStatus', 'WRITER'],
    ['accountStatus', 'DISABLED'],
  ]) {
    const error = await validationError(new User({...base, [field]: value}));
    assert.ok(error?.errors[field]);
  }
});

test('OtpToken uses the canonical security fields, timestamps, and indexes', async () => {
  const token = new OtpToken({
    userId: objectId(),
    email: ' OTP@Example.COM ',
    codeHash: 'sha256-hash',
    purpose: 'EMAIL_VERIFICATION',
    expiresAt: new Date(Date.now() + 60_000),
  });

  await token.validate();
  assert.equal(token.email, 'otp@example.com');
  assert.equal(token.attempts, 0);
  assert.equal(token.maxAttempts, 5);
  assert.equal(token.usedAt, null);
  assert.equal(token.invalidatedAt, null);
  assert.equal(OtpToken.schema.path('codeHash').options.select, false);
  assert.equal(OtpToken.schema.path('code'), undefined);
  assert.ok(OtpToken.schema.path('createdAt'));
  assert.ok(OtpToken.schema.path('updatedAt'));
  assert.ok((await validationError(new OtpToken({...token.toObject(), purpose: 'UNKNOWN'}))).errors.purpose);

  assert.deepEqual(indexFor(OtpToken.schema, {expiresAt: 1})[1], {expireAfterSeconds: 0});
  assert.deepEqual(indexFor(OtpToken.schema, {userId: 1, purpose: 1})[1], {});
  assert.deepEqual(indexFor(OtpToken.schema, {email: 1, purpose: 1})[1], {});
});

test('AuthorApplication preserves canonical fields and partial pending uniqueness definition', async () => {
  const application = new AuthorApplication({
    userId: objectId(),
    displayName: '  Audio Creator  ',
    bio: '  Narrator and writer  ',
  });

  await application.validate();
  assert.equal(application.displayName, 'Audio Creator');
  assert.equal(application.bio, 'Narrator and writer');
  assert.deepEqual(application.contentTypes, []);
  assert.equal(application.experience, '');
  assert.equal(application.status, 'PENDING');
  assert.ok(application.submittedAt instanceof Date);
  assert.equal(application.reviewedAt, null);
  assert.equal(application.reviewedBy, null);
  assert.equal(application.reviewNote, '');
  assert.ok(AuthorApplication.schema.path('createdAt'));
  assert.ok(AuthorApplication.schema.path('updatedAt'));

  for (const field of ['penName', 'introduction', 'portfolioLinks', 'adminNote']) {
    assert.equal(AuthorApplication.schema.path(field), undefined, `${field} must not be persisted`);
  }
  assert.ok((await validationError(new AuthorApplication({...application.toObject(), status: 'SUSPENDED'}))).errors.status);

  assert.deepEqual(indexFor(AuthorApplication.schema, {userId: 1})[1], {
    unique: true,
    partialFilterExpression: {status: 'PENDING'},
  });
  assert.deepEqual(indexFor(AuthorApplication.schema, {createdAt: -1})[1], {});
});

test('identity model registry has one compiled model for each canonical identity domain', () => {
  assert.equal(mongoose.connection.readyState, 0, 'model registry must not connect to MongoDB');
  assert.equal(mongoose.models.User, User);
  assert.equal(mongoose.models.OtpToken, OtpToken);
  assert.equal(mongoose.models.AuthorApplication, AuthorApplication);
  assert.equal(Object.keys(mongoose.models).filter(name => ['User', 'OtpToken', 'AuthorApplication'].includes(name)).length, 3);
});
