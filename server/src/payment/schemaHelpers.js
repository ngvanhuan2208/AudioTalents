const mongoose = require('mongoose');
const {INTERVAL_MONTHS, PAYMENT_STATES} = require('./contracts');

const ref = (model, required = true) => ({type: mongoose.Schema.Types.ObjectId, ref: model, required});
const text = (extra = {}) => ({type: String, trim: true, required: true, ...extra});
const money = () => ({type: Number, required: true, min: 0, validate: Number.isSafeInteger});
const currency = () => text({uppercase: true, match: /^[A-Z]{3}$/});
const planId = () => text({lowercase: true});
const interval = () => ({type: Number, required: true, enum: [1, 3, 12], validate: {
  validator(value) { return INTERVAL_MONTHS[this.billingPeriod] === value; }, message: 'Billing period and interval must agree',
}});
const keys = () => ({type: [String], required: true, validate: {
  validator: value => value.length > 0 && value.every(key => typeof key === 'string' && key.trim() === key && key.length > 0) && new Set(value).size === value.length,
  message: 'Entitlement keys must be nonempty and unique',
}});
const snapshotSchema = new mongoose.Schema({
  code: planId(), name: text(), billingPeriod: text({enum: Object.keys(INTERVAL_MONTHS)}),
  intervalMonths: interval(), entitlementKeys: keys(),
}, {_id: false, strict: 'throw'});
function compile(name, fields, indexes, {createdOnly = false} = {}) {
  const schema = new mongoose.Schema(fields, {
    strict: 'throw', timestamps: createdOnly ? {createdAt: true, updatedAt: false} : true,
    // Importing a registry must not provision indexes/collections in the canonical DB.
    autoCreate: false, autoIndex: false,
  });
  for (const [fields, options = {}] of indexes) schema.index(fields, options);
  return mongoose.models[name] || mongoose.model(name, schema);
}
const paymentState = () => text({enum: PAYMENT_STATES, default: 'PENDING'});
const partialString = field => ({unique: true, partialFilterExpression: {[field]: {$type: 'string'}}});
const orderedEnd = startField => ({type: Date, required: true, validate: {
  validator(value) { return !this[startField] || value > this[startField]; }, message: 'Period end must follow its start',
}});
module.exports = {mongoose, ref, text, money, currency, planId, interval, keys, snapshotSchema,
  compile, paymentState, partialString, orderedEnd, INTERVAL_MONTHS};
