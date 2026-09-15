const {InMemoryRepository} = require('./InMemoryRepository');
class CommunityRepository extends InMemoryRepository {
  findByStory(storyId, type) { return this.findMany(item => item.storyId === storyId && item.type === type); }
  findRating(userId, storyId) { return this.findOne(item => item.type === 'RATING' && item.userId === userId && item.storyId === storyId); }
}
const communityRepository = new CommunityRepository();
module.exports = {communityRepository};
