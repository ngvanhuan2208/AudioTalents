class PlaybackGrantError extends Error {
  constructor(code, message) { super(message); this.name = 'PlaybackGrantError'; this.code = code; }
}

function playbackGrantError(code) {
  const messages = {
    INVALID_PLAYBACK_TOKEN: 'Playback capability is invalid',
    PLAYBACK_EXPIRED: 'Playback capability has expired',
    PLAYBACK_GRANT_CONFIGURATION_ERROR: 'Playback capability configuration is invalid',
  };
  return new PlaybackGrantError(code, messages[code] || 'Playback capability failed');
}

module.exports = {PlaybackGrantError, playbackGrantError};
