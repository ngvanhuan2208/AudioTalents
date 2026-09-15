const {Repository} = require('./Repository');
const {toObjectId} = require('../adapters/objectId');
const {toRuntimeObject, buildEqualityFilter, buildSetUpdate} = require('../adapters/persistenceMappers');
const {mapMongoError} = require('../errors/mongoErrorMapper');

class MongooseRepository extends Repository {
  constructor(model) {
    super();
    if (!model) throw new Error('MongooseRepository requires a model');
    this.model = model;
  }

  async findById(id) {
    try {
      const document = await this.model.findById(toObjectId(id)).lean().exec();
      return toRuntimeObject(document);
    } catch (error) {
      throw mapMongoError(error);
    }
  }

  async findOne(filter, allowedFields) {
    try {
      const document = await this.model.findOne(buildEqualityFilter(filter, allowedFields)).lean().exec();
      return toRuntimeObject(document);
    } catch (error) {
      throw mapMongoError(error);
    }
  }

  async findMany(filter, allowedFields) {
    try {
      const documents = await this.model.find(buildEqualityFilter(filter, allowedFields)).lean().exec();
      return documents.map(toRuntimeObject);
    } catch (error) {
      throw mapMongoError(error);
    }
  }

  async exists(filter, allowedFields) {
    try {
      return Boolean(await this.model.exists(buildEqualityFilter(filter, allowedFields)));
    } catch (error) {
      throw mapMongoError(error);
    }
  }

  // Write primitives are intentionally not wired to any domain service in Phase 3.3.
  async create(persistenceObject) {
    try {
      return toRuntimeObject(await this.model.create(persistenceObject));
    } catch (error) {
      throw mapMongoError(error);
    }
  }

  async updateById(id, input, allowedFields) {
    try {
      const document = await this.model.findByIdAndUpdate(
        toObjectId(id), buildSetUpdate(input, allowedFields), {returnDocument: 'after', runValidators: true}
      ).lean().exec();
      return toRuntimeObject(document);
    } catch (error) {
      throw mapMongoError(error);
    }
  }
}

module.exports = {MongooseRepository};
