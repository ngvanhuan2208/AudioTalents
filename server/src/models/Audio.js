const mongoose = require('mongoose');

const SOURCE_TYPES = Object.freeze(['HUMAN', 'AI', 'HYBRID']);
const PROCESSING_STATUS = Object.freeze(['PENDING', 'PROCESSING', 'READY', 'FAILED']);
const MODERATION_STATUS = Object.freeze(['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED']);

const AudioSchema = new mongoose.Schema(
  {
    storyId: {type: mongoose.Schema.Types.ObjectId, ref: 'Story', required: true},
    chapterId: {type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', required: true},
    creatorId: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    title: {type: String, required: true, trim: true},
    // Optional until the explicit legacy backfill is completed. New Audio
    // records are always assigned a positive chapter-local part number by the
    // service; the partial unique index protects migrated records meanwhile.
    partNumber: {type: Number, min: 1},
    audioUrl: {type: String, required: true, trim: true},
    storageKey: {type: String, default: null},
    durationSec: {type: Number, default: null, min: 0},
    fileSize: {type: Number, default: null, min: 0},
    mimeType: {type: String, default: null},
    bitrate: {type: Number, default: null, min: 0},
    voiceType: {type: String, default: null},
    transcript: {type: String, default: ''},
    sourceType: {type: String, required: true, enum: SOURCE_TYPES, default: 'HUMAN'},
    processingStatus: {type: String, required: true, enum: PROCESSING_STATUS, default: 'PENDING'},
    status: {type: String, required: true, enum: MODERATION_STATUS, default: 'DRAFT'},
    isPrimary: {type: Boolean, default: false},
    deletedAt: {type: Date, default: null},
    deletedBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null},
  },
  {timestamps: true}
);

AudioSchema.index({chapterId: 1});
AudioSchema.index({creatorId: 1, status: 1});
AudioSchema.index({chapterId: 1, status: 1, processingStatus: 1, isPrimary: 1});
AudioSchema.index(
  {chapterId: 1, isPrimary: 1},
  {unique: true, partialFilterExpression: {isPrimary: true, deletedAt: null}}
);
AudioSchema.index(
  {chapterId: 1, partNumber: 1},
  {unique: true, partialFilterExpression: {partNumber: {$type: 'number'}}}
);

// Local filters only. Repositories/services must also require a public parent
// Chapter and Story, and own primary-audio transitions and soft-delete order.
AudioSchema.statics.PUBLIC_FILTER = Object.freeze({
  status: 'APPROVED',
  processingStatus: 'READY',
  deletedAt: null,
});
AudioSchema.statics.DEFAULT_PLAYBACK_FILTER = Object.freeze({
  ...AudioSchema.statics.PUBLIC_FILTER,
  isPrimary: true,
});

const Audio = mongoose.models.Audio || mongoose.model('Audio', AudioSchema);

module.exports = Audio;
