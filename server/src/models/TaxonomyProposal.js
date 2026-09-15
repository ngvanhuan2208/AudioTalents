const mongoose = require('mongoose');

const TaxonomyProposalSchema = new mongoose.Schema(
  {
    type: {type: String, required: true, enum: ['GENRE', 'TAG']},
    proposedName: {type: String, required: true, trim: true},
    normalizedName: {type: String, required: true, trim: true, lowercase: true},
    reason: {type: String, required: true, trim: true},
    proposerId: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    storyId: {type: mongoose.Schema.Types.ObjectId, ref: 'Story', required: true},
    status: {type: String, required: true, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING'},
    reviewedBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null},
    reviewedAt: {type: Date, default: null},
    reviewNote: {type: String, default: ''},
    resolvedTaxonomyId: {type: mongoose.Schema.Types.ObjectId, default: null},
  },
  {timestamps: true}
);

TaxonomyProposalSchema.index({status: 1, createdAt: -1});
TaxonomyProposalSchema.index({proposerId: 1, storyId: 1, type: 1});

const TaxonomyProposal = mongoose.models.TaxonomyProposal || mongoose.model('TaxonomyProposal', TaxonomyProposalSchema);
module.exports = TaxonomyProposal;
