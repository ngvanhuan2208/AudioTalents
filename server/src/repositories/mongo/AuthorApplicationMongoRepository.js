const AuthorApplication = require('../../models/AuthorApplication');
const {MongooseRepository} = require('../base/MongooseRepository');
const {toObjectId} = require('../adapters/objectId');
const {toRuntimeObject, mapAuthorApplicationRuntimeToPersistence} = require('../adapters/persistenceMappers');
const {executeIdentityOperation} = require('./identityRepositoryHelpers');

const REVIEW_STATUSES = new Set(['APPROVED', 'REJECTED', 'CANCELLED']);

class AuthorApplicationMongoRepository extends MongooseRepository {
  constructor(model = AuthorApplication) {
    super(model);
  }

  async findById(id) {
    return executeIdentityOperation(async () => {
      const document = await this.model.findById(toObjectId(id)).lean().exec();
      return toRuntimeObject(document);
    });
  }

  async findPendingByUserId(userId) {
    return executeIdentityOperation(async () => {
      const document = await this.model.findOne({userId: toObjectId(userId, 'userId'), status: 'PENDING'}).lean().exec();
      return toRuntimeObject(document);
    });
  }

  async findByUserId(userId) {
    return executeIdentityOperation(async () => {
      const document = await this.model.findOne({userId: toObjectId(userId, 'userId')}).sort({createdAt: -1}).lean().exec();
      return toRuntimeObject(document);
    });
  }

  async listPending() {
    return executeIdentityOperation(async () => {
      const documents = await this.model.find({status: 'PENDING'}).sort({createdAt: -1}).lean().exec();
      return documents.map(toRuntimeObject);
    });
  }

  async createPendingApplication(input) {
    const persistence = mapAuthorApplicationRuntimeToPersistence(input);
    persistence.userId = toObjectId(input?.userId, 'userId');
    persistence.status = 'PENDING';
    delete persistence.reviewedAt;
    delete persistence.reviewedBy;
    delete persistence.reviewNote;
    return executeIdentityOperation(async () => toRuntimeObject(await this.model.create(persistence)), 'APPLICATION_ALREADY_PENDING');
  }

  async reviewApplication(id, {status, reviewedBy, reviewedAt = new Date(), reviewNote = ''}) {
    if (!REVIEW_STATUSES.has(status)) throw new Error('Invalid author application review status');
    return executeIdentityOperation(async () => {
      const document = await this.model.findByIdAndUpdate(
        toObjectId(id),
        {$set: {status, reviewedBy: toObjectId(reviewedBy, 'reviewedBy'), reviewedAt, reviewNote}},
        {returnDocument: 'after', runValidators: true}
      ).lean().exec();
      return toRuntimeObject(document);
    });
  }

  async cancelPendingApplication(id, reviewNote = 'Application cancelled after an incomplete submission') {
    return executeIdentityOperation(async () => {
      const document = await this.model.findOneAndUpdate(
        {_id: toObjectId(id), status: 'PENDING'},
        {$set: {status: 'CANCELLED', reviewedAt: new Date(), reviewNote}},
        {returnDocument: 'after', runValidators: true}
      ).lean().exec();
      return toRuntimeObject(document);
    });
  }
}

module.exports = {AuthorApplicationMongoRepository};
