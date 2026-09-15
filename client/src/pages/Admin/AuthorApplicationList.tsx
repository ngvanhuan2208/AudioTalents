import React from 'react';
import type { AuthorApplicationReview } from '../../services/adminService';
import {
  AUTHOR_APPLICATION_STATUS_CLASSES,
  AUTHOR_APPLICATION_STATUS_LABELS,
  formatApplicationDate,
} from './authorApplicationLabels';

interface AuthorApplicationListProps {
  applications: AuthorApplicationReview[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const AuthorApplicationList: React.FC<AuthorApplicationListProps> = ({ applications, selectedId, onSelect }) => {
  return (
    <ul className="divide-y divide-white/5" aria-label="Danh sách hồ sơ tác giả chờ duyệt">
      {applications.map((application) => {
        const isSelected = application.id === selectedId;
        return (
          <li key={application.id}>
            <div
              className={`flex flex-col gap-3 p-3 transition-colors sm:p-4 md:flex-row md:items-center md:justify-between ${isSelected ? 'bg-primary/10' : 'hover:bg-white/[0.04]'}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-[#dfe2ee]">{application.displayName || 'Không có bút danh'}</p>
                  <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold ${AUTHOR_APPLICATION_STATUS_CLASSES[application.status]}`}>
                    {AUTHOR_APPLICATION_STATUS_LABELS[application.status]}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-[#908fa0]">{application.bio || 'Không có giới thiệu.'}</p>
                <p className="mt-1 text-[11px] text-[#908fa0]">Gửi lúc: {formatApplicationDate(application.submittedAt || application.createdAt)}</p>
              </div>

              <button
                type="button"
                onClick={() => onSelect(application.id)}
                aria-label={`Xem chi tiết hồ sơ của ${application.displayName || 'hồ sơ này'}`}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-full border border-white/10 bg-[#262a33] px-4 py-2 text-xs font-semibold text-[#dfe2ee] transition-colors hover:bg-[#31353e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c2028] md:self-auto"
              >
                <span className="material-symbols-outlined text-sm leading-none" aria-hidden="true">visibility</span>
                Xem chi tiết
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
};
