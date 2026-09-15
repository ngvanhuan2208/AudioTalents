const mongoose = require('mongoose');

const GenreSchema = new mongoose.Schema(
  {
    name: {type: String, required: true, trim: true},
    slug: {type: String, required: true, trim: true, lowercase: true},
    description: {type: String, default: ''},
    icon: {type: String, default: null},
    isActive: {type: Boolean, default: true},
    sortOrder: {type: Number, default: 0},
  },
  {timestamps: true}
);

GenreSchema.index({slug: 1}, {unique: true});
GenreSchema.index({name: 1});

const Genre = mongoose.models.Genre || mongoose.model('Genre', GenreSchema);

module.exports = Genre;
