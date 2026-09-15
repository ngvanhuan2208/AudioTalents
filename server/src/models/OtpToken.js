const mongoose = require('mongoose');

const PURPOSES = Object.freeze({
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  PASSWORD_RESET: 'PASSWORD_RESET',
});

const OtpTokenSchema = new mongoose.Schema(
  {
    userId: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    email: {type: String, required: true, trim: true, lowercase: true},
    codeHash: {type: String, required: true, select: false},
    purpose: {type: String, required: true, enum: Object.values(PURPOSES)},
    expiresAt: {type: Date, required: true},
    attempts: {type: Number, required: true, default: 0, min: 0},
    maxAttempts: {type: Number, required: true, default: 5, min: 1},
    usedAt: {type: Date, default: null},
    invalidatedAt: {type: Date, default: null},
  },
  {timestamps: true}
);

OtpTokenSchema.index({expiresAt: 1}, {expireAfterSeconds: 0});
OtpTokenSchema.index({userId: 1, purpose: 1});
OtpTokenSchema.index({email: 1, purpose: 1});

const OtpToken = mongoose.models.OtpToken || mongoose.model('OtpToken', OtpTokenSchema);

module.exports = OtpToken;
