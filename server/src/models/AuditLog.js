const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    actorId: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    action: {type: String, required: true},
    targetType: {type: String, required: true},
    targetId: {type: mongoose.Schema.Types.ObjectId, required: true},
    metadata: {type: mongoose.Schema.Types.Mixed, default: () => ({})},
    ipAddress: {type: String, default: null},
    userAgent: {type: String, default: null},
  },
  {timestamps: {createdAt: true, updatedAt: false}}
);

AuditLogSchema.index({actorId: 1, createdAt: -1});
AuditLogSchema.index({targetType: 1, targetId: 1});

// AuditLog is append-only by service/repository policy. This schema deliberately
// contains no mutable status, soft-delete fields, hooks, or update/delete APIs.
const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);

module.exports = AuditLog;
