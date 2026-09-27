import type {Chapter, Story} from '../types';
import {getStoryById, getStoryChapters} from './contentService';

export class NoPlayableAudioError extends Error {
  constructor() {
    super('Chưa có tập Audio khả dụng.');
    this.name = 'NoPlayableAudioError';
  }
}

export function createPlaybackRequestGuard() {
  let version = 0;
  return {
    next: () => ++version,
    isCurrent: (request: number) => request === version,
    invalidate: () => { version += 1; },
  };
}

export function nextPlaybackPosition(story: Story, chapterId: string, partIndex: number): {chapter: Chapter; partIndex: number} | null {
  const current = story.chapters.findIndex(chapter => chapter.id === chapterId);
  if (current < 0) return null;
  const chapter = story.chapters[current];
  if (partIndex + 1 < (chapter.audioParts?.length || 0)) return {chapter, partIndex: partIndex + 1};
  const next = story.chapters.slice(current + 1).find(item => item.audioParts?.length);
  return next ? {chapter: next, partIndex: 0} : null;
}

export function previousPlaybackPosition(story: Story, chapterId: string, partIndex: number): {chapter: Chapter; partIndex: number} | null {
  const current = story.chapters.findIndex(chapter => chapter.id === chapterId);
  if (current < 0) return null;
  if (partIndex > 0) return {chapter: story.chapters[current], partIndex: partIndex - 1};
  const previous = story.chapters.slice(0, current).reverse().find(item => item.audioParts?.length);
  return previous ? {chapter: previous, partIndex: previous.audioParts!.length - 1} : null;
}

export async function resolvePlayableStory(
  storyId: string,
  chapterIndex?: number,
  source: {getStory: (id: string) => Promise<Story>; getChapters: (id: string) => Promise<Chapter[]>} = {
    getStory: getStoryById,
    getChapters: getStoryChapters,
  },
): Promise<{story: Story; chapter: Chapter}> {
  const [story, chapters] = await Promise.all([source.getStory(storyId), source.getChapters(storyId)]);
  const ordered = [...chapters].sort((a, b) => a.index - b.index);
  const playable = ordered.filter(chapter => Boolean(chapter.audioParts?.length && chapter.audioParts[0]?.audioUrl));
  if (!playable.length) throw new NoPlayableAudioError();
  // A requested chapter must be playable; do not silently play another chapter.
  const chapter = chapterIndex === undefined ? playable[0] : playable.find(item => item.index === chapterIndex);
  if (!chapter) throw new NoPlayableAudioError();
  return {story: {...story, chapters: ordered}, chapter};
}
