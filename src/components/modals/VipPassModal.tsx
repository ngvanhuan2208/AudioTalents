import React, { useState } from 'react';
import { storageService } from '../../services/storageService';

interface VipPassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const VipPassModal: React.FC<VipPassModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [selectedPlan, setSelectedPlan] = useState<'month' | 'quarter' | 'year'>('month');
  const [isSubscribing, setIsSubscribing] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const isAlreadyVip = storageService.isVip();

  const handleSubscribe = () => {
    setIsSubscribing(true);
    setTimeout(() => {
      storageService.setVip(true);
      storageService.addCoins(500); // monthly bonus
      setIsSubscribing(false);
      setSuccess(true);
      onSuccess();
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#1c2028] border border-white/10 rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-tertiary-container text-on-tertiary">
              <span className="material-symbols-outlined text-xl">workspace_premium</span>
            </span>
            <h3 className="text-lg font-bold text-[#dfe2ee]">Thần Vương VIP PASS</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-[#908fa0] hover:text-[#dfe2ee]"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Hero Perks */}
        <div className="my-5 p-4 rounded-2xl bg-gradient-to-br from-tertiary/10 via-[#262a33] to-[#1c2028] border border-tertiary/20">
          <div className="flex items-center justify-between pb-3">
            <div>
              <span className="text-[11px] text-tertiary font-bold uppercase tracking-wider">
                Đặc quyền thính giác không giới hạn
              </span>
              <h4 className="text-xl font-black text-[#dfe2ee] mt-0.5">
                Trở thành Thần Vương Hội Viên
              </h4>
            </div>
            <span className="material-symbols-outlined text-4xl text-tertiary">diamond</span>
          </div>

          <div className="space-y-2 text-xs text-[#c7c4d7]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-tertiary text-base">check_circle</span>
              <span>Nghe không giới hạn toàn bộ hơn 50.000 chương truyện VIP</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-tertiary text-base">check_circle</span>
              <span>Tặng 500 AudioCoin mỗi tháng để ủng hộ tác giả yêu thích</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-tertiary text-base">check_circle</span>
              <span>Âm thanh chuẩn phòng thu 8D Lossless và tải nghe ngoại tuyến</span>
            </div>
          </div>
        </div>

        {/* Plan Selector */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <button
            type="button"
            onClick={() => setSelectedPlan('month')}
            className={`p-3 rounded-2xl border text-center transition-all ${
              selectedPlan === 'month'
                ? 'border-tertiary bg-tertiary/15 text-[#dfe2ee]'
                : 'border-white/5 bg-[#181c24] text-[#c7c4d7]'
            }`}
          >
            <span className="text-xs font-semibold block">1 Tháng</span>
            <span className="text-sm font-bold text-tertiary font-mono block mt-1">69.000đ</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedPlan('quarter')}
            className={`p-3 rounded-2xl border text-center transition-all relative ${
              selectedPlan === 'quarter'
                ? 'border-tertiary bg-tertiary/15 text-[#dfe2ee]'
                : 'border-white/5 bg-[#181c24] text-[#c7c4d7]'
            }`}
          >
            <span className="absolute -top-2 right-2 px-1 rounded bg-tertiary text-on-tertiary text-[9px] font-bold">
              -15%
            </span>
            <span className="text-xs font-semibold block">3 Tháng</span>
            <span className="text-sm font-bold text-tertiary font-mono block mt-1">179.000đ</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedPlan('year')}
            className={`p-3 rounded-2xl border text-center transition-all relative ${
              selectedPlan === 'year'
                ? 'border-tertiary bg-tertiary/15 text-[#dfe2ee]'
                : 'border-white/5 bg-[#181c24] text-[#c7c4d7]'
            }`}
          >
            <span className="absolute -top-2 right-2 px-1 rounded bg-primary text-on-primary text-[9px] font-bold">
              HOT
            </span>
            <span className="text-xs font-semibold block">12 Tháng</span>
            <span className="text-sm font-bold text-tertiary font-mono block mt-1">599.000đ</span>
          </button>
        </div>

        {success ? (
          <div className="p-4 rounded-2xl bg-tertiary/20 border border-tertiary text-center text-sm font-semibold text-tertiary">
            ✓ Đăng ký thành công Thần Vương VIP Pass! Bạn đã được cộng thêm 500 AC.
          </div>
        ) : (
          <button
            type="button"
            disabled={isSubscribing}
            onClick={handleSubscribe}
            className="w-full py-3 rounded-full bg-gradient-to-r from-tertiary to-tertiary-container text-on-tertiary text-sm font-bold shadow-[0_0_20px_-4px_rgba(255,185,95,0.4)] hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
          >
            {isSubscribing ? 'Đang kích hoạt VIP...' : isAlreadyVip ? 'Gia hạn gói Thần Vương VIP' : 'Kích Hoạt VIP Ngay'}
          </button>
        )}
      </div>
    </div>
  );
};
