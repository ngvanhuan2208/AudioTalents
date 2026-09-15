const {getHealthStatus} = require('../services/healthService');

function getHealth(req, res) {
  res.json(getHealthStatus());
}

module.exports = {getHealth};
