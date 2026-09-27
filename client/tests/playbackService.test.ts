import assert from 'node:assert/strict';
import test from 'node:test';
import type {Chapter, Story} from '../src/types';
import {resolvePlaybackUrl} from '../src/services/api';
import {orderedPlayableParts} from '../src/services/contentService';
import {createPlaybackRequestGuard, nextPlaybackPosition, NoPlayableAudioError, previousPlaybackPosition, resolvePlayableStory} from '../src/services/playbackService';

const apiBase = 'https://api.example.test/api/';
const story = {id: 'story-1', chapters: []} as unknown as Story;
const chapter = (index: number, parts: ReturnType<typeof orderedPlayableParts>): Chapter => ({
  id: `chapter-${index}`, storyId: story.id, index, title: `Chương ${index}`,
  durationSec: 0, durationFormatted: '0:00', isVip: false, publishedAt: '',
  content: '', transcript: [], audioUrl: parts[0]?.audioUrl, audioParts: parts,
});

test('relative playback path uses the API origin exactly once; absolute signed URL is unchanged', () => {
  assert.equal(resolvePlaybackUrl('/api/audio/123/playback', apiBase), 'https://api.example.test/api/audio/123/playback');
  assert.equal(resolvePlaybackUrl('audio/123/playback', apiBase), 'https://api.example.test/api/audio/123/playback');
  const signed = 'https://storage.example.test/audio.mp3?signature=opaque';
  assert.equal(resolvePlaybackUrl(signed, apiBase), signed);
  assert.equal(resolvePlaybackUrl('javascript:alert(1)', apiBase), null);
  assert.equal(resolvePlaybackUrl('//other.example.test/audio.mp3', apiBase), null);
});

test('public Audio parts follow partNumber, not response or creation order', () => {
  const parts = orderedPlayableParts([
    {id: 'third', partNumber: 3, audioUrl: '/api/audio/3/playback'},
    {id: 'first', partNumber: 1, audioUrl: '/api/audio/1/playback'},
    {id: 'second', partNumber: 2, audioUrl: '/api/audio/2/playback'},
  ], apiBase);
  assert.deepEqual(parts.map(part => part.id), ['first', 'second', 'third']);
  assert.equal(parts[0].audioUrl, 'https://api.example.test/api/audio/1/playback');
  const playableStory = {...story, chapters: [chapter(1, parts)]};
  assert.equal(nextPlaybackPosition(playableStory, 'chapter-1', 0)?.chapter.audioParts?.[1].id, 'second');
  assert.equal(nextPlaybackPosition(playableStory, 'chapter-1', 1)?.chapter.audioParts?.[2].id, 'third');
  assert.equal(nextPlaybackPosition(playableStory, 'chapter-1', 2), null);
  assert.equal(previousPlaybackPosition(playableStory, 'chapter-1', 2)?.chapter.audioParts?.[1].id, 'second');
});

test('quick play resolves a list Story without embedded chapters through public detail data', async () => {
  const parts = orderedPlayableParts([{partNumber: 1, audioUrl: '/api/audio/1/playback'}], apiBase);
  let requestedStory = '';
  const result = await resolvePlayableStory(story.id, undefined, {
    getStory: async id => { requestedStory = id; return story; },
    getChapters: async () => [chapter(2, parts), chapter(1, [])],
  });
  assert.equal(requestedStory, story.id);
  assert.equal(result.chapter.index, 2);
  assert.equal(result.story.chapters.length, 2);
  assert.equal(result.chapter.audioUrl, 'https://api.example.test/api/audio/1/playback');
});

test('a requested chapter cannot silently fall back to another playable chapter', async () => {
  const parts = orderedPlayableParts([{partNumber: 1, audioUrl: '/api/audio/1/playback'}], apiBase);
  await assert.rejects(resolvePlayableStory(story.id, 1, {
    getStory: async () => story,
    getChapters: async () => [chapter(1, []), chapter(2, parts)],
  }), NoPlayableAudioError);
});

test('no public playable Audio has a controlled unavailable result', async () => {
  await assert.rejects(resolvePlayableStory(story.id, undefined, {
    getStory: async () => story,
    getChapters: async () => [chapter(1, [])],
  }), error => error instanceof NoPlayableAudioError && error.message === 'Chưa có tập Audio khả dụng.');
  await assert.rejects(resolvePlayableStory(story.id, undefined, {
    getStory: async () => story,
    getChapters: async () => [],
  }), NoPlayableAudioError);
});

test('the latest request wins when A completes after B', async () => {
  const guard = createPlaybackRequestGuard();
  const first = guard.next();
  const second = guard.next();
  let current = '';
  const apply = (request: number, value: string) => { if (guard.isCurrent(request)) current = value; };
  apply(second, 'B');
  apply(first, 'A');
  assert.equal(current, 'B');
});
