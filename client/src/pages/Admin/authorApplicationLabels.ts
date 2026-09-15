import type { AuthorApplicationStatus } from '../../services/adminService';

export const AUTHOR_APPLICATION_STATUS_LABELS: Record<AuthorApplicationStatus, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Đã từ chối',
  CANCELLED: 'Đã hủy',
};

export const AUTHOR_APPLICATION_STATUS_CLASSES: Record<AuthorApplicationStatus, string> = {
  PENDING: 'bg-tertiary/20 text-tertiary',
  APPROVED: 'bg-primary/20 text-primary',
  REJECTED: 'bg-error/20 text-error',
  CANCELLED: 'bg-white/10 text-[#908fa0]',
};

export function formatApplicationDate(value: string | null | undefined): string {
  if (!value) return 'Không rõ';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Không rõ';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface ApiLikeError {
  status?: number;
  code?: string;
  message?: string;
}

/**
 * Translates a thrown API error into a safe, controlled Vietnamese message.
 * Never surfaces raw stack traces or token material.
 */
export function describeReviewError(error: unknown): string {
  const { status, message } = (error || {}) as ApiLikeError;

  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại bằng tài khoản quản trị.';
  if (status === 403) return 'Bạn không có quyền quản trị để thực hiện thao tác này.';
  if (status === 404) return 'Hồ sơ này không còn tồn tại. Danh sách sẽ được làm mới.';
  if (status === 409) return 'Hồ sơ này đã được xử lý trước đó. Danh sách sẽ được làm mới.';
  if (status === 422) return message || 'Dữ liệu gửi lên chưa hợp lệ.';
  if (typeof status === 'number' && status >= 500) return 'Máy chủ gặp sự cố. Vui lòng thử lại sau.';
  return message || 'Không thể hoàn tất thao tác. Vui lòng thử lại.';
}

/** True when the failure means the list/detail is stale and should be refreshed. */
export function isStaleReviewError(error: unknown): boolean {
  const { status } = (error || {}) as ApiLikeError;
  return status === 404 || status === 409;
}
