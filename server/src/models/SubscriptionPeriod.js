const {compile, ref, planId, orderedEnd} = require('../payment/schemaHelpers');

module.exports = compile('SubscriptionPeriod', {
  subscriptionId: {...ref('Subscription'), immutable: true}, paymentAttemptId: {...ref('PaymentAttempt'), immutable: true},
  planId: {...planId(), immutable: true}, periodStart: {type: Date, required: true, immutable: true},
  periodEnd: {...orderedEnd('periodStart'), immutable: true},
}, [[{paymentAttemptId: 1}, {unique: true}], [{subscriptionId: 1, periodStart: 1}]], {createdOnly: true});
