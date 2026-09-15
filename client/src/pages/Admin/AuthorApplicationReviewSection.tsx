import React, { useCallback, useEffect, useState } from 'react';
import { adminService, type AuthorApplicationReview } from '../../services/adminService';
import { AuthorApplicationList } from './AuthorApplicationList';
import { AuthorApplicationDetailDrawer } from './AuthorApplicationDetailDrawer';
import { ReviewDecisionModal, type ReviewDecisionType } from './ReviewDecisionModal';
import { describeReviewError, isStaleReviewError } from './authorApplicationLabels';

const SUCCESS_MESSAGE_TIMEOUT_MS = 4000;

export const AuthorApplicationReviewSection: React.FC = () => {
  const [applications, setApplications] = useState<AuthorApplicationReview[]>([]);
  const [isListLoading, setIsListLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<AuthorApplicationReview | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [decision, setDecision] = useState<ReviewDecisionType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [decisionError, setDecisionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadList = useCallback(async () => {
    setIsListLoading(true);
    setListError('');
    try {
      setApplications(await adminService.listAuthorApplications());
    } catch (error) {
      setListError(describeReviewError(error));
      setApplications([]);
    } finally {
      setIsListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!successMessage) return;
    const timeout = window.setTimeout(() => setSuccessMessage(''), SUCCESS_MESSAGE_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  const closeDetail = useCallback(() => {
    setSelectedId(null);
    setSelectedApplication(null);
    setDetailError('');
    setIsDetailLoading(false);
  }, []);

  const openDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setSelectedApplication(null);
    setDetailError('');
    setIsDetailLoading(true);
    try {
      setSelectedApplication(await adminService.getAuthorApplication(id));
    } catch (error) {
      setDetailError(describeReviewError(error));
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  const openDecision = useCallback((type: ReviewDecisionType) => {
    setDecisionError('');
    setDecision(type);
  }, []);

  const resyncAfterStaleResult = useCallback(async (applicationId: string) => {
    await loadList();
    try {
      setSelectedApplication(await adminService.getAuthorApplication(applicationId));
    } catch {
      closeDetail();
    }
  }, [loadList, closeDetail]);

  const submitDecision = useCallback(async (reviewNote: string) => {
    if (!selectedApplication || !decision) return;
    const applicationId = selectedApplication.id;
    const decisionType = decision;
    setIsSubmitting(true);
    setDecisionError('');
    try {
      if (decisionType === 'approve') await adminService.approveAuthorApplication(applicationId, reviewNote);
      else await adminService.rejectAuthorApplication(applicationId, reviewNote);

      setDecision(null);
      closeDetail();
      setSuccessMessage(decisionType === 'approve' ? 'Đã duyệt hồ sơ tác giả.' : 'Đã từ chối hồ sơ tác giả.');
      await loadList();
    } catch (error) {
      setDecisionError(describeReviewError(error));
      if (isStaleReviewError(error)) {
        setDecision(null);
        await resyncAfterStaleResult(applicationId);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedApplication, decision, closeDetail, loadList, resyncAfterStaleResult]);

  const hasPending = applications.length > 0;

  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-[#1c2028] p-4 sm:p-6" aria-label="Hồ sơ tác giả chờ duyệt">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div className="flex items-center gap-2">
          <span className="rounded bg-tertiary/15 p-1 text-tertiary">
            <span className="material-symbols-outlined text-base leading-none" aria-hidden="true">how_to_reg</span>
          </span>
          <div>
            <h2 className="text-base font-bold text-[#dfe2ee]">Hồ sơ tác giả chờ duyệt</h2>
            <p className="text-[11px] text-[#908fa0]">Xem, duyệt hoặc từ chối đơn đăng ký quyền tác giả.</p>
          </div>
          <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-[#dfe2ee]">{applications.length}</span>
        </div>
        <button
          type="button"
          onClick={() => void loadList()}
          disabled={isListLoading}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#262a33] px-4 py-2 text-xs font-semibold text-[#dfe2ee] transition-colors hover:bg-[#31353e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c2028] disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-sm leading-none" aria-hidden="true">refresh</span>
          Làm mới
        </button>
      </div>

      {successMessage ? (
        <p role="status" aria-live="polite" className="mt-4 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-xs font-semibold text-primary">
          {successMessage}
        </p>
      ) : null}

      <div className="pt-2">
        {isListLoading ? (
          <p className="py-10 text-center text-sm text-[#908fa0]">Đang tải hồ sơ chờ duyệt...</p>
        ) : listError ? (
          <div className="py-8 text-center">
            <p role="alert" className="text-sm text-error">{listError}</p>
            <button
              type="button"
              onClick={() => void loadList()}
              className="mt-3 rounded-full bg-[#262a33] px-4 py-2 text-xs font-semibold text-[#dfe2ee] hover:bg-[#31353e]"
            >
              Thử lại
            </button>
          </div>
        ) : !hasPending ? (
          <p className="py-10 text-center text-sm text-[#908fa0]">Không có hồ sơ tác giả đang chờ duyệt.</p>
        ) : (
          <AuthorApplicationList applications={applications} selectedId={selectedId} onSelect={(id) => void openDetail(id)} />
        )}
      </div>

      <AuthorApplicationDetailDrawer
        application={selectedApplication}
        isLoading={isDetailLoading}
        loadError={detailError}
        isBusy={isSubmitting}
        onClose={closeDetail}
        onApprove={() => openDecision('approve')}
        onReject={() => openDecision('reject')}
      />

      <ReviewDecisionModal
        isOpen={Boolean(decision && selectedApplication)}
        decision={decision || 'approve'}
        applicantName={selectedApplication?.displayName || ''}
        isSubmitting={isSubmitting}
        error={decisionError}
        onClose={() => { if (!isSubmitting) setDecision(null); }}
        onSubmit={(note) => void submitDecision(note)}
      />
    </section>
  );
};
