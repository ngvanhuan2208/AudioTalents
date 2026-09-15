const {InMemoryRepository} = require('./InMemoryRepository');
class CreatorRepository extends InMemoryRepository {
  findByUserId(userId) { return this.findOne(creator => creator.userId === userId); }
  findBySlug(slug) { return this.findOne(creator => creator.slug === slug); }
}
const creatorRepository = new CreatorRepository();
module.exports = {CreatorRepository, creatorRepository};
