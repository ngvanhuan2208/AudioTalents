const {
  configureContentRepositoriesForTests,
  createInMemoryContentRepositories,
} = require('../../src/repositories/contentRuntime');
const {genreRepository} = require('../../src/repositories/genreRepository');
const {storyRepository} = require('../../src/repositories/storyRepository');
const {chapterRepository} = require('../../src/repositories/chapterRepository');
const {audioRepository} = require('../../src/repositories/audioRepository');

function useInMemoryContentRepositoriesForTest() {
  configureContentRepositoriesForTests(createInMemoryContentRepositories({
    genreRepository,
    storyRepository,
    chapterRepository,
    audioRepository,
  }));
}

module.exports = {useInMemoryContentRepositoriesForTest};
