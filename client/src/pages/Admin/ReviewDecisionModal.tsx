import React, { useEffect, useRef, useState } from 'react';
import { IconButton } from '../../components/ui/IconButton';

export type ReviewDecisionType = 'approve' | 'reject';

interface ReviewDecisionModalProps {
  isOpen: boolean;
  decision: ReviewDecisionType;
  applicantName: string;
  isSubmitting: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (reviewNote: string) => void;
}

export const ReviewDecisionModal: React.FC<ReviewDecisionModalProps> = ({
  isOpen,
  decision,
  applicantName,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}) => {
  const [reviewNote, setReviewNote] = useState('');
  const [validationError, setValidationError] = useState('');
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setReviewNote('');
    setValidationError('');
    noteRef.current?.focus();
  }, [isOpen, decision]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const isReject = decision === 'reject';

  const handleConfirm = (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (isReject && !reviewNote.trim()) {
      setValidationError('Vui lòng nhập lý do từ chối hồ sơ.');
      return;
    }
    setValidationError('');
    onSubmit(reviewNote.trim());
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <form
        onSubmit={handleConfirm}
        role="dialog"
        aria-modal="true"
        aria-label={isReject ? 'Từ chối hồ sơ tác giả' : 'Duyệt hồ sơ tác giả'}
        className="w-full max-w-md rounded-3xl border border-white/10 bg-[#1c2028] p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base font-bold text-[#dfe2ee]">{isReject ? 'Từ chối hồ sơ tác giả' : 'Duyệt hồ sơ tác giả'}</h3>
            <p className="mt-1 text-xs text-[#908fa0]">
              {isReject ? 'Hồ sơ này sẽ bị từ chối.' : 'Hồ sơ này sẽ được cấp quyền tác giả.'}
            </p>
          </div>
          <IconButton label="Đóng xác nhận" size="sm" onClick={onClose} disabled={isSubmitting} className="text-[#908fa0] hover:bg-white/10 hover:text-[#dfe2ee]">
            <span className="material-symbols-outlined text-xl leading-none" aria-hidden="true">close</span>
          </IconButton>
        </div>

        <p className="my-3 text-xs text-[#c7c4d7]">
          Bút danh: <span className="font-semibold text-[#dfe2ee]">{applicantName || 'Hồ sơ tác giả'}</span>
        </p>

        <div className="space-y-2">
          <label htmlFor="review-note" className="block text-xs font-semibold text-[#c7c4d7]">
            Lý do {isReject ? '(bắt buộc)' : '(không bắt buộc)'}
          </label>
          <textarea
            id="review-note"
            ref={noteRef}
            rows={4}
            value={reviewNote}
            onChange={(event) => { setReviewNote(event.target.value); if (validationError) setValidationError(''); }}
            disabled={isSubmitting}
            aria-required={isReject}
            aria-invalid={Boolean(validationError)}
            placeholder={isReject ? 'Nêu rõ lý do từ chối để người nộp hiểu...' : 'Ghi chú nội bộ khi duyệt (không bắt buộc)...'}
            className="w-full resize-none rounded-xl border border-white/10 bg-[#181c24] px-3 py-2 text-sm text-[#dfe2ee] outline-none focus:border-primary disabled:opacity-60"
          />
          {validationError ? <p role="alert" className="text-xs text-error">{validationError}</p> : null}
          {error ? <p role="alert" className="rounded-xl border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">{error}</p> : null}
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-full bg-[#262a33] px-4 py-2.5 text-xs font-semibold text-[#c7c4d7] hover:bg-[#31353e] disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`rounded-full px-5 py-2.5 text-xs font-bold transition-transform hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 ${isReject ? 'bg-error text-on-error' : 'bg-primary text-on-primary'}`}
          >
            {isSubmitting ? 'Đang xử lý...' : isReject ? 'Xác nhận từ chối' : 'Xác nhận duyệt'}
          </button>
        </div>
      </form>
    </div>
  );
};
