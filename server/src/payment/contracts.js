const {createHash} = require('node:crypto');
const {AppError} = require('../utils/AppError');

const INTERVAL_MONTHS = Object.freeze({MONTHLY: 1, QUARTERLY: 3, ANNUAL: 12});
const PAYMENT_STATES = Object.freeze(['PENDING', 'PROCESSING', 'UNKNOWN', 'SUCCEEDED', 'FAILED', 'EXPIRED']);
const TRANSITIONS = Object.freeze({
  PENDING: ['PROCESSING', 'UNKNOWN', 'SUCCEEDED', 'FAILED', 'EXPIRED'],
  PROCESSING: ['UNKNOWN', 'SUCCEEDED', 'FAILED', 'EXPIRED'],
  UNKNOWN: ['PROCESSING', 'SUCCEEDED', 'FAILED', 'EXPIRED'],
  SUCCEEDED: [], FAILED: [], EXPIRED: [],
});

function fail(code, message, status = 422) { throw new AppError(message, status, code); }
function requiredText(value, field) {
  if (typeof value !== 'string' || !value.trim()) fail('INVALID_PAYMENT_INPUT', `${field} is required`);
  return value.trim();
}
function id(value) {
  const result = String(value ?? '').toLowerCase();
  if (!/^[a-f0-9]{24}$/.test(result)) fail('INVALID_PAYMENT_INPUT', 'Invalid reference');
  return result;
}
function date(value) {
  const result = new Date(value);
  if (value == null || !Number.isFinite(result.getTime())) fail('INVALID_PAYMENT_INPUT', 'Invalid date');
  return result;
}
function planSnapshot(plan) {
  const code = requiredText(plan.planId, 'planId').toLowerCase();
  const name = requiredText(plan.name, 'name');
  const intervalMonths = INTERVAL_MONTHS[plan.billingPeriod];
  if (!intervalMonths || plan.intervalMonths !== intervalMonths) fail('INVALID_PLAN', 'Billing interval mismatch');
  if (!Number.isSafeInteger(plan.price) || plan.price < 0) fail('INVALID_PLAN', 'Price must be a nonnegative safe integer');
  const currency = requiredText(plan.currency, 'currency').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) fail('INVALID_PLAN', 'Currency must be a three-letter code');
  if (!Array.isArray(plan.entitlementKeys) || !plan.entitlementKeys.length) fail('INVALID_PLAN', 'Entitlements are required');
  const entitlementKeys = [...new Set(plan.entitlementKeys.map(key => requiredText(key, 'entitlement key')))];
  return {code, name, billingPeriod: plan.billingPeriod, intervalMonths, entitlementKeys};
}

// Only server-loaded Plan values supply money and benefits. Never spread request input.
function checkoutRecord(userId, input, plan, subscription = null) {
  if (!plan?.isActive) fail('PLAN_NO_LONGER_AVAILABLE', 'Plan is no longer available', 409);
  const snapshot = planSnapshot(plan);
  if (requiredText(input.planId, 'planId').toLowerCase() !== snapshot.code) fail('INVALID_PLAN', 'Plan mismatch');
  const purpose = input.purpose;
  if (!['NEW_SUBSCRIPTION', 'RENEWAL'].includes(purpose)) fail('INVALID_PAYMENT_INPUT', 'Invalid purpose');
  const subscriptionId = input.subscriptionId == null ? null : id(input.subscriptionId);
  if (purpose === 'NEW_SUBSCRIPTION' && subscriptionId) fail('INVALID_PAYMENT_INPUT', 'New purchase cannot choose a subscription');
  if (purpose === 'RENEWAL') {
    if (!subscriptionId || !subscription || id(subscription._id) !== subscriptionId || id(subscription.userId) !== id(userId)) {
      fail('SUBSCRIPTION_NOT_FOUND', 'Subscription not found', 404);
    }
    if (subscription.planId !== snapshot.code) fail('PLAN_SWITCH_NOT_SUPPORTED', 'Renewal must use the current plan', 409);
    if (subscription.status === 'CANCELED') fail('SUBSCRIPTION_CANCELED', 'Canceled subscription cannot renew', 409);
  }
  const record = {
    userId: id(userId), planId: snapshot.code, amount: plan.price,
    currency: plan.currency.trim().toUpperCase(), provider: requiredText(input.provider, 'provider').toUpperCase(),
    purpose, subscriptionId, idempotencyScope: requiredText(input.idempotencyScope, 'idempotencyScope'),
    idempotencyKey: requiredText(input.idempotencyKey, 'idempotencyKey'), planSnapshot: snapshot,
  };
  record.requestFingerprint = fingerprint(record);
  return record;
}

function fingerprint(record) {
  const canonical = [id(record.userId), record.planId, record.amount, record.currency,
    record.provider, record.purpose, record.subscriptionId == null ? null : id(record.subscriptionId), record.idempotencyScope];
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
function assertReplay(existing, proposed) {
  if (existing.requestFingerprint !== proposed.requestFingerprint) fail('IDEMPOTENCY_KEY_REUSED', 'Idempotency key was reused for another request', 409);
  return existing;
}
// Policy helper only. A verified flag here is NOT a provider signature verifier.
// There is deliberately no exposed persistence operation accepting a client status.
function assertTransition(from, to, {verified = false} = {}) {
  if (!PAYMENT_STATES.includes(from) || !PAYMENT_STATES.includes(to)) fail('INVALID_PAYMENT_STATE', 'Unknown payment state');
  if (from === to) return;
  if (!TRANSITIONS[from].includes(to)) fail('INVALID_PAYMENT_TRANSITION', 'Payment transition is forbidden', 409);
  if (to === 'SUCCEEDED' && !verified) fail('UNVERIFIED_PAYMENT', 'Verified provider evidence is required', 403);
}

function addCalendarMonths(value, months, anchorDay) {
  const start = date(value);
  if (![1, 3, 12].includes(months) || !Number.isInteger(anchorDay) || anchorDay < 1 || anchorDay > 31) {
    fail('INVALID_PAYMENT_INPUT', 'Invalid calendar interval or billing anchor');
  }
  const result = new Date(start);
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const monthEnd = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(anchorDay, monthEnd));
  return result;
}
function calculatePeriod(subscription, succeededAt, intervalMonths) {
  const paidAt = date(succeededAt);
  const previousEnd = subscription?.currentPeriodEnd == null ? null : date(subscription.currentPeriodEnd);
  const periodStart = previousEnd && previousEnd > paidAt ? previousEnd : paidAt;
  const billingAnchorDay = subscription?.billingAnchorDay ?? periodStart.getUTCDate();
  return {periodStart, periodEnd: addCalendarMonths(periodStart, intervalMonths, billingAnchorDay), billingAnchorDay};
}

function localDayNumber(value) {
  // Locked V1 reminder timezone: Asia/Ho_Chi_Minh (UTC+07, no DST).
  return Math.floor((date(value).getTime() + 7 * 60 * 60 * 1000) / 86400000);
}
function reminderType(subscription, now) {
  if (subscription.status === 'CANCELED' || !subscription.currentPeriodEnd) return null;
  const end = date(subscription.currentPeriodEnd);
  if (end <= date(now)) return 'EXPIRED';
  const days = localDayNumber(end) - localDayNumber(now);
  return ({5: 'T5', 3: 'T3', 1: 'T1'})[days] ?? null;
}
function hasValidEntitlement(entitlement, now = new Date()) {
  return Boolean(entitlement && date(entitlement.validUntil) > date(now));
}

module.exports = {INTERVAL_MONTHS, PAYMENT_STATES, requiredText, id, date, fail, planSnapshot,
  checkoutRecord, fingerprint, assertReplay, assertTransition, addCalendarMonths, calculatePeriod,
  reminderType, hasValidEntitlement};
