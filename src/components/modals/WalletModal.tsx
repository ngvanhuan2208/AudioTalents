import React, { useState } from 'react';
import { storageService } from '../../services/storageService';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCoinsUpdated: (newCoins: number) => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, onCoinsUpdated }) => {
  const [selectedPackage, setSelectedPackage] = useState<number>(300);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');

  if (!isOpen) return null;

  const currentCoins = storageService.getCoins();

  const packages = [
    { coins: 100, price: '20.000đ', bonus: '' },
    { coins: 300, price: '50.000đ', bonus: '+30 AC Tặng thêm', popular: true },
    { coins: 700, price: '100.000đ', bonus: '+100 AC Tặng thêm' },
    { coins: 1500, price: '200.000đ', bonus: '+300 AC Siêu ưu đãi' },
  ];

  const handlePurchase = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const bonusMap: Record<number, number> = { 100: 0, 300: 30, 700: 100, 1500: 300 };
      const totalToAdd = selectedPackage + (bonusMap[selectedPackage] || 0);
      const newBalance = storageService.addCoins(totalToAdd);
      onCoinsUpdated(newBalance);
      setIsProcessing(false);
      setSuccessMsg(`Nạp thành công ${totalToAdd.toLocaleString()} AudioCoin vào ví!`);
      setTimeout(() => {
        setSuccessMsg('');
        onClose();
      }, 1500);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#1c2028] border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary text-2xl">diamond</span>
            <h3 className="text-lg font-bold text-[#dfe2ee]">Ví AudioCoin (AC)</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-[#908fa0] hover:text-[#dfe2ee]"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Current Balance */}
        <div className="my-5 p-4 rounded-2xl bg-gradient-to-r from-[#262a33] to-[#31353e] flex items-center justify-between">
          <div>
            <span className="text-xs text-[#908fa0]">Số dư khả dụng</span>
            <p className="text-2xl font-black text-tertiary-fixed font-mono">
              {currentCoins.toLocaleString()} AC
            </p>
          </div>
          <span className="p-3 rounded-xl bg-tertiary/15 text-tertiary">
            <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
          </span>
        </div>

        {successMsg ? (
          <div className="p-4 rounded-2xl bg-primary/20 border border-primary text-center text-sm font-semibold text-primary">
            ✓ {successMsg}
          </div>
        ) : (
          <>
            <p className="text-xs text-[#c7c4d7] mb-3 font-semibold">Chọn gói nạp xu:</p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {packages.map(pkg => {
                const isSelected = selectedPackage === pkg.coins;
                return (
                  <button
                    key={pkg.coins}
                    type="button"
                    onClick={() => setSelectedPackage(pkg.coins)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all relative ${
                      isSelected
                        ? 'border-tertiary bg-tertiary/10 text-[#dfe2ee] shadow-sm'
                        : 'border-white/5 bg-[#181c24] hover:bg-[#262a33] text-[#c7c4d7]'
                    }`}
                  >
                    {pkg.popular && (
                      <span className="absolute -top-2 right-2 px-1.5 py-0.5 rounded bg-tertiary text-on-tertiary text-[9px] font-bold">
                        HOT
                      </span>
                    )}
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-tertiary text-base">diamond</span>
                      <span className="text-sm font-bold font-mono">{pkg.coins} AC</span>
                    </div>
                    <span className="text-xs font-semibold text-[#dfe2ee] mt-1">{pkg.price}</span>
                    {pkg.bonus && (
                      <span className="text-[10px] text-tertiary font-medium">{pkg.bonus}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-full bg-[#262a33] hover:bg-[#31353e] text-[#dfe2ee] text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handlePurchase}
                className="flex-1 py-2.5 rounded-full bg-gradient-to-r from-tertiary to-tertiary-container text-on-tertiary text-xs font-bold shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
              >
                {isProcessing ? 'Đang xử lý...' : 'Xác nhận nạp'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
