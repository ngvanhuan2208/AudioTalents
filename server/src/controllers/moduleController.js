const {getModuleStatus} = require('../services/moduleService');

function createModuleController(moduleName) {
  return (req, res) => {
    res.json(getModuleStatus(moduleName));
  };
}

module.exports = {createModuleController};
