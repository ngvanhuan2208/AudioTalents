const {getDatabaseStatus} = require('../config/database');

function getHealthStatus() {
  const databaseConnected = getDatabaseStatus().state === 'CONNECTED';
  return {
    success: databaseConnected,
    message: databaseConnected ? 'AudioTalents API is healthy' : 'AudioTalents API database is unavailable',
    data: {
      api: 'UP',
      database: databaseConnected ? 'UP' : 'DOWN',
    },
  };
}

module.exports = {getHealthStatus};
