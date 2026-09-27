import {apiFetch} from './api';
import {
  audioService,
  mediaErrorMessage,
  uploadAudioDirect,
  type AudioAsset,
  type PlaybackCapability,
  type ProcessingStatus,
  type UploadGrant,
} from './audioService';

export type ReviewStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'REVISION_REQUIRED';
export type StoryProgress = 'ONGOING' | 'COMPLETED' | 'PAUSED';
export type Visibility = 'PRIVATE' | 'PUBLIC' | 'UNLISTED';

export interface CreatorStory {
  id: string;
  title: string;
  description: string;
  cover?: string | null;
  genreIds?: string[];
  genres?: string[];
  tags?: string[];
  status: StoryProgress;
  reviewStatus: ReviewStatus;
  visibility: Visibility;
  chapterCount?: number;
  updatedAt?: string;
  moderationNote?: string;
}

export interface CreatorChapter {
  id: string;
  storyId: string;
  chapterNumber: number;
  title: string;
  content?: string;
  status: ReviewStatus;
  updatedAt?: string;
  moderationNote?: string;
}

export type CreatorAudio = AudioAsset;
export interface CreatorGenre { id: string; name: string; slug: string; }
export interface CreatorTag { id: string; name: string; slug: string; isActive: boolean; }
export interface TaxonomyProposal {
  id: string;
  type: 'GENRE' | 'TAG';
  proposedName: string;
  reason: string;
  storyId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNote?: string;
}

export type {PlaybackCapability, ProcessingStatus, UploadGrant};
export {mediaErrorMessage, uploadAudioDirect};

export const creatorService = {
  listStories: () => apiFetch<CreatorStory[]>('/stories/author/stories'),
  getStory: (id: string) => apiFetch<CreatorStory>(`/stories/author/stories/${encodeURIComponent(id)}`),
  createStory: (input: Pick<CreatorStory, 'title' | 'description'> & {genres: string[]; cover?: string; tags?: string[]}) =>
    apiFetch<CreatorStory>('/stories/author/stories', {method: 'POST', body: JSON.stringify(input)}),
  updateStory: (id: string, input: Partial<CreatorStory> & {genres?: string[]}) =>
    apiFetch<CreatorStory>(`/stories/author/stories/${encodeURIComponent(id)}`, {method: 'PATCH', body: JSON.stringify(input)}),
  deleteStory: (id: string) => apiFetch<void>(`/stories/author/stories/${encodeURIComponent(id)}`, {method: 'DELETE'}),
  submitStory: (id: string) => apiFetch<CreatorStory>(`/stories/author/stories/${encodeURIComponent(id)}/submit`, {method: 'POST'}),
  listGenres: () => apiFetch<CreatorGenre[]>('/genres'),
  listTags: () => apiFetch<CreatorTag[]>('/tags'),
  createTaxonomyProposal: (input: {type: 'GENRE' | 'TAG'; proposedName: string; reason: string; storyId: string}) =>
    apiFetch<TaxonomyProposal>('/taxonomy-proposals', {method: 'POST', body: JSON.stringify(input)}),
  listTaxonomyProposals: (storyId?: string) =>
    apiFetch<TaxonomyProposal[]>(`/taxonomy-proposals${storyId ? `?storyId=${encodeURIComponent(storyId)}` : ''}`),
  listChapters: (storyId: string) => apiFetch<CreatorChapter[]>(`/stories/${encodeURIComponent(storyId)}/chapters`),
  createChapter: (storyId: string, input: {chapterNumber: number; title: string; content?: string}) =>
    apiFetch<CreatorChapter>(`/stories/${encodeURIComponent(storyId)}/chapters`, {method: 'POST', body: JSON.stringify(input)}),
  updateChapter: (id: string, input: Partial<Pick<CreatorChapter, 'chapterNumber' | 'title' | 'content'>>) =>
    apiFetch<CreatorChapter>(`/chapters/${encodeURIComponent(id)}`, {method: 'PATCH', body: JSON.stringify(input)}),
  deleteChapter: (id: string) => apiFetch<void>(`/chapters/${encodeURIComponent(id)}`, {method: 'DELETE'}),
  submitChapter: (id: string) => apiFetch<CreatorChapter>(`/chapters/${encodeURIComponent(id)}/publish`, {method: 'POST'}),
  listAudio: audioService.listByChapter,
  listDeletedAudio: audioService.listDeletedByChapter,
  createAudio: audioService.create,
  deleteAudio: audioService.delete,
  restoreAudio: audioService.restore,
  submitAudio: audioService.submit,
  createUploadGrant: audioService.createUploadGrant,
  confirmUpload: audioService.confirmUpload,
  requestPlaybackCapability: audioService.requestPlaybackCapability,
};
