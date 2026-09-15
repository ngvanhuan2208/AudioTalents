const {AuditLogMongoRepository} = require('./mongo/AuditLogMongoRepository');

function createProductionAuditRepositories() {
  return {auditLog: new AuditLogMongoRepository(), runtime: 'MONGO'};
}

let activeRepositories = createProductionAuditRepositories();

function getAuditRepositories() { return activeRepositories; }

// Explicit unit-test injection only. Production has no environment switch,
// InMemory fallback, or dual-persistence path.
function configureAuditRepositoriesForTests(repositories) {
  if (!repositories?.auditLog) throw new Error('An AuditLog repository is required');
  activeRepositories = repositories;
}

function resetAuditRepositoriesToProduction() { activeRepositories = createProductionAuditRepositories(); }

module.exports = {
  createProductionAuditRepositories,
  getAuditRepositories,
  configureAuditRepositoriesForTests,
  resetAuditRepositoriesToProduction,
};
