const {compile, planId, text, interval, money, currency, keys, INTERVAL_MONTHS} = require('../payment/schemaHelpers');

module.exports = compile('Plan', {
  planId: {...planId(), immutable: true}, name: text(),
  billingPeriod: text({enum: Object.keys(INTERVAL_MONTHS)}), intervalMonths: interval(),
  price: money(), currency: currency(), entitlementKeys: keys(), isActive: {type: Boolean, default: false},
}, [[{planId: 1}, {unique: true}], [{isActive: 1, planId: 1}]]);
