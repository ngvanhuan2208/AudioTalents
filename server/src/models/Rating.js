const mongoose = require('mongoose');

const RatingSchema = new mongoose.Schema(
  {
    userId: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    storyId: {type: mongoose.Schema.Types.ObjectId, ref: 'Story', required: true},
    stars: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {validator: Number.isInteger, message: 'stars must be an integer'},
    },
    review: {type: String, default: null},
  },
  {timestamps: true}
);

RatingSchema.index({userId: 1, storyId: 1}, {unique: true});

// Rating services own Story.ratingAverage and Story.ratingCount updates.
const Rating = mongoose.models.Rating || mongoose.model('Rating', RatingSchema);

module.exports = Rating;
