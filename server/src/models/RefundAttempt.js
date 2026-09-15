const {compile, ref, text, money, currency, partialString} = require('../payment/schemaHelpers');

module.exports = compile('RefundAttempt', {
  paymentAttemptId: {...ref('PaymentAttempt'), immutable: true}, requestedBy: {...ref('User'), immutable: true},
  idempotencyKey: text({immutable: true}), requestFingerprint: text({match: /^[a-f0-9]{64}$/, immutable: true}),
  provider: text({uppercase: true, immutable: true}), amount: {...money(), immutable: true}, currency: {...currency(), immutable: true},
  reason: text({immutable: true}), status: text({enum: ['PENDING', 'UNKNOWN', 'SUCCEEDED', 'FAILED'], default: 'PENDING'}),
  providerRequestId: {type: String, immutable: true}, providerRefundId: {type: String},
  failureCode: {type: String}, failureMessage: {type: String},
}, [[{paymentAttemptId: 1, idempotencyKey: 1}, {unique: true}],
  [{provider: 1, providerRequestId: 1}, partialString('providerRequestId')],
  [{provider: 1, providerRefundId: 1}, partialString('providerRefundId')], [{status: 1, createdAt: 1}]]);
