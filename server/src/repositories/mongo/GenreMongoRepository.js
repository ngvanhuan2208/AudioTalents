const Genre = require('../../models/Genre');
const {MongooseRepository} = require('../base/MongooseRepository');
const {toObjectId} = require('../adapters/objectId');
const {pickDefined, toRuntimeObject} = require('../adapters/persistenceMappers');
const {RepositoryError} = require('../errors/mongoErrorMapper');
const {normalizeSlug, executeContentOperation} = require('./contentRepositoryHelpers');

function mapGenreInput(input) {
  const persistence = pickDefined(input, ['name', 'description', 'icon', 'isActive', 'sortOrder']);
  if (input?.slug !== undefined) persistence.slug = normalizeSlug(input.slug);
  return persistence;
}

class GenreMongoRepository extends MongooseRepository {
  constructor(model = Genre) { super(model); }

  async findById(id) {
    return executeContentOperation(async () => toRuntimeObject(await this.model.findById(toObjectId(id)).lean().exec()));
  }

  async findBySlug(slug) {
    return executeContentOperation(async () => toRuntimeObject(await this.model.findOne({slug: normalizeSlug(slug)}).lean().exec()));
  }

  async listActive() {
    return executeContentOperation(async () => (await this.model.find({isActive: true}).sort({sortOrder: 1, name: 1}).lean().exec()).map(toRuntimeObject));
  }

  async listAll() {
    return executeContentOperation(async () => (await this.model.find({}).sort({sortOrder: 1, name: 1}).lean().exec()).map(toRuntimeObject));
  }

  async createGenre(input) {
    return executeContentOperation(async () => toRuntimeObject(await this.model.create(mapGenreInput(input))), 'GENRE_SLUG_EXISTS');
  }

  async updateGenre(id, input) {
    const update = mapGenreInput(input);
    return this.#update(id, update, 'GENRE_SLUG_EXISTS');
  }

  async setActive(id, isActive) {
    return this.#update(id, {isActive: Boolean(isActive)});
  }

  async #update(id, update, duplicateCode) {
    if (Object.keys(update).length === 0) throw new RepositoryError('Genre update requires allowed fields', {code: 'EMPTY_UPDATE', status: 422});
    return executeContentOperation(async () => toRuntimeObject(await this.model.findByIdAndUpdate(
      toObjectId(id), {$set: update}, {returnDocument: 'after', runValidators: true}
    ).lean().exec()), duplicateCode);
  }
}

module.exports = {GenreMongoRepository, mapGenreInput};
