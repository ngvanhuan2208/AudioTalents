const {compile, ref, text, mongoose} = require('../payment/schemaHelpers');

// Allowlist only. No raw request body, tokens, signature, card or payer data.
const safePayload = new mongoose.Schema({
  merchantOrderId: text(), providerTxnId: {type: String}, outcome: text({enum: ['SUCCEEDED', 'FAILED', 'UNKNOWN']}),
  amount: {type: Number, required: true, min: 0, validate: Number.isSafeInteger},
  currency: text({uppercase: true, match: /^[A-Z]{3}$/}), occurredAt: {type: Date, required: true},
}, {_id: false, strict: 'throw'});
module.exports = compile('PaymentWebhookEvent', {
  provider: text({uppercase: true, immutable: true}), eventId: text({immutable: true}),
  paymentAttemptId: ref('PaymentAttempt', false), signatureVerified: {type: Boolean, required: true},
  sanitizedPayload: {type: safePayload, required: true, immutable: true, select: false},
  status: text({enum: ['RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED'], default: 'RECEIVED'}),
  receivedAt: {type: Date, required: true, default: Date.now}, processedAt: {type: Date},
  failureCode: {type: String},
}, [[{provider: 1, eventId: 1}, {unique: true}], [{status: 1, receivedAt: 1}]]);
