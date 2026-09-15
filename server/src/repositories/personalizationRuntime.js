const {LibraryItemMongoRepository} = require('./mongo/LibraryItemMongoRepository');
const {ListenHistoryMongoRepository} = require('./mongo/ListenHistoryMongoRepository');
const {PlaylistMongoRepository} = require('./mongo/PlaylistMongoRepository');

function createProductionPersonalizationRepositories() {
  return {
    libraryItem: new LibraryItemMongoRepository(),
    listenHistory: new ListenHistoryMongoRepository(),
    playlist: new PlaylistMongoRepository(),
    runtime: 'MONGO',
  };
}

let activeRepositories = createProductionPersonalizationRepositories();
function getPersonalizationRepositories() { return activeRepositories; }
function configurePersonalizationRepositoriesForTests(repositories) {
  if (!repositories?.libraryItem || !repositories?.listenHistory || !repositories?.playlist) {
    throw new Error('All Personalization repositories are required');
  }
  activeRepositories = repositories;
}
function resetPersonalizationRepositoriesToProduction() { activeRepositories = createProductionPersonalizationRepositories(); }

module.exports = {
  createProductionPersonalizationRepositories,
  getPersonalizationRepositories,
  configurePersonalizationRepositoriesForTests,
  resetPersonalizationRepositoriesToProduction,
};
