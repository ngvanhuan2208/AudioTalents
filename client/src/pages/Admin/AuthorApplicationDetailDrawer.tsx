import React from 'react';
import type { AuthorApplicationReview } from '../../services/adminService';
import { IconButton } from '../../components/ui/IconButton';
import {
  AUTHOR_APPLICATION_STATUS_CLASSES,
  AUTHOR_APPLICATION_STATUS_LABELS,
  formatApplicationDate,
} from './authorApplicationLabels';

interface AuthorApplicationDetailDrawerProps {
  application: AuthorApplicationReview | null;
  isLoading: boolean;
  loadError: string;
  isBusy: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
}

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#908fa0]">{label}</p>
    <div className="mt-1 text-sm text-[#dfe2ee]">{children}</div>
  </div>
);

export const AuthorApplicationDetailDrawer: React.FC<AuthorApplicationDetailDrawerProps> = ({
  application,
  isLoading,
  loadError,
  isBusy,
  onClose,
  onApprove,
  onReject,
}) => {
  if (!application && !isLoading && !loadError) return null;

  const displayName = application?.displayName || 'Hồ sơ tác giả';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Đóng chi tiết hồ sơ" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default bg-black/70 backdrop-blur-sm" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Chi tiết hồ sơ tác giả ${displayName}`}
        className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-white/10 bg-[#1c2028] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">Chi tiết hồ sơ tác giả</p>
            <h3 className="truncate text-lg font-bold text-[#dfe2ee]">{displayName}</h3>
          </div>
          <IconButton label="Đóng chi tiết hồ sơ" size="sm" onClick={onClose} className="text-[#908fa0] hover:bg-white/10 hover:text-[#dfe2ee]">
            <span className="material-symbols-outlined text-xl leading-none" aria-hidden="true">close</span>
          </IconButton>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-[#908fa0]">Đang tải hồ sơ...</p>
          ) : loadError ? (
            <p role="alert" className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{loadError}</p>
          ) : application ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${AUTHOR_APPLICATION_STATUS_CLASSES[application.status]}`}>
                  {AUTHOR_APPLICATION_STATUS_LABELS[application.status]}
                </span>
                <span className="break-all text-[11px] text-[#908fa0]">Mã hồ sơ: {application.id}</span>
              </div>

              <Field label="Bút danh">{application.displayName || 'Không có'}</Field>

              <Field label="Giới thiệu">
                <p className="whitespace-pre-wrap leading-relaxed text-[#c7c4d7]">{application.bio || 'Không có giới thiệu.'}</p>
              </Field>

              <Field label="Kinh nghiệm">
                <p className="whitespace-pre-wrap leading-relaxed text-[#c7c4d7]">{application.experience || 'Không cung cấp'}</p>
              </Field>

              <Field label="Loại nội dung dự kiến">
                {(application.contentTypes || []).length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {(application.contentTypes || []).map((type) => (
                      <li key={type} className="rounded-full bg-[#262a33] px-3 py-1 text-xs text-[#c7c4d7]">{type}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-[#908fa0]">Chưa chọn</span>
                )}
              </Field>

              <Field label="Thời điểm gửi">{formatApplicationDate(application.submittedAt || application.createdAt)}</Field>

              <Field label="Người nộp (ID hệ thống)">
                <span className="break-all font-mono text-xs text-[#908fa0]">{application.userId}</span>
              </Field>

              {application.reviewNote ? <Field label="Ghi chú duyệt trước đó">{application.reviewNote}</Field> : null}
            </div>
          ) : null}
        </div>

        <footer className="flex flex-col gap-2 border-t border-white/10 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onReject}
            disabled={isBusy || isLoading || !application || application.status !== 'PENDING'}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-error/40 bg-error/10 px-5 py-2.5 text-xs font-bold text-error transition-colors hover:bg-error/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c2028] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm leading-none" aria-hidden="true">block</span>
            Từ chối
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={isBusy || isLoading || !application || application.status !== 'PENDING'}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-on-primary transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c2028] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm leading-none" aria-hidden="true">verified</span>
            Duyệt
          </button>
        </footer>
      </aside>
    </div>
  );
};
