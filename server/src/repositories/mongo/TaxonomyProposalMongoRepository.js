const TaxonomyProposal = require('../../models/TaxonomyProposal');
const {MongooseRepository} = require('../base/MongooseRepository');
const {toObjectId} = require('../adapters/objectId');
const {pickDefined, toRuntimeObject} = require('../adapters/persistenceMappers');
const {executeContentOperation} = require('./contentRepositoryHelpers');

const mapInput = input => {
  const result = pickDefined(input, ['type', 'proposedName', 'normalizedName', 'reason', 'proposerId', 'storyId', 'status', 'reviewedBy', 'reviewedAt', 'reviewNote', 'resolvedTaxonomyId']);
  for (const field of ['proposerId', 'storyId', 'reviewedBy', 'resolvedTaxonomyId']) if (result[field] !== undefined && result[field] !== null) result[field] = toObjectId(result[field], field);
  return result;
};

class TaxonomyProposalMongoRepository extends MongooseRepository {
  constructor(model = TaxonomyProposal) { super(model); }
  async findById(id) { return executeContentOperation(async () => toRuntimeObject(await this.model.findById(toObjectId(id)).lean().exec())); }
  async list(filter = {}) { const query = {...filter}; for (const field of ['storyId', 'proposerId']) if (query[field] !== undefined) query[field] = toObjectId(query[field], field); return executeContentOperation(async () => (await this.model.find(query).sort({createdAt: -1}).lean().exec()).map(toRuntimeObject)); }
  async createProposal(input) { return executeContentOperation(async () => toRuntimeObject(await this.model.create(mapInput(input)))); }
  async review(id, snapshot, update) { return executeContentOperation(async () => toRuntimeObject(await this.model.findOneAndUpdate({...snapshot, _id: toObjectId(id)}, {$set: mapInput(update)}, {returnDocument: 'after', runValidators: true}).lean().exec())); }
}

module.exports = {TaxonomyProposalMongoRepository, mapInput};
