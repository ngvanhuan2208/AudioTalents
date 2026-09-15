import React from 'react';
import { IconButton } from '../ui/IconButton';

interface GiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  storyTitle: string;
  authorName: string;
  onCoinsUpdated: (balance: number) => void;
}

export const GiftModal: React.FC<GiftModalProps> = ({
  isOpen,
  onClose,
  storyTitle,
  authorName,
  onCoinsUpdated
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#1c2028] border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary text-2xl">redeem</span>
            <h3 className="text-lg font-bold text-[#dfe2ee]">Tặng Quà Tác Giả & Voice Talent</h3>
          </div>
          <IconButton label="Đóng tặng quà" size="sm" onClick={onClose} className="text-[#908fa0] hover:bg-white/10 hover:text-[#dfe2ee]"><span className="material-symbols-outlined text-xl leading-none">close</span></IconButton>
        </div>

        <div className="py-3">
          <p className="text-xs text-[#908fa0]">
            Tiếp sức cho tác giả <span className="text-[#dfe2ee] font-bold">{authorName}</span> của tác phẩm{' '}
            <span className="text-primary font-medium">"{storyTitle}"</span>
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#262a33] border border-white/5 text-center text-sm text-[#908fa0]">Tính năng tặng quà và AudioCoin chưa có trong Backend Contract.</div>
        <button type="button" onClick={onClose} className="w-full mt-4 py-2.5 rounded-full bg-[#262a33] text-[#dfe2ee] text-xs font-semibold">Đóng</button>
      </div>
    </div>
  );
};
