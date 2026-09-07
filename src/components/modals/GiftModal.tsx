import React, { useState } from 'react';
import { storageService } from '../../services/storageService';

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
  const [selectedGift, setSelectedGift] = useState<number>(50);
  const [message, setMessage] = useState<string>('Tác giả viết hay quá, diễn đọc xuất sắc!');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentCoins = storageService.getCoins();

  const gifts = [
    { id: 1, name: 'Tách Cà Phê', coins: 20, icon: 'coffee' },
    { id: 2, name: 'Linh Thảo Tiên', coins: 50, icon: 'spa' },
    { id: 3, name: 'Hỗn Độn Ngọc', coins: 200, icon: 'diamond' },
    { id: 4, name: 'Thần Vương Miện', coins: 500, icon: 'crown' },
  ];

  const handleSend = () => {
    if (currentCoins < selectedGift) {
      setError('Số dư AudioCoin không đủ! Vui lòng nạp thêm.');
      return;
    }
    const successDeduct = storageService.deductCoins(selectedGift);
    if (successDeduct) {
      // Award cultivation XP to user for gifting
      storageService.addUserXp(selectedGift * 5);
      const newBal = storageService.getCoins();
      onCoinsUpdated(newBal);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#1c2028] border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary text-2xl">redeem</span>
            <h3 className="text-lg font-bold text-[#dfe2ee]">Tặng Quà Tác Giả & Voice Talent</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-[#908fa0] hover:text-[#dfe2ee]"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="py-3">
          <p className="text-xs text-[#908fa0]">
            Tiếp sức cho tác giả <span className="text-[#dfe2ee] font-bold">{authorName}</span> của tác phẩm{' '}
            <span className="text-primary font-medium">"{storyTitle}"</span>
          </p>
        </div>

        {/* Gift Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {gifts.map(g => {
            const isSelected = selectedGift === g.coins;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setSelectedGift(g.coins);
                  setError('');
                }}
                className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 transition-all ${
                  isSelected
                    ? 'border-tertiary bg-tertiary/15 text-[#dfe2ee]'
                    : 'border-white/5 bg-[#181c24] text-[#c7c4d7] hover:bg-[#262a33]'
                }`}
              >
                <span className="material-symbols-outlined text-3xl text-tertiary">{g.icon}</span>
                <span className="text-xs font-semibold">{g.name}</span>
                <span className="text-xs font-bold text-tertiary font-mono">{g.coins} AC</span>
              </button>
            );
          })}
        </div>

        {/* Message */}
        <div className="mb-4">
          <label className="text-xs text-[#908fa0] block mb-1">Lời nhắn gửi:</label>
          <input
            type="text"
            value={message}
            onChange={e => setMessage(e.target.value)}
            className="w-full bg-[#181c24] border border-white/10 rounded-xl px-3 py-2 text-xs text-[#dfe2ee] focus:outline-none focus:border-tertiary"
          />
        </div>

        {error && (
          <p className="text-xs text-error mb-3 text-center">{error}</p>
        )}

        {success ? (
          <div className="p-3 rounded-xl bg-tertiary/20 text-tertiary text-center text-xs font-bold">
            ✓ Đã gửi quà thành công! Bạn nhận được +{selectedGift * 5} XP Tu Vi.
          </div>
        ) : (
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <span className="text-xs text-[#908fa0]">
              Số dư: <span className="font-mono text-tertiary font-bold">{currentCoins} AC</span>
            </span>
            <button
              type="button"
              onClick={handleSend}
              className="px-5 py-2 rounded-full bg-gradient-to-r from-tertiary to-tertiary-container text-on-tertiary text-xs font-bold shadow-md hover:brightness-110 active:scale-95 transition-all"
            >
              Gửi Tặng ({selectedGift} AC)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
