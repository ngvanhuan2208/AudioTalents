const mongoose = require('mongoose');

const STORY_PROGRESS = Object.freeze(['ONGOING', 'COMPLETED', 'PAUSED']);
const MODERATION_STATUS = Object.freeze(['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED']);
const VISIBILITY = Object.freeze(['PRIVATE', 'PUBLIC', 'UNLISTED']);

const StorySchema = new mongoose.Schema(
  {
    creatorId: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    title: {type: String, required: true, trim: true},
    slug: {type: String, required: true, trim: true, lowercase: true},
    description: {type: String, required: true},
    coverUrl: {type: String, default: null},
    genreIds: {type: [{type: mongoose.Schema.Types.ObjectId, ref: 'Genre'}], default: []},
    tags: {type: [{type: String, trim: true}], default: []},
    status: {type: String, required: true, enum: STORY_PROGRESS, default: 'ONGOING'},
    reviewStatus: {type: String, required: true, enum: MODERATION_STATUS, default: 'DRAFT'},
    visibility: {type: String, required: true, enum: VISIBILITY, default: 'PRIVATE'},
    chapterCount: {type: Number, default: 0, min: 0},
    viewCount: {type: Number, default: 0, min: 0},
    listenCount: {type: Number, default: 0, min: 0},
    favoriteCount: {type: Number, default: 0, min: 0},
    ratingAverage: {type: Number, default: 0, min: 0, max: 5},
    ratingCount: {type: Number, default: 0, min: 0},
    submittedAt: {type: Date, default: null},
    reviewedBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null},
    reviewedAt: {type: Date, default: null},
    moderationNote: {type: String, default: ''},
    publishedAt: {type: Date, default: null},
    deletedAt: {type: Date, default: null},
    deletedBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null},
  },
  {timestamps: true}
);

StorySchema.index({slug: 1}, {unique: true});
StorySchema.index({creatorId: 1});
StorySchema.index({genreIds: 1});
StorySchema.index({reviewStatus: 1, publishedAt: -1});
StorySchema.index({createdAt: -1});
StorySchema.index({title: 'text', description: 'text'});

// This is a local-document filter. Repositories/services also enforce the
// required parent-chain visibility rules for Chapters and Audio.
StorySchema.statics.PUBLIC_FILTER = Object.freeze({
  reviewStatus: 'APPROVED',
  visibility: 'PUBLIC',
  deletedAt: null,
});

const Story = mongoose.models.Story || mongoose.model('Story', StorySchema);

module.exports = Story;
