const Rating = require('../../models/Rating');
const {MongooseRepository} = require('../base/MongooseRepository');
const {toObjectId} = require('../adapters/objectId');
const {toRuntimeObject, pickDefined} = require('../adapters/persistenceMappers');
const {RepositoryError} = require('../errors/mongoErrorMapper');
const {executeCommunityOperation} = require('./communityRepositoryHelpers');

function validStars(stars) {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    throw new RepositoryError('stars must be an integer between 1 and 5', {code: 'PERSISTENCE_VALIDATION_ERROR', status: 422, details: {field: 'stars'}});
  }
  return stars;
}

function validReview(review) {
  if (review !== null && review !== undefined && typeof review !== 'string') {
    throw new RepositoryError('review must be a string or null', {code: 'PERSISTENCE_VALIDATION_ERROR', status: 422, details: {field: 'review'}});
  }
  return review;
}

function trustedRating(input) {
  const result = {userId: toObjectId(input?.userId, 'userId'), storyId: toObjectId(input?.storyId, 'storyId'), stars: validStars(input?.stars)};
  if (input?.review !== undefined) result.review = validReview(input.review);
  return result;
}

function trustedRatingUpdate(input) {
  const update = pickDefined(input, ['stars', 'review']);
  if (Object.keys(update).length === 0) throw new RepositoryError('Rating update requires allowed fields', {code: 'EMPTY_UPDATE', status: 422});
  if (update.stars !== undefined) update.stars = validStars(update.stars);
  if (update.review !== undefined) update.review = validReview(update.review);
  return update;
}

class RatingMongoRepository extends MongooseRepository {
  constructor(model = Rating) { super(model); }

  async findById(id) {
    return executeCommunityOperation(async () => toRuntimeObject(await this.model.findById(toObjectId(id)).lean().exec()));
  }

  async findByUserAndStory(userId, storyId) {
    const filter = {userId: toObjectId(userId, 'userId'), storyId: toObjectId(storyId, 'storyId')};
    return executeCommunityOperation(async () => toRuntimeObject(await this.model.findOne(filter).lean().exec()));
  }

  async listByStory(storyId) {
    return executeCommunityOperation(async () => (await this.model.find({storyId: toObjectId(storyId, 'storyId')}).sort({createdAt: -1}).lean().exec()).map(toRuntimeObject));
  }

  async createRating(input) {
    return executeCommunityOperation(
      async () => toRuntimeObject(await this.model.create(trustedRating(input))),
      'RATING_ALREADY_EXISTS'
    );
  }

  async updateRating(id, input) {
    return executeCommunityOperation(async () => toRuntimeObject(await this.model.findByIdAndUpdate(
      toObjectId(id), {$set: trustedRatingUpdate(input)}, {returnDocument: 'after', runValidators: true}
    ).lean().exec()));
  }

  async deleteById(id) {
    return executeCommunityOperation(async () => toRuntimeObject(await this.model.findByIdAndDelete(toObjectId(id)).lean().exec()));
  }

  async aggregateForStory(storyId) {
    const pipeline = [
      {$match: {storyId: toObjectId(storyId, 'storyId')}},
      {$group: {_id: null, ratingCount: {$sum: 1}, ratingAverage: {$avg: '$stars'}}},
    ];
    return executeCommunityOperation(async () => {
      const [aggregate] = await this.model.aggregate(pipeline).exec();
      return aggregate ? {ratingCount: aggregate.ratingCount, ratingAverage: aggregate.ratingAverage} : {ratingCount: 0, ratingAverage: 0};
    });
  }
}

module.exports = {RatingMongoRepository, trustedRating, trustedRatingUpdate, validStars};
