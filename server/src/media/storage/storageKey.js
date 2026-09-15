const {storageError} = require('./storageErrors');

const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;
const URL_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const MEDIA_PREFIXES = Object.freeze(['uploads/pending/', 'audio/']);

function assertStorageKey(key, {allowedPrefixes} = {}) {
  if (typeof key !== 'string' || key.length === 0 || key.trim() !== key) {
    throw storageError('OBJECT_VALIDATION_FAILED', 'validateKey');
  }
  if (key.startsWith('/') || key.includes('\\') || CONTROL_CHARACTERS.test(key) || URL_SCHEME.test(key)) {
    throw storageError('OBJECT_VALIDATION_FAILED', 'validateKey');
  }
  if (key.split('/').some(segment => segment === '..')) {
    throw storageError('OBJECT_VALIDATION_FAILED', 'validateKey');
  }
  if (allowedPrefixes && !allowedPrefixes.some(prefix => key.startsWith(prefix))) {
    throw storageError('OBJECT_VALIDATION_FAILED', 'validateKey');
  }
  return key;
}

function assertStoragePrefix(prefix) {
  if (typeof prefix !== 'string' || !prefix.endsWith('/')) {
    throw storageError('OBJECT_VALIDATION_FAILED', 'listObjects');
  }
  return assertStorageKey(`${prefix}placeholder`);
}

function assertMediaStorageKey(key) {
  return assertStorageKey(key, {allowedPrefixes: MEDIA_PREFIXES});
}

module.exports = {MEDIA_PREFIXES, assertStorageKey, assertStoragePrefix, assertMediaStorageKey};
