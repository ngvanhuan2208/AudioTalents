const {randomUUID} = require('node:crypto');
const mongoose = require('mongoose');
const {trustedNotification} = require('../repositories/mongo/NotificationMongoRepository');
const {id, assertReplay, fail, date} = require('./contracts');

const plain = value => value?.toObject ? value.toObject() : value;
const duplicate = error => error?.code === 11000;

// Internal foundation store. No generic update/delete API for financial records.
// Caller must explicitly provision unique indexes before enabling future workers.
class PaymentMongoStore {
  constructor(models = require('../models')) { this.models = models; }

  getPlan(planId) { return this.models.Plan.findOne({planId}).lean().exec(); }
  getPayment(paymentId) { return this.models.PaymentAttempt.findById(id(paymentId)).lean().exec(); }
  getSubscription(subscriptionId) { return this.models.Subscription.findById(id(subscriptionId)).lean().exec(); }
  getUserSubscription(userId) { return this.models.Subscription.findOne({userId: id(userId)}).lean().exec(); }
  getPeriod(paymentId) { return this.models.SubscriptionPeriod.findOne({paymentAttemptId: id(paymentId)}).lean().exec(); }
  findAttempt(record) {
    return this.models.PaymentAttempt.findOne({userId: record.userId, idempotencyScope: record.idempotencyScope,
      idempotencyKey: record.idempotencyKey}).lean().exec();
  }

  async createAttempt(record) {
    const filter = {userId: record.userId, idempotencyScope: record.idempotencyScope, idempotencyKey: record.idempotencyKey};
    const existing = await this.findAttempt(record);
    if (existing) return assertReplay(existing, record);
    try {
      // Both durable identities exist before any FUTURE ProviderAdapter call.
      return plain(await this.models.PaymentAttempt.create({...record,
        merchantOrderId: randomUUID(), providerRequestId: randomUUID(), status: 'PENDING'}));
    } catch (error) {
      if (!duplicate(error)) throw error;
      const winner = await this.models.PaymentAttempt.findOne(filter).lean().exec();
      if (!winner) throw error;
      return assertReplay(winner, record);
    }
  }

  async ensureSubscription(payment) {
    const filter = {userId: payment.userId};
    let subscription = await this.models.Subscription.findOne(filter).lean().exec();
    if (!subscription) {
      try {
        subscription = plain(await this.models.Subscription.create({userId: payment.userId,
          planId: payment.planId, originPaymentAttemptId: payment._id}));
      } catch (error) {
        if (!duplicate(error)) throw error;
        subscription = await this.models.Subscription.findOne(filter).lean().exec();
        if (!subscription) throw error;
      }
    }
    return subscription;
  }

  reservePeriod(subscription, payment, period, now) {
    return this.models.Subscription.findOneAndUpdate({
      _id: subscription._id, revision: subscription.revision, pendingApplication: null,
      status: {$ne: 'CANCELED'},
    }, {$set: {
      currentPeriodStart: period.periodStart, currentPeriodEnd: period.periodEnd,
      billingAnchorDay: period.billingAnchorDay, status: period.periodEnd > now ? 'ACTIVE' : 'EXPIRED',
      pendingApplication: {paymentAttemptId: payment._id, periodStart: period.periodStart,
        periodEnd: period.periodEnd, entitlementKeys: [...payment.planSnapshot.entitlementKeys]},
    }, $inc: {revision: 1}}, {returnDocument: 'after', runValidators: true}).lean().exec();
  }

  async insertPeriod(record) {
    try { return plain(await this.models.SubscriptionPeriod.create(record)); }
    catch (error) {
      if (!duplicate(error)) throw error;
      const existing = await this.getPeriod(record.paymentAttemptId);
      if (!existing) throw error;
      if (id(existing.subscriptionId) !== id(record.subscriptionId) || existing.planId !== record.planId ||
          +date(existing.periodStart) !== +date(record.periodStart) || +date(existing.periodEnd) !== +date(record.periodEnd)) {
        fail('PERIOD_INTEGRITY_CONFLICT', 'Stored period does not match reserved application', 409);
      }
      return existing;
    }
  }

  async grantEntitlement({userId, key, source, sourceId, validUntil}) {
    const filter = {userId: id(userId), key, source, sourceId: String(sourceId)};
    const update = {$setOnInsert: filter, $max: {validUntil: date(validUntil)}};
    try {
      return await this.models.UserEntitlement.findOneAndUpdate(filter, update,
        {upsert: true, returnDocument: 'after', runValidators: true}).lean().exec();
    } catch (error) {
      if (!duplicate(error)) throw error;
      // Another process inserted the unique grant: retry only the monotonic update.
      return this.models.UserEntitlement.findOneAndUpdate(filter, {$max: update.$max},
        {returnDocument: 'after', runValidators: true}).lean().exec();
    }
  }

  clearPending(subscription) {
    return this.models.Subscription.updateOne({_id: subscription._id, revision: subscription.revision,
      'pendingApplication.paymentAttemptId': subscription.pendingApplication.paymentAttemptId},
    {$set: {pendingApplication: null}, $inc: {revision: 1}}).exec();
  }
  async hasEntitlement(userId, key, now) {
    return Boolean(await this.models.UserEntitlement.exists({userId: id(userId), key, validUntil: {$gt: date(now)}}));
  }
  pendingSubscriptions() { return this.models.Subscription.find({pendingApplication: {$ne: null}}).lean().exec(); }
  listSubscriptions() { return this.models.Subscription.find({status: {$ne: 'CANCELED'}, currentPeriodEnd: {$ne: null}}).lean().exec(); }
  expireSubscriptions(now) {
    return this.models.Subscription.updateMany({status: 'ACTIVE', pendingApplication: null,
      currentPeriodEnd: {$lte: date(now)}}, {$set: {status: 'EXPIRED'}, $inc: {revision: 1}}).exec();
  }

  async reserveReminder(subscription, reminderType) {
    const filter = {subscriptionId: subscription._id, periodEnd: subscription.currentPeriodEnd, reminderType};
    const existing = await this.models.SubscriptionReminder.findOne(filter).lean().exec();
    if (existing) return existing;
    try {
      return plain(await this.models.SubscriptionReminder.create({...filter, userId: subscription.userId,
        notificationId: new mongoose.Types.ObjectId()}));
    } catch (error) {
      if (!duplicate(error)) throw error;
      const winner = await this.models.SubscriptionReminder.findOne(filter).lean().exec();
      if (!winner) throw error;
      return winner;
    }
  }
  pendingReminders() {
    return this.models.SubscriptionReminder.find({deliveredAt: null, suppressedAt: null}).lean().exec();
  }
  async deliverReminder(reminder, content, now) {
    // Core service createInternal allocates a new ID on every call. This narrowly
    // scoped repository upsert reuses its trusted input validator + existing model,
    // and never resets isRead/readAt during recovery after delivery.
    const input = trustedNotification({userId: reminder.userId, type: 'SYSTEM', targetType: 'SYSTEM',
      title: content.title, message: content.message});
    try {
      await this.models.Notification.updateOne({_id: reminder.notificationId},
        {$setOnInsert: {...input, isRead: false, readAt: null, createdAt: now, updatedAt: now}},
        {upsert: true, runValidators: true, timestamps: false}).exec();
    } catch (error) {
      if (!duplicate(error) || !(await this.models.Notification.exists({_id: reminder.notificationId}))) throw error;
    }
    await this.models.SubscriptionReminder.updateOne({_id: reminder._id}, {$set: {deliveredAt: now}}).exec();
  }
  suppressReminder(reminder, now) {
    return this.models.SubscriptionReminder.updateOne({_id: reminder._id, deliveredAt: null}, {$set: {suppressedAt: now}}).exec();
  }
}

module.exports = {PaymentMongoStore};
