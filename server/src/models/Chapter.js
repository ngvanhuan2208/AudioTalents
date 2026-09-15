const mongoose = require('mongoose');

const MODERATION_STATUS = Object.freeze(['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED']);

const ChapterSchema = new mongoose.Schema(
  {
    storyId: {type: mongoose.Schema.Types.ObjectId, ref: 'Story', required: true},
    creatorId: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    chapterNumber: {type: Number, required: true, min: 1},
    title: {type: String, required: true, trim: true},
    slug: {type: String, required: true, trim: true, lowercase: true},
    textContent: {type: String, default: ''},
    status: {type: String, required: true, enum: MODERATION_STATUS, default: 'DRAFT'},
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

ChapterSchema.index({storyId: 1, chapterNumber: 1}, {unique: true});
ChapterSchema.index({storyId: 1, status: 1});

// This is a local-document filter. A public Chapter also requires a public
// parent Story; repository/service logic owns that cross-document check.
ChapterSchema.statics.PUBLIC_FILTER = Object.freeze({status: 'APPROVED', deletedAt: null});

const Chapter = mongoose.models.Chapter || mongoose.model('Chapter', ChapterSchema);

module.exports = Chapter;
