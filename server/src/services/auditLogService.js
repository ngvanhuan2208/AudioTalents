const {getAuditRepositories} = require('../repositories/auditRuntime');

async function record({actorId, action, targetType, targetId, metadata = {}, ipAddress, userAgent}) {
  const entry = {actorId, action, targetType, targetId, metadata};
  if (ipAddress !== undefined) entry.ipAddress = ipAddress;
  if (userAgent !== undefined) entry.userAgent = userAgent;
  return getAuditRepositories().auditLog.append(entry);
}

async function list() {
  const result = await getAuditRepositories().auditLog.listRecent();
  return result.items;
}

module.exports = {auditLogService: {record, list}};
