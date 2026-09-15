const {InMemoryRepository} = require('./InMemoryRepository');

class OtpTokenRepository extends InMemoryRepository {
  findActiveByUserAndPurpose(userId, purpose) {
    return this.findOne(item => item.userId === userId && item.purpose === purpose && !item.usedAt);
  }

  findLatestByUserAndPurpose(userId, purpose) {
    return this.findMany(item => item.userId === userId && item.purpose === purpose)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] || null;
  }

  invalidateActive(userId, purpose) {
    const now = new Date().toISOString();
    this.items = this.items.map(item => (
      item.userId === userId && item.purpose === purpose && !item.usedAt
        ? {...item, usedAt: now, updatedAt: now}
        : item
    ));
  }
}

const otpTokenRepository = new OtpTokenRepository();
module.exports = {OtpTokenRepository, otpTokenRepository};
