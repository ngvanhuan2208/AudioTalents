const {configureIdentityRepositoriesForTests, createInMemoryIdentityRepositories} = require('../../src/repositories/identityRuntime');
const {userRepository} = require('../../src/repositories/userRepository');
const {otpTokenRepository} = require('../../src/repositories/otpTokenRepository');
const {authorApplicationRepository} = require('../../src/repositories/authorApplicationRepository');

function useInMemoryIdentityRepositoriesForTest() {
  configureIdentityRepositoriesForTests(createInMemoryIdentityRepositories({
    userRepository,
    otpTokenRepository,
    authorApplicationRepository,
  }));
}

module.exports = {useInMemoryIdentityRepositoriesForTest};
