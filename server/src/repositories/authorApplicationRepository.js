const {InMemoryRepository} = require('./InMemoryRepository');

class AuthorApplicationRepository extends InMemoryRepository {
  findByUserId(userId) { return this.findOne(application => application.userId === userId); }
  findPending() { return this.findMany(application => application.status === 'PENDING'); }
}

const authorApplicationRepository = new AuthorApplicationRepository();
module.exports = {authorApplicationRepository};
