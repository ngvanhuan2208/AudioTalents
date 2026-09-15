const mongoose = require('mongoose');

const ListenHistorySchema = new mongoose.Schema(
  {
    userId: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    storyId: {type: mongoose.Schema.Types.ObjectId, ref: 'Story', required: true},
    chapterId: {type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', required: true},
    audioId: {type: mongoose.Schema.Types.ObjectId, ref: 'Audio', required: true},
    positionSec: {type: Number, default: 0, min: 0},
    durationSec: {type: Number, default: null, min: 0},
    progressPercent: {type: Number, default: 0, min: 0, max: 100},
    completed: {type: Boolean, default: false},
    lastListenedAt: {type: Date, required: true, default: Date.now},
  },
  {timestamps: true}
);

ListenHistorySchema.index({userId: 1, chapterId: 1}, {unique: true});
ListenHistorySchema.index({userId: 1, storyId: 1, lastListenedAt: -1});

// These references are local shape validation only. The repository/service
// verifies Chapter.storyId and Audio's Story/Chapter chain before persistence.
const ListenHistory = mongoose.models.ListenHistory || mongoose.model('ListenHistory', ListenHistorySchema);

module.exports = ListenHistory;
