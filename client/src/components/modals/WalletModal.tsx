import React from 'react';
import { IconButton } from '../ui/IconButton';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCoinsUpdated: (newCoins: number) => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, onCoinsUpdated }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#1c2028] border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary text-2xl">diamond</span>
            <h3 className="text-lg font-bold text-[#dfe2ee]">Ví AudioCoin (AC)</h3>
          </div>
          <IconButton label="Đóng ví AudioCoin" size="sm" onClick={onClose} className="text-[#908fa0] hover:bg-white/10 hover:text-[#dfe2ee]"><span className="material-symbols-outlined text-xl leading-none">close</span></IconButton>
        </div>

        {/* Current Balance */}
        <div className="my-5 p-4 rounded-2xl bg-gradient-to-r from-[#262a33] to-[#31353e] flex items-center justify-between">
          <div>
            <span className="text-xs text-[#908fa0]">Số dư khả dụng</span>
              <p className="text-sm font-bold text-[#908fa0]">Số dư chưa khả dụng</p>
          </div>
          <span className="p-3 rounded-xl bg-tertiary/15 text-tertiary">
            <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#262a33] border border-white/5 text-center text-sm text-[#908fa0]">AudioCoin và thanh toán chưa có trong Backend Contract.</div>
        <button type="button" onClick={onClose} className="w-full mt-4 py-2.5 rounded-full bg-[#262a33] text-[#dfe2ee] text-xs font-semibold">Đóng</button>
      </div>
    </div>
  );
};
