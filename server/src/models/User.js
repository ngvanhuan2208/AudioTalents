const mongoose = require('mongoose');
const {ROLES, AUTHOR_STATUS, ACCOUNT_STATUS} = require('../constants/roles');

const PROTECTED_FIELDS = Object.freeze([
  'role',
  'authorStatus',
  'accountStatus',
  'emailVerified',
  'tokenVersion',
  'passwordHash',
]);

const UserSchema = new mongoose.Schema(
  {
    username: {type: String, required: true, trim: true},
    email: {type: String, required: true, trim: true, lowercase: true},
    passwordHash: {type: String, required: true, select: false},
    role: {type: String, required: true, enum: Object.values(ROLES), default: ROLES.USER},
    authorStatus: {type: String, enum: Object.values(AUTHOR_STATUS), default: AUTHOR_STATUS.NONE},
    accountStatus: {type: String, enum: Object.values(ACCOUNT_STATUS), default: ACCOUNT_STATUS.ACTIVE},
    emailVerified: {type: Boolean, default: false},
    tokenVersion: {type: Number, default: 0, min: 0},
    profile: {
      bio: {type: String, default: ''},
      avatar: {type: String, default: null},
    },
    lastLoginAt: {type: Date, default: null},
  },
  {timestamps: true}
);

UserSchema.index({email: 1}, {unique: true});
UserSchema.statics.PROTECTED_FIELDS = PROTECTED_FIELDS;

const User = mongoose.models.User || mongoose.model('User', UserSchema);

module.exports = User;
