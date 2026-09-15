const {InMemoryRepository} = require('./InMemoryRepository');

class UserRepository extends InMemoryRepository {
  findByEmail(email) { return this.findOne(user => user.email === email.toLowerCase()); }
}

const userRepository = new UserRepository();
module.exports = {UserRepository, userRepository};
