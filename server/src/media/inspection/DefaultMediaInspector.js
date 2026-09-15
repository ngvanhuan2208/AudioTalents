const {Readable} = require('node:stream');
const {MediaInspector} = require('./MediaInspector');
const {mediaInspectionError, normalizeInspectionError} = require('./mediaInspectionErrors');

const MAX_MEDIA_BYTES = 500 * 1024 * 1024;
const MAX_DURATION_SEC = 4 * 60 * 60;

function isNodeReadable(value) {
  return value instanceof Readable || (value && typeof value.pipe === 'function' && typeof value.on === 'function');
}

function assertSize(size) {
  if (!Number.isSafeInteger(size) || size <= 0) throw mediaInspectionError('OBJECT_VALIDATION_FAILED');
  if (size > MAX_MEDIA_BYTES) throw mediaInspectionError('MEDIA_TOO_LARGE');
  return size;
}

function assertPositiveFinite(value) {
  return Number.isFinite(value) && value > 0;
}

function getFormat(metadata) {
  if (!metadata?.format || metadata.format.hasAudio !== true) throw mediaInspectionError('UNSUPPORTED_MEDIA');
  return metadata.format;
}

function mapMp3(format) {
  if (format.container !== 'MPEG' || !/\bLayer 3\b/i.test(format.codec || '')) throw mediaInspectionError('UNSUPPORTED_MEDIA');
  return {detectedMimeType: 'audio/mpeg', container: 'MP3', codec: 'MP3', extension: 'mp3'};
}

function mapM4a(format) {
  const isMp4 = /^(MPEG-4|ISO Base Media|MP4)$/i.test(format.container || '');
  const isAacLc = /^AAC$/i.test(format.codec || '') && /^(LC|AAC-LC)$/i.test(format.codecProfile || '');
  if (!isMp4 || !isAacLc) throw mediaInspectionError('UNSUPPORTED_MEDIA');
  return {detectedMimeType: 'audio/mp4', container: 'MP4', codec: 'AAC_LC', extension: 'm4a'};
}

function mapWav(format) {
  if (format.container !== 'WAVE' || format.codec !== 'PCM' || format.bitsPerSample !== 16) throw mediaInspectionError('UNSUPPORTED_MEDIA');
  return {detectedMimeType: 'audio/wav', container: 'WAV', codec: 'PCM_S16LE', extension: 'wav'};
}

function mapAllowedFormat(metadata) {
  const format = getFormat(metadata);
  const mapped = format.container === 'MPEG' ? mapMp3(format)
    : /^(MPEG-4|ISO Base Media|MP4)$/i.test(format.container || '') ? mapM4a(format)
      : format.container === 'WAVE' ? mapWav(format)
        : (() => { throw mediaInspectionError('UNSUPPORTED_MEDIA'); })();
  if (!assertPositiveFinite(format.duration) || format.duration > MAX_DURATION_SEC || !assertPositiveFinite(format.bitrate)) {
    throw mediaInspectionError('OBJECT_VALIDATION_FAILED');
  }
  return {...mapped, durationSec: format.duration, bitrate: format.bitrate};
}

async function loadMusicMetadata() {
  return import('music-metadata');
}

class DefaultMediaInspector extends MediaInspector {
  constructor({parseStream, parserLoader = loadMusicMetadata} = {}) {
    super();
    this.parseStream = parseStream;
    this.parserLoader = parserLoader;
  }

  async inspectAudio({stream, size}) {
    assertSize(size);
    if (!isNodeReadable(stream)) throw mediaInspectionError('OBJECT_VALIDATION_FAILED');
    try {
      const parseStream = this.parseStream || (await this.parserLoader()).parseStream;
      if (typeof parseStream !== 'function') throw mediaInspectionError('OBJECT_VALIDATION_FAILED');
      const metadata = await parseStream(stream, {size}, {duration: true});
      return mapAllowedFormat(metadata);
    } catch (error) {
      throw normalizeInspectionError(error);
    }
  }
}

module.exports = {DefaultMediaInspector, MAX_MEDIA_BYTES, MAX_DURATION_SEC, assertSize, mapAllowedFormat, isNodeReadable};
