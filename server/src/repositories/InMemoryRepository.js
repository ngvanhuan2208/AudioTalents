const {randomUUID} = require('crypto');

class InMemoryRepository {
  constructor(seed = []) {
    this.items = seed.map(item => ({...item}));
  }

  create(data) {
    const item = {id: randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...data};
    this.items.push(item);
    return {...item};
  }

  findById(id) { return this.items.find(item => item.id === id) || null; }
  findOne(predicate) { return this.items.find(predicate) || null; }
  findMany(predicate = () => true) { return this.items.filter(predicate).map(item => ({...item})); }
  count(predicate = () => true) { return this.items.filter(predicate).length; }

  update(id, changes) {
    const index = this.items.findIndex(item => item.id === id);
    if (index < 0) return null;
    this.items[index] = {...this.items[index], ...changes, updatedAt: new Date().toISOString()};
    return {...this.items[index]};
  }

  delete(id) {
    const index = this.items.findIndex(item => item.id === id);
    if (index < 0) return false;
    this.items.splice(index, 1);
    return true;
  }
}

module.exports = {InMemoryRepository};
