class Repository {
  findById() { throw new Error('Repository.findById must be implemented by a domain repository'); }
  findOne() { throw new Error('Repository.findOne must be implemented by a domain repository'); }
  findMany() { throw new Error('Repository.findMany must be implemented by a domain repository'); }
  exists() { throw new Error('Repository.exists must be implemented by a domain repository'); }
}

module.exports = {Repository};
