const Tag = require('../../models/Tag');
const {MongooseRepository} = require('../base/MongooseRepository');
const {pickDefined, toRuntimeObject} = require('../adapters/persistenceMappers');
const {RepositoryError} = require('../errors/mongoErrorMapper');
const {normalizeSlug, executeContentOperation} = require('./contentRepositoryHelpers');

const normalizeName = value => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
const mapTagInput = input => {
  const name = String(input?.name || '').trim().replace(/\s+/g, ' ');
  const update = pickDefined({name, normalizedName: normalizeName(name), slug: normalizeSlug(input?.slug || name)}, ['name', 'normalizedName', 'slug', 'isActive']);
  return update;
};

class TagMongoRepository extends MongooseRepository {
  constructor(model = Tag) { super(model); }
  async findById(id) { return executeContentOperation(async () => toRuntimeObject(await this.model.findById(id).lean().exec())); }
  async findBySlug(slug) { return executeContentOperation(async () => toRuntimeObject(await this.model.findOne({slug: normalizeSlug(slug)}).lean().exec())); }
  async findByNormalizedName(name) { return executeContentOperation(async () => toRuntimeObject(await this.model.findOne({normalizedName: normalizeName(name)}).lean().exec())); }
  async listActive() { return executeContentOperation(async () => (await this.model.find({isActive: true}).sort({name: 1}).lean().exec()).map(toRuntimeObject)); }
  async listAll() { return executeContentOperation(async () => (await this.model.find({}).sort({name: 1}).lean().exec()).map(toRuntimeObject)); }
  async createTag(input) { return executeContentOperation(async () => toRuntimeObject(await this.model.create(mapTagInput(input))), 'TAG_EXISTS'); }
  async updateTag(id, input) { const update = mapTagInput(input); if (!Object.keys(update).length) throw new RepositoryError('Tag update requires allowed fields', {code: 'EMPTY_UPDATE', status: 422}); return executeContentOperation(async () => toRuntimeObject(await this.model.findByIdAndUpdate(id, {$set: update}, {returnDocument: 'after', runValidators: true}).lean().exec()), 'TAG_EXISTS'); }
  async setActive(id, isActive) { return executeContentOperation(async () => toRuntimeObject(await this.model.findByIdAndUpdate(id, {$set: {isActive: Boolean(isActive)}}, {returnDocument: 'after', runValidators: true}).lean().exec())); }
}

module.exports = {TagMongoRepository, mapTagInput, normalizeName};
