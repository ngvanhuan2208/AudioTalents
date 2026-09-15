const mongoose = require('mongoose');

const APPLICATION_STATUSES = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
});

const AuthorApplicationSchema = new mongoose.Schema(
  {
    userId: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    displayName: {type: String, required: true, trim: true},
    bio: {type: String, required: true, trim: true},
    contentTypes: {type: [String], default: []},
    experience: {type: String, default: ''},
    status: {type: String, required: true, enum: Object.values(APPLICATION_STATUSES), default: APPLICATION_STATUSES.PENDING},
    submittedAt: {type: Date, required: true, default: Date.now},
    reviewedAt: {type: Date, default: null},
    reviewedBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null},
    reviewNote: {type: String, default: ''},
  },
  {timestamps: true}
);

AuthorApplicationSchema.index(
  {userId: 1},
  {unique: true, partialFilterExpression: {status: APPLICATION_STATUSES.PENDING}}
);
AuthorApplicationSchema.index({createdAt: -1});

AuthorApplicationSchema.statics.hasPendingApplication = function hasPendingApplication(userId) {
  return this.exists({userId, status: APPLICATION_STATUSES.PENDING});
};

const AuthorApplication = mongoose.models.AuthorApplication
  || mongoose.model('AuthorApplication', AuthorApplicationSchema);

module.exports = AuthorApplication;
