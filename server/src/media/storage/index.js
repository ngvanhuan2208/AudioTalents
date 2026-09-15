const {S3CompatibleStorageProvider} = require('./S3CompatibleStorageProvider');
const {parseStorageConfig, toPublicStorageConfig} = require('./storageConfig');

function createStorageProvider({environment = process.env, client, presign} = {}) {
  const config = parseStorageConfig(environment);
  return new S3CompatibleStorageProvider({config, client, presign});
}

function getStorageProvider(options) {
  return createStorageProvider(options);
}

module.exports = {
  createStorageProvider,
  getStorageProvider,
  S3CompatibleStorageProvider,
  parseStorageConfig,
  toPublicStorageConfig,
  ...require('./StorageProvider'),
  ...require('./storageErrors'),
  ...require('./storageKey'),
};
