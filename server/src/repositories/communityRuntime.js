const {NotificationMongoRepository} = require('./mongo/NotificationMongoRepository');
const {CommentMongoRepository} = require('./mongo/CommentMongoRepository');
const {RatingMongoRepository} = require('./mongo/RatingMongoRepository');
const {ReportMongoRepository} = require('./mongo/ReportMongoRepository');

function createProductionCommunityRepositories() {
  return {
    notification: new NotificationMongoRepository(),
    comment: new CommentMongoRepository(),
    rating: new RatingMongoRepository(),
    report: new ReportMongoRepository(),
    runtime: 'MONGO',
  };
}

let activeRepositories = createProductionCommunityRepositories();

function getCommunityRepositories() { return activeRepositories; }

// Explicit unit-test injection only. Production never selects an alternate
// provider and has no environment-based fallback.
function configureCommunityRepositoriesForTests(repositories) {
  if (!repositories?.notification || !repositories?.comment || !repositories?.rating || !repositories?.report) {
    throw new Error('All Community repositories are required');
  }
  activeRepositories = repositories;
}

function resetCommunityRepositoriesToProduction() { activeRepositories = createProductionCommunityRepositories(); }

module.exports = {
  createProductionCommunityRepositories,
  getCommunityRepositories,
  configureCommunityRepositoriesForTests,
  resetCommunityRepositoriesToProduction,
};
