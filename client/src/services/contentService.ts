import { apiFetch, buildApiUrl, resolvePlaybackUrl } from './api';
import { Chapter, Comment, Genre, PlaybackAudioPart, Playlist, Story, UserPlayHistory } from '../types';

interface RawStory {
  id: string;
  slug: string;
  title: string;
  description?: string;
  synopsis?: string;
  cover?: string | null;
  creatorId?: string;
  author?: string;
  authorId?: string;
  narrator?: string;
  narratorGroup?: string;
  genres?: string[];
  tags?: string[];
  status?: string;
  rating?: number;
  ratingCount?: number;
  views?: number | string;
  listeners?: number | string;
  listens?: number | string;
  chapterCount?: number;
  chaptersCount?: number;
  duration?: number;
  totalAudioHours?: string;
  audioQuality?: string;
  hasAudio?: boolean;
  chapters?: RawChapter[];
}

interface RawChapter {
  id: string;
  storyId: string;
  chapterNumber?: number;
  index?: number;
  title: string;
  durationSec?: number;
  durationSeconds?: number;
  isVip?: boolean;
  coinPrice?: number;
  publishedAt?: string;
  narrator?: string;
  audioUrl?: string | null;
  content?: string;
  transcript?: Chapter['transcript'];
}

interface RawGenre {
  id: string;
  name: string;
  slug: string;
  description?: string;
  cover?: string | null;
  storyCount?: number;
  count?: number;
  audioCount?: number;
}

interface RawAudio {
  id?: string;
  partNumber?: number;
  durationSec?: number;
  audioUrl?: string;
}

export function orderedPlayableParts(audio: RawAudio[], apiBaseUrl = buildApiUrl('/')): PlaybackAudioPart[] {
  return audio.flatMap((item, serverOrder) => {
    const audioUrl = item.audioUrl && resolvePlaybackUrl(item.audioUrl, apiBaseUrl);
    if (!audioUrl) return [];
    const partNumber = Number.isInteger(item.partNumber) && Number(item.partNumber) > 0 ? item.partNumber : undefined;
    return [{id: item.id, partNumber, durationSec: item.durationSec, audioUrl, serverOrder}];
  }).sort((a, b) => {
    if (a.partNumber !== undefined && b.partNumber !== undefined) return a.partNumber - b.partNumber;
    if (a.partNumber !== undefined) return -1;
    if (b.partNumber !== undefined) return 1;
    return a.serverOrder - b.serverOrder;
  }).map(({serverOrder: _serverOrder, ...part}) => part);
}

function formatCount(value: number | string | undefined): string {
  if (value === undefined || value === null || value === '') return '0';
  if (typeof value === 'string') return value;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toString();
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function mapStatus(status?: string): Story['status'] {
  if (status === 'COMPLETED') return 'Hoàn thành';
  if (status === 'PAUSED') return 'Tạm dừng';
  return 'Đang ra';
}

export function mapChapter(raw: RawChapter): Chapter {
  const durationSec = Number(raw.durationSec ?? raw.durationSeconds ?? 0);
  return {
    id: raw.id,
    storyId: raw.storyId,
    index: raw.chapterNumber ?? raw.index ?? 0,
    title: raw.title,
    durationSec,
    durationFormatted: formatDuration(durationSec),
    isVip: Boolean(raw.isVip),
    coinPrice: raw.coinPrice,
    publishedAt: raw.publishedAt || '',
    narrator: raw.narrator,
    audioUrl: raw.audioUrl || undefined,
    content: raw.content || '',
    transcript: raw.transcript || [],
  };
}

export function mapStory(raw: RawStory): Story {
  const chapters = (raw.chapters || []).map(mapChapter);
  const duration = Number(raw.duration || 0);
  return {
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    author: raw.author || raw.creatorId || '',
    authorId: raw.authorId || raw.creatorId || '',
    narrator: raw.narrator || '',
    narratorGroup: raw.narratorGroup,
    cover: raw.cover || '',
    genres: raw.genres || [],
    tags: raw.tags || [],
    status: mapStatus(raw.status),
    description: raw.description || '',
    synopsis: raw.synopsis,
    rating: Number(raw.rating || 0),
    ratingCount: Number(raw.ratingCount || 0),
    views: formatCount(raw.views),
    listeners: formatCount(raw.listeners ?? raw.listens),
    chaptersCount: Number(raw.chapterCount ?? raw.chaptersCount ?? chapters.length),
    totalAudioHours: raw.totalAudioHours || (duration ? `${(duration / 3600).toFixed(1)}h` : '0h'),
    hasAudio: Boolean(raw.hasAudio),
    audioQuality: raw.audioQuality || '',
    chapters,
  };
}

export async function getStories(params: Record<string, string | number | undefined> = {}): Promise<Story[]> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const result = await apiFetch<{ items?: RawStory[] }>(`/stories${query.size ? `?${query}` : ''}`);
  return (result.items || []).map(mapStory);
}

export async function getStoryBySlug(slug: string): Promise<Story> {
  const raw = await apiFetch<RawStory>(`/stories/${encodeURIComponent(slug)}`);
  return mapStory(raw);
}

export async function getStoryById(id: string): Promise<Story> {
  const raw = await apiFetch<RawStory>(`/stories/id/${encodeURIComponent(id)}`);
  return mapStory(raw);
}

export async function getStoryChapters(storyId: string): Promise<Chapter[]> {
  const raw = await apiFetch<RawChapter[]>(`/stories/${encodeURIComponent(storyId)}/chapters`);
  return Promise.all(raw.map(async chapter => {
    const mapped = mapChapter(chapter);
    // Only the public Audio endpoint can authorize a playable source.
    const audioParts = orderedPlayableParts(await getPublicAudio(chapter.id));
    return {...mapped, audioParts, audioUrl: audioParts[0]?.audioUrl};
  }));
}

export async function getPublicAudio(chapterId: string): Promise<RawAudio[]> {
  return apiFetch<RawAudio[]>(`/chapters/${encodeURIComponent(chapterId)}/audio`);
}

export async function getGenres(): Promise<Genre[]> {
  const raw = await apiFetch<RawGenre[]>('/genres');
  return raw.map(genre => ({
    id: genre.id,
    name: genre.name,
    slug: genre.slug,
    icon: 'category',
    count: Number(genre.storyCount ?? genre.count ?? 0),
    audioCount: Number(genre.audioCount ?? 0),
    description: genre.description,
  }));
}

export async function searchStories(keyword: string, params: Record<string, string | number | undefined> = {}): Promise<Story[]> {
  const query = new URLSearchParams({ q: keyword });
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const result = await apiFetch<{ items?: RawStory[] }>(`/search?${query}`);
  return (result.items || []).map(mapStory);
}

export async function getComments(storyId: string): Promise<Comment[]> {
  const raw = await apiFetch<Array<{ id: string; userId?: string; text?: string; createdAt?: string }>>(`/stories/${encodeURIComponent(storyId)}/comments`);
  return raw.map(comment => ({
    id: comment.id,
    userName: comment.userId || '',
    userAvatar: '',
    userRealm: '',
    content: comment.text || '',
    createdAt: comment.createdAt,
    likes: 0,
  }));
}

export async function addComment(storyId: string, text: string) {
  return apiFetch(`/stories/${encodeURIComponent(storyId)}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function getRatings(storyId: string): Promise<{count: number; average: number}> {
  return apiFetch<{count: number; average: number}>(`/stories/${encodeURIComponent(storyId)}/rating`);
}

export async function toggleFavorite(storyId: string, active: boolean) {
  return apiFetch(`/library/favorites/${encodeURIComponent(storyId)}`, { method: active ? 'POST' : 'DELETE' });
}

export async function getLibrary(): Promise<Array<{ storyId: string }>> {
  return apiFetch<Array<{ storyId: string }>>('/library');
}

export async function getFavorites(): Promise<Array<{ storyId: string }>> {
  return apiFetch<Array<{ storyId: string }>>('/library/favorites');
}

export async function getHistory(): Promise<UserPlayHistory[]> {
  const items = await apiFetch<Array<Record<string, unknown>>>('/library/history');
  return items.map(item => ({
    storyId: String(item.storyId || ''),
    chapterId: String(item.chapterId || ''),
    chapterIndex: Number(item.chapterIndex || 0),
    chapterTitle: String(item.chapterTitle || ''),
    positionSec: Number(item.positionSeconds || item.positionSec || 0),
    durationSec: Number(item.durationSeconds || item.durationSec || 0),
    percent: Number(item.percent || 0),
    lastPlayedAt: String(item.updatedAt || item.createdAt || ''),
  }));
}

export async function getPlaylists(): Promise<Playlist[]> {
  return apiFetch<Playlist[]>('/playlists');
}

export async function createPlaylist(name: string): Promise<Playlist> {
  return apiFetch<Playlist>('/playlists', {
    method: 'POST',
    body: JSON.stringify({name}),
  });
}

export async function getNotifications() {
  return apiFetch<Array<{ id: string; title: string; message: string; readAt?: string | null; createdAt?: string }>>('/notifications');
}
