import {apiFetch, buildApiUrl} from './api';

export type ReviewStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'REVISION_REQUIRED';
export type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

export interface AudioAsset {
  id: string;
  chapterId: string;
  partNumber?: number | null;
  title: string;
  processingStatus: ProcessingStatus;
  status: ReviewStatus;
  isPrimary: boolean;
  sourceType: 'HUMAN' | 'AI' | 'HYBRID';
  voiceType?: string | null;
  durationSec?: number | null;
  fileSize?: number | null;
  mimeType?: string | null;
  bitrate?: number | null;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UploadGrant {
  uploadUrl: string;
  method: string;
  headers: Record<string, string>;
  uploadToken: string;
  expiresAt?: string;
}

export interface PlaybackCapability {
  playbackUrl: string;
  expiresAt: string;
}

type ApiError = Error & {code?: string; status?: number};

export const mediaErrorMessage = (error: unknown) => {
  const code = (error as ApiError)?.code;
  const messages: Record<string, string> = {
    UPLOAD_SUPERSEDED: 'Bản tải lên này không còn là phiên bản mới nhất. Vui lòng tải lại trạng thái hiện tại.',
    MEDIA_NOT_READY: 'Audio chưa sẵn sàng cho thao tác này.',
    UNSUPPORTED_MEDIA: 'Định dạng file chưa được hỗ trợ.',
    MEDIA_TOO_LARGE: 'File vượt quá dung lượng cho phép.',
    MEDIA_TOO_LONG: 'Audio vượt quá 60 phút. Hãy chia nội dung thành các tập nhỏ hơn rồi chọn file khác.',
    OBJECT_VALIDATION_FAILED: 'File tải lên không hợp lệ.',
    DIRECT_UPLOAD_FAILED: 'Kho lưu trữ từ chối file tải lên. Vui lòng thử lại.',
    STORAGE_CONFIGURATION_ERROR: 'Kho lưu trữ chưa được cấu hình cho môi trường này.',
    STORAGE_UNAVAILABLE: 'Kho lưu trữ đang tạm thời không khả dụng. Vui lòng thử lại sau.',
    AUTHOR_NOT_APPROVED: 'Tài khoản chưa được duyệt quyền Creator.',
    AUDIO_NOT_OWNED: 'Bạn không sở hữu Audio này.',
    UPLOAD_CONFLICT: 'Audio hiện không ở trạng thái có thể tải file. Vui lòng tải lại trang.',
    CHAPTER_CONTEXT_REQUIRED: 'Hãy chọn một Chapter hợp lệ trước khi tải Audio.',
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

export const audioService = {
  listByChapter: (chapterId: string) => apiFetch<AudioAsset[]>(`/audio?chapterId=${encodeURIComponent(chapterId)}`),
  listDeletedByChapter: (chapterId: string) => apiFetch<AudioAsset[]>(`/audio?chapterId=${encodeURIComponent(chapterId)}&deleted=true`),
  create: (input: {chapterId: string; title?: string; sourceType?: 'HUMAN' | 'AI' | 'HYBRID'; voiceType?: string}) =>
    apiFetch<AudioAsset>('/audio', {method: 'POST', body: JSON.stringify(input)}),
  delete: (id: string) => apiFetch<void>(`/audio/${encodeURIComponent(id)}`, {method: 'DELETE'}),
  restore: (id: string) => apiFetch<AudioAsset>(`/audio/${encodeURIComponent(id)}/restore`, {method: 'POST'}),
  submit: (id: string) => apiFetch<AudioAsset>(`/audio/${encodeURIComponent(id)}/submit`, {method: 'POST'}),
  createUploadGrant: (audioId: string, file: File) => apiFetch<UploadGrant>(`/audio/${encodeURIComponent(audioId)}/upload-url`, {
    method: 'POST',
    body: JSON.stringify({contentType: file.type, contentLength: file.size, filename: file.name}),
  }),
  confirmUpload: (audioId: string, uploadToken: string) => apiFetch<AudioAsset>(`/audio/${encodeURIComponent(audioId)}/upload-confirm`, {
    method: 'POST',
    body: JSON.stringify({uploadToken}),
  }),
  requestPlaybackCapability: async (audioId: string): Promise<PlaybackCapability> => {
    const capability = await apiFetch<PlaybackCapability>(`/audio/${encodeURIComponent(audioId)}/playback-capability`, {method: 'POST'});
    return {...capability, playbackUrl: buildApiUrl(capability.playbackUrl)};
  },
};

export async function uploadAudioDirect(grant: UploadGrant, file: File, signal?: AbortSignal) {
  const response = await fetch(grant.uploadUrl, {method: grant.method, headers: grant.headers, body: file, signal});
  if (!response.ok) {
    const error = new Error('DIRECT_UPLOAD_FAILED') as ApiError;
    error.code = 'DIRECT_UPLOAD_FAILED';
    error.status = response.status;
    throw error;
  }
}
