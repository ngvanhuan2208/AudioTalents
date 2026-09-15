const {compile, ref, text, money, currency, planId, snapshotSchema, paymentState, partialString} = require('../payment/schemaHelpers');

module.exports = compile('PaymentAttempt', {
  userId: {...ref('User'), immutable: true}, planId: {...planId(), immutable: true},
  provider: text({uppercase: true, immutable: true}), amount: {...money(), immutable: true}, currency: {...currency(), immutable: true},
  purpose: text({enum: ['NEW_SUBSCRIPTION', 'RENEWAL'], immutable: true}),
  subscriptionId: {...ref('Subscription', function () { return this.purpose === 'RENEWAL'; }), default: null, immutable: true,
    validate: {validator(value) { return this.purpose !== 'NEW_SUBSCRIPTION' || value == null; }, message: 'New purchase cannot target a subscription'}},
  idempotencyKey: text({immutable: true}), idempotencyScope: text({immutable: true}),
  requestFingerprint: text({match: /^[a-f0-9]{64}$/, immutable: true}),
  merchantOrderId: text({immutable: true}), providerRequestId: text({required: false, immutable: true}),
  providerTxnId: {type: String}, status: paymentState(),
  paymentUrl: {type: String, select: false}, paymentUrlExpiresAt: {type: Date},
  succeededAt: {type: Date, required() { return this.status === 'SUCCEEDED'; }}, failedAt: {type: Date},
  failureCode: {type: String}, failureMessage: {type: String},
  planSnapshot: {type: snapshotSchema, required: true, immutable: true},
}, [
  [{userId: 1, idempotencyScope: 1, idempotencyKey: 1}, {unique: true}],
  [{merchantOrderId: 1}, {unique: true}],
  [{provider: 1, providerRequestId: 1}, partialString('providerRequestId')],
  [{provider: 1, providerTxnId: 1}, partialString('providerTxnId')],
  [{userId: 1, createdAt: -1}], [{status: 1, updatedAt: 1}],
]);
