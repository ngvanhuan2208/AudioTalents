const mongoose = require('mongoose');

const TARGET_TYPES = Object.freeze(['STORY', 'CHAPTER', 'AUDIO', 'COMMENT', 'USER']);
const REPORT_TYPES = Object.freeze([
  'AUDIO_BROKEN',
  'AUDIO_NOISE',
  'MISSING_CONTENT',
  'DUPLICATE_CHAPTER',
  'WRONG_CONTENT',
  'COPYRIGHT',
  'ABUSE',
  'OTHER',
]);
const REPORT_STATUS = Object.freeze(['OPEN', 'REVIEWING', 'RESOLVED', 'REJECTED']);

const ReportSchema = new mongoose.Schema(
  {
    reporterId: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    targetType: {type: String, required: true, enum: TARGET_TYPES},
    targetId: {type: mongoose.Schema.Types.ObjectId, required: true},
    reportType: {type: String, required: true, enum: REPORT_TYPES},
    description: {type: String, default: ''},
    status: {type: String, required: true, enum: REPORT_STATUS, default: 'OPEN'},
    reviewedBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null},
    reviewedAt: {type: Date, default: null},
    resolutionNote: {type: String, default: null},
  },
  {timestamps: true}
);

ReportSchema.index({status: 1, createdAt: -1});
ReportSchema.index({targetType: 1, targetId: 1});

// targetType controls which model a future repository/service resolves before
// writing. The schema deliberately has no polymorphic lookup or state hook.
const Report = mongoose.models.Report || mongoose.model('Report', ReportSchema);

module.exports = Report;
