const {checkoutRecord, requiredText, id, fail, calculatePeriod, date, reminderType, assertReplay} = require('./contracts');

const REMINDER_TEXT = Object.freeze({
  T5: 'Premium còn 5 ngày', T3: 'Premium sắp hết hạn', T1: 'Premium sẽ hết hạn vào ngày mai', EXPIRED: 'Premium đã hết hạn',
});

// Explicit construction only: no routes, gateway calls, seed, timers or startup jobs.
function createPaymentFoundationService({store, clock = () => new Date()}) {
  async function createAttempt(userId, input) {
    const plan = await store.getPlan(requiredText(input.planId, 'planId').toLowerCase());
    const subscription = input.subscriptionId == null ? null : await store.getSubscription(id(input.subscriptionId));
    const record = checkoutRecord(userId, input, plan, subscription);
    const existing = await store.findAttempt(record);
    if (existing) return assertReplay(existing, record);
    if (record.purpose === 'NEW_SUBSCRIPTION') {
      const current = await store.getUserSubscription(userId);
      if (current) {
        fail('SUBSCRIPTION_EXISTS', 'Use renewal for the existing subscription', 409);
      }
    }
    return store.createAttempt(record);
  }

  async function grantPeriod(subscription, payment, period) {
    for (const key of payment.planSnapshot.entitlementKeys) {
      await store.grantEntitlement({userId: subscription.userId, key, source: 'SUBSCRIPTION',
        sourceId: id(subscription._id), validUntil: period.periodEnd});
    }
  }

  async function recoverPending(subscription) {
    const pending = subscription.pendingApplication;
    if (!pending) return;
    const payment = await store.getPayment(pending.paymentAttemptId);
    verifyPayment(payment);
    assertMembership(subscription, payment);
    if (JSON.stringify(pending.entitlementKeys) !== JSON.stringify(payment.planSnapshot.entitlementKeys)) {
      fail('PERIOD_INTEGRITY_CONFLICT', 'Pending benefits differ from payment snapshot', 409);
    }
    const period = await store.insertPeriod({subscriptionId: subscription._id, paymentAttemptId: payment._id,
      planId: payment.planId, periodStart: pending.periodStart, periodEnd: pending.periodEnd});
    await grantPeriod(subscription, payment, period);
    await store.clearPending(subscription);
  }

  function verifyPayment(payment) {
    if (!payment || payment.status !== 'SUCCEEDED' || !payment.succeededAt) fail('PAYMENT_NOT_SUCCEEDED', 'Persisted successful payment is required', 409);
    if (!payment.planSnapshot || payment.planSnapshot.code !== payment.planId || ![1, 3, 12].includes(payment.planSnapshot.intervalMonths) ||
        !payment.planSnapshot.entitlementKeys?.length) fail('INVALID_PAYMENT_SNAPSHOT', 'Invalid payment snapshot', 409);
    date(payment.succeededAt);
  }
  function assertMembership(subscription, payment) {
    if (!subscription || id(subscription.userId) !== id(payment.userId)) fail('SUBSCRIPTION_NOT_FOUND', 'Subscription not found', 404);
    if (subscription.planId !== payment.planId) fail('PLAN_SWITCH_NOT_SUPPORTED', 'Cannot apply payment to another plan', 409);
    if (payment.purpose === 'RENEWAL' && id(payment.subscriptionId) !== id(subscription._id)) fail('SUBSCRIPTION_NOT_FOUND', 'Subscription mismatch', 404);
  }

  async function applySucceededPayment(paymentId) {
    // Accept an identity, never a caller-supplied "successful payment" object.
    const payment = await store.getPayment(id(paymentId));
    verifyPayment(payment);
    const target = payment.purpose === 'RENEWAL'
      ? await store.getSubscription(payment.subscriptionId) : await store.ensureSubscription(payment);
    assertMembership(target, payment);
    for (let retry = 0; retry < 100; retry += 1) {
      const subscription = await store.getSubscription(target._id);
      assertMembership(subscription, payment);
      // Any worker may finish the durable pending intent left by another worker.
      if (subscription.pendingApplication) { await recoverPending(subscription); continue; }
      const existing = await store.getPeriod(payment._id);
      if (existing) {
        if (id(existing.subscriptionId) !== id(subscription._id)) fail('PERIOD_INTEGRITY_CONFLICT', 'Period belongs to another subscription', 409);
        await grantPeriod(subscription, payment, existing);
        return existing;
      }
      if (subscription.status === 'CANCELED') fail('SUBSCRIPTION_CANCELED', 'Canceled subscription needs reconciliation', 409);
      const period = calculatePeriod(subscription, payment.succeededAt, payment.planSnapshot.intervalMonths);
      const reserved = await store.reservePeriod(subscription, payment, period, date(clock()));
      if (reserved) await recoverPending(reserved);
    }
    fail('PAYMENT_APPLICATION_BUSY', 'Retry the durable application later', 409);
  }

  async function deliverIfCurrent(reminder, now) {
    if (reminder.deliveredAt || reminder.suppressedAt) return;
    const current = await store.getSubscription(reminder.subscriptionId);
    if (current?.pendingApplication) return; // Maintenance/replay will first recover the period.
    if (!current || +date(current.currentPeriodEnd) !== +date(reminder.periodEnd) || reminderType(current, now) !== reminder.reminderType) {
      await store.suppressReminder(reminder, now);
      return;
    }
    const title = REMINDER_TEXT[reminder.reminderType];
    await store.deliverReminder(reminder, {title,
      message: `${title}. Bạn có thể chủ động gia hạn trong mục Premium. Hệ thống không tự động trừ tiền.`}, now);
  }

  async function runMaintenance() {
    const now = date(clock());
    for (const subscription of await store.pendingSubscriptions()) await recoverPending(subscription);
    await store.expireSubscriptions(now);
    for (const subscription of await store.listSubscriptions()) {
      const type = reminderType(subscription, now);
      if (type && !subscription.pendingApplication) await deliverIfCurrent(await store.reserveReminder(subscription, type), now);
    }
    for (const reminder of await store.pendingReminders()) await deliverIfCurrent(reminder, now);
  }

  return {createAttempt, applySucceededPayment, runMaintenance,
    hasAccess: (userId, key) => store.hasEntitlement(id(userId), requiredText(key, 'entitlement key'), date(clock()))};
}

module.exports = {createPaymentFoundationService};
