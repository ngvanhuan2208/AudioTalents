const mongoose = require('mongoose');

const NOTIFICATION_TYPES = Object.freeze([
  'AUTHOR_APPLICATION_APPROVED',
  'AUTHOR_APPLICATION_REJECTED',
  'STORY_APPROVED',
  'STORY_REJECTED',
  'STORY_REVISION_REQUIRED',
  'CHAPTER_APPROVED',
  'CHAPTER_REJECTED',
  'AUDIO_APPROVED',
  'AUDIO_REJECTED',
  'NEW_CHAPTER',
  'SYSTEM',
]);
const TARGET_TYPES = Object.freeze(['STORY', 'CHAPTER', 'AUDIO', 'AUTHOR_APPLICATION', 'SYSTEM']);

const NotificationSchema = new mongoose.Schema(
  {
    userId: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    type: {type: String, required: true, enum: NOTIFICATION_TYPES},
    title: {type: String, required: true},
    message: {type: String, required: true},
    targetType: {type: String, required: true, enum: TARGET_TYPES},
    targetId: {type: mongoose.Schema.Types.ObjectId, default: null},
    isRead: {type: Boolean, default: false},
    readAt: {type: Date, default: null},
  },
  {timestamps: true}
);

NotificationSchema.index({userId: 1, createdAt: -1});
NotificationSchema.index({userId: 1, isRead: 1});

// targetType/targetId is polymorphic. Services resolve and verify targets;
// SYSTEM may intentionally have targetId=null.
const Notification = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);

module.exports = Notification;
