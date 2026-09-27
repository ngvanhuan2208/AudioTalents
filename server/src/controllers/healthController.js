const {getHealthStatus} = require('../services/healthService');

function getHealth(req, res) {
  const status = getHealthStatus();
  res.status(status.success ? 200 : 503).json(status);
}

module.exports = {getHealth};
