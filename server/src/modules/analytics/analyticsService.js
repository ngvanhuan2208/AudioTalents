const {InMemoryRepository} = require('../../repositories/InMemoryRepository');
const analyticsRepository = new InMemoryRepository();
function record(event) { return analyticsRepository.create({type: event.type, userId: event.userId || null, storyId: event.storyId || null, chapterId: event.chapterId || null, value: event.value || 1}); }
function summary(storyId) { const events = analyticsRepository.findMany(item => !storyId || item.storyId === storyId); return {views: events.filter(item => item.type === 'VIEW').length, plays: events.filter(item => item.type === 'PLAY').length, listeningSeconds: events.filter(item => item.type === 'LISTENING').reduce((sum, item) => sum + item.value, 0)}; }
module.exports = {record, summary};
