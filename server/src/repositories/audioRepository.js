const {InMemoryRepository} = require('./InMemoryRepository');

class AudioRepository extends InMemoryRepository {
  findByChapter(chapterId) {
    return this.findMany(audio => audio.chapterId === chapterId);
  }

  findMaxPartNumberByChapter(chapterId) {
    return this.findByChapter(chapterId).reduce((max, audio) => Number.isInteger(audio.partNumber) ? Math.max(max, audio.partNumber) : max, 0);
  }

  createAudio(input) {
    if (Number.isInteger(input?.partNumber) && this.findByChapter(input.chapterId).some(audio => audio.partNumber === input.partNumber)) {
      const error = new Error('Audio part number already exists'); error.code = 'AUDIO_PART_CONFLICT'; throw error;
    }
    return this.create(input);
  }
}

const audioRepository = new AudioRepository();
module.exports = {AudioRepository, audioRepository};
