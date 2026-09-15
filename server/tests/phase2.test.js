const test = require('node:test');
const assert = require('node:assert/strict');

const authService = require('../src/modules/auth/authService');
const {userRepository} = require('../src/repositories/userRepository');
const {storyRepository} = require('../src/repositories/storyRepository');
const {creatorRepository} = require('../src/repositories/creatorRepository');
const {AUTHOR_STATUS, ROLES} = require('../src/constants/roles');
const {create, update, submit} = require('../src/modules/stories/storyService');
const {updateMe} = require('../src/modules/users/userService');
const emailService = require('../src/services/emailService');
const {useInMemoryIdentityRepositoriesForTest} = require('./helpers/identityTestRuntime');
const {useInMemoryContentRepositoriesForTest} = require('./helpers/contentTestRuntime');

function resetRepositories() {
  useInMemoryIdentityRepositoriesForTest();
  useInMemoryContentRepositoriesForTest();
  userRepository.items = [];
  storyRepository.items = [];
  creatorRepository.items = [];
  emailService.clearTestDelivery();
  require('../src/services/otpService').otpTokenRepository.items = [];
}

test('register and login issue tokens for a normal user', async () => {
  resetRepositories();
  let verificationCode;
  emailService.setTestDelivery(async ({code}) => { verificationCode = code; });

  const user = await authService.register({username: 'Alice', email: 'alice@test.com', password: 'password123'});
  assert.equal(user.user.role, ROLES.USER);
  assert.equal(user.user.emailVerified, false);
  assert.equal(user.emailVerificationRequired, true);

  await assert.rejects(() => authService.login({email: 'alice@test.com', password: 'password123'}), error => error.code === 'EMAIL_NOT_VERIFIED');
  await authService.verifyEmail('alice@test.com', verificationCode);

  const result = await authService.login({email: 'alice@test.com', password: 'password123'});
  assert.equal(result.user.email, 'alice@test.com');
  assert.ok(result.accessToken);
});

test('user profile update ignores role and author status escalation', async () => {
  resetRepositories();
  const user = userRepository.create({
    username: 'Bob',
    email: 'bob@test.com',
    passwordHash: 'hash',
    role: ROLES.USER,
    authorStatus: AUTHOR_STATUS.NONE,
    status: 'ACTIVE',
    profile: {bio: '', avatar: null}
  });

  const updated = await updateMe(user.id, {role: ROLES.ADMIN, authorStatus: AUTHOR_STATUS.APPROVED, username: 'Bobby'});
  assert.equal(updated.role, ROLES.USER);
  assert.equal(updated.authorStatus, AUTHOR_STATUS.NONE);
  assert.equal(updated.username, 'Bobby');
});

test('pending author cannot create a story', async () => {
  resetRepositories();
  const user = userRepository.create({
    username: 'Pending',
    email: 'pending@test.com',
    passwordHash: 'hash',
    role: ROLES.USER,
    authorStatus: AUTHOR_STATUS.PENDING,
    status: 'ACTIVE',
    profile: {bio: '', avatar: null}
  });

  await assert.rejects(() => create({title: 'My Story', description: 'desc', genres: ['Fantasy']}, user), /Approved author permission is required/);
});

test('approved author can create own story and another author cannot modify it', async () => {
  resetRepositories();
  const authorA = userRepository.create({
    username: 'AuthorA',
    email: 'authora@test.com',
    passwordHash: 'hash',
    role: ROLES.USER,
    authorStatus: AUTHOR_STATUS.APPROVED,
    status: 'ACTIVE',
    profile: {bio: '', avatar: null}
  });
  const authorB = userRepository.create({
    username: 'AuthorB',
    email: 'authorb@test.com',
    passwordHash: 'hash',
    role: ROLES.USER,
    authorStatus: AUTHOR_STATUS.APPROVED,
    status: 'ACTIVE',
    profile: {bio: '', avatar: null}
  });

  creatorRepository.create({userId: authorA.id, displayName: 'Author A', slug: 'author-a', bio: '', description: '', verificationStatus: 'APPROVED', followerCount: 0});
  creatorRepository.create({userId: authorB.id, displayName: 'Author B', slug: 'author-b', bio: '', description: '', verificationStatus: 'APPROVED', followerCount: 0});

  const story = await create({title: 'Story A', description: 'Description', genres: ['Fantasy']}, authorA);
  assert.equal(story.creatorId, authorA.id);

  await assert.rejects(() => update(story.id, {title: 'Hack'}, authorB), /You do not own this story/);
});
