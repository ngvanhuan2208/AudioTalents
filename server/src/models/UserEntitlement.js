const {compile, ref, text} = require('../payment/schemaHelpers');

module.exports = compile('UserEntitlement', {
  userId: {...ref('User'), immutable: true}, key: text({immutable: true}),
  source: text({enum: ['SUBSCRIPTION', 'TRIAL', 'PROMO', 'ADMIN_GRANT'], immutable: true}),
  sourceId: {type: String, required: true, immutable: true}, validUntil: {type: Date, required: true},
}, [[{userId: 1, key: 1, source: 1, sourceId: 1}, {unique: true}], [{userId: 1, key: 1, validUntil: 1}]]);
