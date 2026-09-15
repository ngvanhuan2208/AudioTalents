class StorageProvider {
  async createDirectUpload() { throw new Error('StorageProvider.createDirectUpload must be implemented'); }
  async headObject() { throw new Error('StorageProvider.headObject must be implemented'); }
  async openReadStream() { throw new Error('StorageProvider.openReadStream must be implemented'); }
  async copyObject() { throw new Error('StorageProvider.copyObject must be implemented'); }
  async createReadUrl() { throw new Error('StorageProvider.createReadUrl must be implemented'); }
  async deleteObject() { throw new Error('StorageProvider.deleteObject must be implemented'); }
  async listObjects() { throw new Error('StorageProvider.listObjects must be implemented'); }
}

module.exports = {StorageProvider};
