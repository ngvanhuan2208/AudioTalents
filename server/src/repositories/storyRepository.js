const {InMemoryRepository} = require('./InMemoryRepository');

class StoryRepository extends InMemoryRepository {
  findBySlug(slug) { return this.findOne(story => story.slug === slug); }
  findByCreator(creatorId) { return this.findMany(story => story.creatorId === creatorId); }
}

const storyRepository = new StoryRepository();
module.exports = {StoryRepository, storyRepository};
