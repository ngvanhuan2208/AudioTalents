import { apiFetch, buildApiUrl } from './api';

export type ReviewStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'REVISION_REQUIRED';
export type StoryProgress = 'ONGOING' | 'COMPLETED' | 'PAUSED';
export type Visibility = 'PRIVATE' | 'PUBLIC' | 'UNLISTED';
export type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

export interface CreatorStory { id: string; title: string; description: string; cover?: string | null; genreIds?: string[]; genres?: string[]; tags?: string[]; status: StoryProgress; reviewStatus: ReviewStatus; visibility: Visibility; chapterCount?: number; updatedAt?: string; moderationNote?: string; }
export interface CreatorChapter { id: string; storyId: string; chapterNumber: number; title: string; content?: string; status: ReviewStatus; updatedAt?: string; moderationNote?: string; }
export interface CreatorAudio { id: string; chapterId: string; partNumber?: number | null; title: string; processingStatus: ProcessingStatus; status: ReviewStatus; isPrimary: boolean; sourceType: 'HUMAN' | 'AI' | 'HYBRID'; voiceType?: string | null; durationSec?: number | null; fileSize?: number | null; mimeType?: string | null; bitrate?: number | null; deletedAt?: string | null; createdAt?: string; updatedAt?: string; }
export interface CreatorGenre { id: string; name: string; slug: string; }
export interface CreatorTag { id: string; name: string; slug: string; isActive: boolean; }
export interface TaxonomyProposal { id: string; type: 'GENRE' | 'TAG'; proposedName: string; reason: string; storyId: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; reviewNote?: string; }
export interface UploadGrant { uploadUrl: string; method: string; headers: Record<string, string>; uploadToken: string; expiresAt?: string; }
export interface PlaybackCapability { playbackUrl: string; expiresAt: string; }
type ApiError = Error & { code?: string; status?: number };

export const mediaErrorMessage = (error: unknown) => {
  const code = (error as ApiError)?.code;
  const messages: Record<string, string> = {
    UPLOAD_SUPERSEDED: 'Bản tải lên này không còn là phiên bản mới nhất. Vui lòng tải lại trạng thái hiện tại.',
    MEDIA_NOT_READY: 'Audio chưa sẵn sàng cho thao tác này.',
    UNSUPPORTED_MEDIA: 'Định dạng file chưa được hỗ trợ.',
    MEDIA_TOO_LARGE: 'File vượt quá dung lượng cho phép.',
    MEDIA_TOO_LONG: 'Audio vượt quá 60 phút. Hãy chia nội dung thành các tập nhỏ hơn rồi chọn file khác.',
    OBJECT_VALIDATION_FAILED: 'File tải lên không hợp lệ.',
    STORAGE_UNAVAILABLE: 'Kho lưu trữ đang tạm thời không khả dụng. Vui lòng thử lại sau.',
    RESTORE_RETENTION_EXPIRED: 'Thời hạn khôi phục đã hết.',
    OBJECT_NOT_FOUND: 'Tệp Audio không còn khả dụng.',
    MEDIA_INTEGRITY_ERROR: 'Dữ liệu Audio không hợp lệ để thực hiện thao tác này.',
    INVALID_PLAYBACK_TOKEN: 'Phiên xem trước Audio không còn hợp lệ. Vui lòng phát lại.',
    PLAYBACK_EXPIRED: 'Phiên xem trước Audio đã hết hạn. Vui lòng phát lại.',
    FORBIDDEN: 'Bạn không còn quyền thực hiện thao tác này.',
    NOT_FOUND: 'Nội dung không còn khả dụng.',
    RESTORE_CONFLICT: 'Audio hiện không thể khôi phục.',
  };
  return messages[code || ''] || 'Không thể hoàn tất thao tác. Vui lòng thử lại.';
};

export const creatorService = {
  listStories: () => apiFetch<CreatorStory[]>('/stories/author/stories'),
  getStory: (id: string) => apiFetch<CreatorStory>(`/stories/author/stories/${encodeURIComponent(id)}`),
  createStory: (input: Pick<CreatorStory, 'title' | 'description'> & { genres: string[]; cover?: string; tags?: string[] }) => apiFetch<CreatorStory>('/stories/author/stories', { method: 'POST', body: JSON.stringify(input) }),
  updateStory: (id: string, input: Partial<CreatorStory> & { genres?: string[] }) => apiFetch<CreatorStory>(`/stories/author/stories/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteStory: (id: string) => apiFetch<void>(`/stories/author/stories/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  submitStory: (id: string) => apiFetch<CreatorStory>(`/stories/author/stories/${encodeURIComponent(id)}/submit`, { method: 'POST' }),
  listGenres: () => apiFetch<CreatorGenre[]>('/genres'),
  listTags: () => apiFetch<CreatorTag[]>('/tags'),
  createTaxonomyProposal: (input: {type: 'GENRE' | 'TAG'; proposedName: string; reason: string; storyId: string}) => apiFetch<TaxonomyProposal>('/taxonomy-proposals', {method: 'POST', body: JSON.stringify(input)}),
  listTaxonomyProposals: (storyId?: string) => apiFetch<TaxonomyProposal[]>(`/taxonomy-proposals${storyId ? `?storyId=${encodeURIComponent(storyId)}` : ''}`),
  listChapters: (storyId: string) => apiFetch<CreatorChapter[]>(`/stories/${encodeURIComponent(storyId)}/chapters`),
  createChapter: (storyId: string, input: { chapterNumber: number; title: string; content?: string }) => apiFetch<CreatorChapter>(`/stories/${encodeURIComponent(storyId)}/chapters`, { method: 'POST', body: JSON.stringify(input) }),
  updateChapter: (id: string, input: Partial<Pick<CreatorChapter, 'chapterNumber' | 'title' | 'content'>>) => apiFetch<CreatorChapter>(`/chapters/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteChapter: (id: string) => apiFetch<void>(`/chapters/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  submitChapter: (id: string) => apiFetch<CreatorChapter>(`/chapters/${encodeURIComponent(id)}/publish`, { method: 'POST' }),
  listAudio: (chapterId: string) => apiFetch<CreatorAudio[]>(`/audio?chapterId=${encodeURIComponent(chapterId)}`),
  listDeletedAudio: (chapterId: string) => apiFetch<CreatorAudio[]>(`/audio?chapterId=${encodeURIComponent(chapterId)}&deleted=true`),
  createAudio: (input: { chapterId: string; title?: string; sourceType?: 'HUMAN' | 'AI' | 'HYBRID'; voiceType?: string }) => apiFetch<CreatorAudio>('/audio', { method: 'POST', body: JSON.stringify(input) }),
  deleteAudio: (id: string) => apiFetch<void>(`/audio/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  restoreAudio: (id: string) => apiFetch<CreatorAudio>(`/audio/${encodeURIComponent(id)}/restore`, { method: 'POST' }),
  submitAudio: (id: string) => apiFetch<CreatorAudio>(`/audio/${encodeURIComponent(id)}/submit`, { method: 'POST' }),
  createUploadGrant: (audioId: string, file: File) => apiFetch<UploadGrant>(`/audio/${encodeURIComponent(audioId)}/upload-url`, { method: 'POST', body: JSON.stringify({ contentType: file.type, contentLength: file.size, filename: file.name }) }),
  confirmUpload: (audioId: string, uploadToken: string) => apiFetch<CreatorAudio>(`/audio/${encodeURIComponent(audioId)}/upload-confirm`, { method: 'POST', body: JSON.stringify({ uploadToken }) }),
  requestPlaybackCapability: async (audioId: string): Promise<PlaybackCapability> => {
    const capability = await apiFetch<PlaybackCapability>(`/audio/${encodeURIComponent(audioId)}/playback-capability`, { method: 'POST' });
    return {...capability, playbackUrl: buildApiUrl(capability.playbackUrl)};
  },
};

export async function uploadAudioDirect(grant: UploadGrant, file: File, signal?: AbortSignal) {
  // The exact server-issued header set is forwarded. Neither the URL nor the
  // short-lived capability is persisted outside this in-memory operation.
  const response = await fetch(grant.uploadUrl, { method: grant.method, headers: grant.headers, body: file, signal });
  if (!response.ok) throw new Error('DIRECT_UPLOAD_FAILED');
}
