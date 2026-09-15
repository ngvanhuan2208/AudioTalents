const mongoose = require('mongoose');

const PLAYLIST_VISIBILITY = Object.freeze(['PRIVATE', 'PUBLIC']);

function hasUniqueStoryIds(storyIds) {
  if (!Array.isArray(storyIds)) return false;
  return new Set(storyIds.map(storyId => storyId.toString())).size === storyIds.length;
}

const PlaylistSchema = new mongoose.Schema(
  {
    userId: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    name: {type: String, required: true, trim: true},
    description: {type: String, default: ''},
    storyIds: {
      type: [{type: mongoose.Schema.Types.ObjectId, ref: 'Story'}],
      default: [],
      validate: {
        validator: hasUniqueStoryIds,
        message: 'storyIds must not contain duplicates',
      },
    },
    visibility: {type: String, required: true, enum: PLAYLIST_VISIBILITY, default: 'PRIVATE'},
  },
  {timestamps: true}
);

PlaylistSchema.index({userId: 1});

const Playlist = mongoose.models.Playlist || mongoose.model('Playlist', PlaylistSchema);

module.exports = Playlist;
