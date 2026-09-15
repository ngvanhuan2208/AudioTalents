const mongoose = require('mongoose');

const LibraryItemSchema = new mongoose.Schema(
  {
    userId: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    storyId: {type: mongoose.Schema.Types.ObjectId, ref: 'Story', required: true},
    isFavorite: {type: Boolean, default: false},
    followed: {type: Boolean, default: false},
    addedAt: {type: Date, required: true, default: Date.now},
  },
  {timestamps: true}
);

LibraryItemSchema.index({userId: 1, storyId: 1}, {unique: true});
LibraryItemSchema.index({userId: 1, isFavorite: 1});
LibraryItemSchema.index({userId: 1, followed: 1});

const LibraryItem = mongoose.models.LibraryItem || mongoose.model('LibraryItem', LibraryItemSchema);

module.exports = LibraryItem;
