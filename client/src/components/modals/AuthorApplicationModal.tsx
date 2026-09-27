import React, { useState } from 'react';
import { authStorage, buildApiUrl } from '../../services/api';
import { IconButton } from '../ui/IconButton';

interface AuthorApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: (message: string) => void | Promise<void>;
}

export const AuthorApplicationModal: React.FC<AuthorApplicationModalProps> = ({ isOpen, onClose, onSubmitted }) => {
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [copyrightAgreement, setCopyrightAgreement] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const token = authStorage.getAccessToken();
    if (!token) {
      setError('Vui lòng đăng nhập trước khi đăng ký quyền tác giả.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch(buildApiUrl('/author-applications'), {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
        body: JSON.stringify({displayName, bio, copyrightAgreement}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Không thể gửi đơn đăng ký.');
      await onSubmitted('Đơn đăng ký quyền tác giả đã được gửi và đang chờ xét duyệt.');
      onClose();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Không thể gửi đơn đăng ký.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-[#1c2028] border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h3 className="text-lg font-bold text-[#dfe2ee]">Đăng ký quyền tác giả</h3>
            <p className="text-[11px] text-[#908fa0] mt-1">Đơn đăng ký sẽ được Admin xét duyệt.</p>
          </div>
          <IconButton label="Đóng đăng ký tác giả" size="sm" onClick={onClose} className="text-[#908fa0] hover:bg-white/10 hover:text-[#dfe2ee]"><span className="material-symbols-outlined text-xl leading-none">close</span></IconButton>
        </div>
        <div className="space-y-4 py-5">
          <label className="block text-xs text-[#c7c4d7]">
            Bút danh
            <input required value={displayName} onChange={event => setDisplayName(event.target.value)} className="mt-1.5 w-full rounded-xl bg-[#262a33] border border-white/10 px-3 py-2.5 text-sm text-[#dfe2ee] outline-none focus:border-primary/60" />
          </label>
          <label className="block text-xs text-[#c7c4d7]">
            Giới thiệu
            <textarea required value={bio} onChange={event => setBio(event.target.value)} rows={4} className="mt-1.5 w-full rounded-xl bg-[#262a33] border border-white/10 px-3 py-2.5 text-sm text-[#dfe2ee] outline-none focus:border-primary/60 resize-none" />
          </label>
          <label className="flex items-start gap-2 text-xs text-[#c7c4d7]">
            <input type="checkbox" checked={copyrightAgreement} onChange={event => setCopyrightAgreement(event.target.checked)} className="mt-0.5 accent-primary" />
            Tôi cam kết nội dung đăng tải tôn trọng bản quyền.
          </label>
          {error && <p role="alert" className="text-xs text-error">{error}</p>}
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-full bg-[#262a33] text-[#dfe2ee] text-xs font-semibold">Hủy</button>
          <button type="submit" disabled={isSubmitting || !copyrightAgreement} className="flex-1 py-2.5 rounded-full bg-primary text-on-primary text-xs font-bold disabled:opacity-50">{isSubmitting ? 'Đang gửi...' : 'Gửi đơn đăng ký'}</button>
        </div>
      </form>
    </div>
  );
};
