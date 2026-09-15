const {InMemoryRepository} = require('./InMemoryRepository');
class PlaylistRepository extends InMemoryRepository {
  findByUser(userId) { return this.findMany(item => item.userId === userId); }
}
const playlistRepository = new PlaylistRepository();
module.exports = {playlistRepository};
