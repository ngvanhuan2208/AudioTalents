const {compile, ref, text} = require('../payment/schemaHelpers');

module.exports = compile('SubscriptionReminder', {
  subscriptionId: {...ref('Subscription'), immutable: true}, userId: {...ref('User'), immutable: true},
  periodEnd: {type: Date, required: true, immutable: true},
  reminderType: text({enum: ['T5', 'T3', 'T1', 'EXPIRED'], immutable: true}),
  // Reserve the Notification identity BEFORE delivery; replay upserts this same _id.
  notificationId: {...ref('Notification'), immutable: true},
  deliveredAt: {type: Date, default: null}, suppressedAt: {type: Date, default: null},
}, [[{subscriptionId: 1, periodEnd: 1, reminderType: 1}, {unique: true}], [{deliveredAt: 1, suppressedAt: 1}]], {createdOnly: true});
