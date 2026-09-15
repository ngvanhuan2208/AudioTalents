import React, { useState } from 'react';
import { IconButton } from '../ui/IconButton';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  chapterTitle: string;
}

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, chapterTitle }) => {
  const [errorType, setErrorType] = useState<string>('Audio rè, mất tiếng');
  const [description, setDescription] = useState<string>('');
  const [submitted, setSubmitted] = useState<boolean>(false);

  if (!isOpen) return null;

  const errorTypes = [
    'Audio rè, mất tiếng',
    'Audio không khớp transcript',
    'Chương bị thiếu đoạn',
    'Sai số thứ tự chương',
    'Lỗi chính tả hoặc định dạng',
    'Khác'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setDescription('');
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#1c2028] border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-error text-xl">report_problem</span>
            <h3 className="text-base font-bold text-[#dfe2ee]">Báo Lỗi Chương Truyện</h3>
          </div>
          <IconButton label="Đóng báo lỗi" size="sm" onClick={onClose} className="text-[#908fa0] hover:bg-white/10 hover:text-[#dfe2ee]"><span className="material-symbols-outlined text-xl leading-none">close</span></IconButton>
        </div>

        <p className="text-xs text-[#908fa0] my-3">
          Tập đang phát: <span className="text-[#dfe2ee] font-medium">{chapterTitle}</span>
        </p>

        {submitted ? (
          <div className="py-6 text-center text-primary font-medium text-xs">
            ✓ Cảm ơn bạn! Đội ngũ kiểm duyệt âm thanh đã tiếp nhận báo cáo và sẽ khắc phục sớm nhất.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-[#c7c4d7] block mb-1 font-semibold">Loại lỗi:</label>
              <select
                value={errorType}
                onChange={e => setErrorType(e.target.value)}
                className="w-full bg-[#181c24] border border-white/10 rounded-xl px-3 py-2 text-xs text-[#dfe2ee] focus:outline-none focus:border-primary"
              >
                {errorTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-[#c7c4d7] block mb-1 font-semibold">Mô tả chi tiết (tùy chọn):</label>
              <textarea
                rows={3}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Ví dụ: Đoạn từ phút 03:20 bị ngắt tiếng..."
                className="w-full bg-[#181c24] border border-white/10 rounded-xl px-3 py-2 text-xs text-[#dfe2ee] focus:outline-none focus:border-primary resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full bg-[#262a33] text-[#c7c4d7] text-xs font-semibold hover:bg-[#31353e]"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-full bg-error text-on-error text-xs font-bold hover:brightness-110 active:scale-95 transition-all"
              >
                Gửi Báo Cáo
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
