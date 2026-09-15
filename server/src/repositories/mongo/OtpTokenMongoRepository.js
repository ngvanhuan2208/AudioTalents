const OtpToken = require('../../models/OtpToken');
const {MongooseRepository} = require('../base/MongooseRepository');
const {toObjectId} = require('../adapters/objectId');
const {pickDefined, toRuntimeObject} = require('../adapters/persistenceMappers');
const {executeIdentityOperation, normalizeEmail} = require('./identityRepositoryHelpers');

function toOtpRuntime(document, {includeCodeHash = false} = {}) {
  const runtime = toRuntimeObject(document);
  if (runtime && !includeCodeHash) delete runtime.codeHash;
  return runtime;
}

class OtpTokenMongoRepository extends MongooseRepository {
  constructor(model = OtpToken) {
    super(model);
  }

  async createOtp(input) {
    const persistence = pickDefined(input, ['codeHash', 'purpose', 'expiresAt', 'attempts', 'maxAttempts']);
    persistence.userId = toObjectId(input?.userId, 'userId');
    persistence.email = normalizeEmail(input?.email);
    return executeIdentityOperation(async () => toOtpRuntime(await this.model.create(persistence)));
  }

  async findActiveByUserAndPurpose(userId, purpose) {
    return executeIdentityOperation(async () => {
      const document = await this.model.findOne({
        userId: toObjectId(userId, 'userId'), purpose, usedAt: null, invalidatedAt: null,
      }).sort({createdAt: -1}).lean().exec();
      return toOtpRuntime(document);
    });
  }

  async findLatestForVerification(userId, purpose) {
    return executeIdentityOperation(async () => {
      const document = await this.model.findOne({userId: toObjectId(userId, 'userId'), purpose})
        .sort({createdAt: -1}).select('+codeHash').lean().exec();
      return toOtpRuntime(document, {includeCodeHash: true});
    });
  }

  async invalidateActive(userId, purpose, invalidatedAt = new Date()) {
    return executeIdentityOperation(() => this.model.updateMany(
      {userId: toObjectId(userId, 'userId'), purpose, usedAt: null, invalidatedAt: null},
      {$set: {invalidatedAt}}
    ));
  }

  async incrementAttempts(tokenId) {
    return this.#findOneAndUpdate(tokenId, {$inc: {attempts: 1}});
  }

  async markUsed(tokenId, usedAt = new Date()) {
    return this.#findOneAndUpdate(tokenId, {$set: {usedAt}});
  }

  async deleteIssuedOtp(tokenId) {
    return executeIdentityOperation(async () => {
      const result = await this.model.deleteOne({_id: toObjectId(tokenId, 'tokenId')}).exec();
      return result.deletedCount === 1;
    });
  }

  async #findOneAndUpdate(tokenId, update) {
    return executeIdentityOperation(async () => {
      const document = await this.model.findByIdAndUpdate(
        toObjectId(tokenId, 'tokenId'), update, {returnDocument: 'after', runValidators: true}
      ).select('+codeHash').lean().exec();
      return toOtpRuntime(document, {includeCodeHash: true});
    });
  }
}

module.exports = {OtpTokenMongoRepository};
