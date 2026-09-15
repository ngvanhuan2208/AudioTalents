const {InMemoryRepository} = require('./InMemoryRepository');

class ChapterRepository extends InMemoryRepository {
  findByStory(storyId) { return this.findMany(chapter => chapter.storyId === storyId); }
  findByStoryAndNumber(storyId, chapterNumber) { return this.findOne(chapter => chapter.storyId === storyId && chapter.chapterNumber === chapterNumber); }
}

const chapterRepository = new ChapterRepository();
module.exports = {ChapterRepository, chapterRepository};
