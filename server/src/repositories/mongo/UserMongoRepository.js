const User = require('../../models/User');
const {MongooseRepository} = require('../base/MongooseRepository');
const {toObjectId} = require('../adapters/objectId');
const {toRuntimeObject, mapUserRuntimeToPersistence} = require('../adapters/persistenceMappers');
const {executeIdentityOperation, normalizeEmail} = require('./identityRepositoryHelpers');
const {ROLES, AUTHOR_STATUS, ACCOUNT_STATUS} = require('../../constants/roles');

function toUserRuntime(document, {includePasswordHash = false} = {}) {
  const runtime = toRuntimeObject(document);
  if (runtime && !includePasswordHash) delete runtime.passwordHash;
  return runtime;
}

class UserMongoRepository extends MongooseRepository {
  constructor(model = User) {
    super(model);
  }

  async findById(id) {
    return executeIdentityOperation(async () => {
      const document = await this.model.findById(toObjectId(id)).lean().exec();
      return toUserRuntime(document);
    });
  }

  async findByEmail(email) {
    return executeIdentityOperation(async () => {
      const document = await this.model.findOne({email: normalizeEmail(email)}).lean().exec();
      return toUserRuntime(document);
    });
  }

  async findForAuthenticationByEmail(email) {
    return executeIdentityOperation(async () => {
      const document = await this.model.findOne({email: normalizeEmail(email)}).select('+passwordHash').lean().exec();
      return toUserRuntime(document, {includePasswordHash: true});
    });
  }

  async createRegisteredUser(input) {
    const persistence = {
      ...mapUserRuntimeToPersistence(input),
      role: ROLES.USER,
      authorStatus: AUTHOR_STATUS.NONE,
      accountStatus: ACCOUNT_STATUS.ACTIVE,
      emailVerified: false,
      tokenVersion: 0,
    };
    persistence.email = normalizeEmail(persistence.email);
    return executeIdentityOperation(async () => toUserRuntime(await this.model.create(persistence)), 'EMAIL_ALREADY_REGISTERED');
  }

  async updateProfile(id, input) {
    const update = mapUserRuntimeToPersistence(input);
    delete update.email;
    delete update.passwordHash;
    return this.#findOneAndUpdate(id, {$set: update});
  }

  async incrementTokenVersion(id) {
    return this.#findOneAndUpdate(id, {$inc: {tokenVersion: 1}});
  }

  async setPasswordHashAndIncrementTokenVersion(id, passwordHash) {
    return this.#findOneAndUpdate(id, {$set: {passwordHash}, $inc: {tokenVersion: 1}});
  }

  async removeUnverifiedUser(id) {
    return executeIdentityOperation(async () => {
      const result = await this.model.deleteOne({_id: toObjectId(id), emailVerified: false}).exec();
      return result.deletedCount === 1;
    });
  }

  async setEmailVerified(id, emailVerified = true) {
    return this.#findOneAndUpdate(id, {$set: {emailVerified: Boolean(emailVerified)}});
  }

  async setAccountStatus(id, accountStatus) {
    if (!Object.values(ACCOUNT_STATUS).includes(accountStatus)) throw new Error('Invalid account status');
    return this.#findOneAndUpdate(id, {$set: {accountStatus}});
  }

  async setAuthorStatus(id, authorStatus) {
    if (!Object.values(AUTHOR_STATUS).includes(authorStatus)) throw new Error('Invalid author status');
    return this.#findOneAndUpdate(id, {$set: {authorStatus}});
  }

  async setLastLoginAt(id, lastLoginAt = new Date()) {
    return this.#findOneAndUpdate(id, {$set: {lastLoginAt}});
  }

  async #findOneAndUpdate(id, update) {
    return executeIdentityOperation(async () => {
      const document = await this.model.findByIdAndUpdate(
        toObjectId(id), update, {returnDocument: 'after', runValidators: true}
      ).lean().exec();
      return toUserRuntime(document);
    });
  }
}

module.exports = {UserMongoRepository};
