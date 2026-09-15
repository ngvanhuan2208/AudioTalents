const mongoose = require('mongoose');

const TagSchema = new mongoose.Schema(
  {
    name: {type: String, required: true, trim: true},
    normalizedName: {type: String, required: true, trim: true, lowercase: true},
    slug: {type: String, required: true, trim: true, lowercase: true},
    isActive: {type: Boolean, default: true},
  },
  {timestamps: true}
);

TagSchema.index({normalizedName: 1}, {unique: true});
TagSchema.index({slug: 1}, {unique: true});
TagSchema.index({isActive: 1, name: 1});

const Tag = mongoose.models.Tag || mongoose.model('Tag', TagSchema);
module.exports = Tag;
