function getModuleStatus(moduleName) {
  return {
    success: true,
    module: moduleName,
    message: `${moduleName} module is not implemented yet`
  };
}

module.exports = {getModuleStatus};
