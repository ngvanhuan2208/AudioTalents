const {Repository} = require('./base/Repository');
const {MongooseRepository} = require('./base/MongooseRepository');
const mappers = require('./adapters/persistenceMappers');
const objectId = require('./adapters/objectId');
const transcript = require('./adapters/transcript');
const errors = require('./errors/mongoErrorMapper');
const {UserMongoRepository} = require('./mongo/UserMongoRepository');
const {OtpTokenMongoRepository} = require('./mongo/OtpTokenMongoRepository');
const {AuthorApplicationMongoRepository} = require('./mongo/AuthorApplicationMongoRepository');
const {GenreMongoRepository} = require('./mongo/GenreMongoRepository');
const {TagMongoRepository} = require('./mongo/TagMongoRepository');
const {TaxonomyProposalMongoRepository} = require('./mongo/TaxonomyProposalMongoRepository');
const {StoryMongoRepository} = require('./mongo/StoryMongoRepository');
const {ChapterMongoRepository} = require('./mongo/ChapterMongoRepository');
const {AudioMongoRepository} = require('./mongo/AudioMongoRepository');
const {LibraryItemMongoRepository} = require('./mongo/LibraryItemMongoRepository');
const {ListenHistoryMongoRepository} = require('./mongo/ListenHistoryMongoRepository');
const {PlaylistMongoRepository} = require('./mongo/PlaylistMongoRepository');
const {NotificationMongoRepository} = require('./mongo/NotificationMongoRepository');
const {CommentMongoRepository} = require('./mongo/CommentMongoRepository');
const {RatingMongoRepository} = require('./mongo/RatingMongoRepository');
const {ReportMongoRepository} = require('./mongo/ReportMongoRepository');
const {AuditLogMongoRepository} = require('./mongo/AuditLogMongoRepository');

const identityRuntime = require('./identityRuntime');
const contentRuntime = require('./contentRuntime');
const personalizationRuntime = require('./personalizationRuntime');
const communityRuntime = require('./communityRuntime');
const auditRuntime = require('./auditRuntime');

const CURRENT_REPOSITORY_RUNTIME = 'MONGO_IDENTITY_CONTENT_PERSONALIZATION_COMMUNITY_AND_AUDIT';

function selectCurrentRepository() {
  return identityRuntime.getIdentityRepositories();
}

module.exports = {
  CURRENT_REPOSITORY_RUNTIME,
  selectCurrentRepository,
  Repository,
  MongooseRepository,
  UserMongoRepository,
  OtpTokenMongoRepository,
  AuthorApplicationMongoRepository,
  GenreMongoRepository,
  TagMongoRepository,
  TaxonomyProposalMongoRepository,
  StoryMongoRepository,
  ChapterMongoRepository,
  AudioMongoRepository,
  LibraryItemMongoRepository,
  ListenHistoryMongoRepository,
  PlaylistMongoRepository,
  NotificationMongoRepository,
  CommentMongoRepository,
  RatingMongoRepository,
  ReportMongoRepository,
  AuditLogMongoRepository,
  ...identityRuntime,
  ...contentRuntime,
  ...personalizationRuntime,
  ...communityRuntime,
  ...auditRuntime,
  ...mappers,
  ...objectId,
  ...transcript,
  ...errors,
};
