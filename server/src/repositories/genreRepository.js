const {InMemoryRepository} = require('./InMemoryRepository');

class GenreRepository extends InMemoryRepository {
  findBySlug(slug) { return this.findOne(genre => genre.slug === slug); }
}

const genreRepository = new GenreRepository();
module.exports = {GenreRepository, genreRepository};
