// Deprecated discovery placeholder only; preserved for the existing HTTP contract.
// Never use these labels as paid plans or access authority. Payment Core V2 Plan,
// Subscription and UserEntitlement own future Premium billing/access respectively.
const MEMBERSHIP_PLANS = Object.freeze({FREE: 'FREE', PREMIUM: 'PREMIUM', CREATOR: 'CREATOR'});
function getPlans() { return Object.values(MEMBERSHIP_PLANS).map(plan => ({plan, implemented: false})); }
module.exports = {MEMBERSHIP_PLANS, getPlans};
