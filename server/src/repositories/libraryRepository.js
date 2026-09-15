const {InMemoryRepository} = require('./InMemoryRepository');

class LibraryRepository extends InMemoryRepository {
  findByUserAndStory(userId, storyId, type) { return this.findOne(item => item.userId === userId && item.storyId === storyId && item.type === type); }
  findByUser(userId, type) { return this.findMany(item => item.userId === userId && (!type || item.type === type)); }
}

const libraryRepository = new LibraryRepository();
module.exports = {LibraryRepository, libraryRepository};
