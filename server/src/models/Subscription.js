const {compile, ref, text, planId, mongoose, orderedEnd} = require('../payment/schemaHelpers');

// Recoverable single-document CAS journal, not a second source of period history.
const pendingSchema = new mongoose.Schema({
  paymentAttemptId: ref('PaymentAttempt'), periodStart: {type: Date, required: true},
  periodEnd: orderedEnd('periodStart'), entitlementKeys: {type: [String], required: true},
}, {_id: false, strict: 'throw'});

module.exports = compile('Subscription', {
  userId: {...ref('User'), immutable: true}, planId: {...planId(), immutable: true},
  originPaymentAttemptId: {...ref('PaymentAttempt'), immutable: true},
  status: text({enum: ['ACTIVE', 'CANCELED', 'EXPIRED'], default: 'EXPIRED'}),
  currentPeriodStart: {type: Date, default: null}, currentPeriodEnd: {type: Date, default: null},
  billingAnchorDay: {type: Number, min: 1, max: 31, validate: value => value == null || Number.isInteger(value), default: null},
  renewalMode: text({enum: ['MANUAL'], default: 'MANUAL'}),
  provider: {type: String}, providerSubscriptionId: {type: String},
  revision: {type: Number, default: 0, min: 0, validate: Number.isSafeInteger},
  pendingApplication: {type: pendingSchema, default: null},
}, [[{userId: 1}, {unique: true}], [{originPaymentAttemptId: 1}, {unique: true}], [{status: 1, currentPeriodEnd: 1}]]);
