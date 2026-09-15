import React from 'react';
import { IconButton } from '../ui/IconButton';

interface VipPassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const VipPassModal: React.FC<VipPassModalProps> = ({ isOpen, onClose, onSuccess }) => {
  if (!isOpen) return null;

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
          <IconButton label="Đóng VIP Pass" size="sm" onClick={onClose} className="text-[#908fa0] hover:bg-white/10 hover:text-[#dfe2ee]"><span className="material-symbols-outlined text-xl leading-none">close</span></IconButton>
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

        <div className="p-4 rounded-2xl bg-[#262a33] border border-white/5 text-center text-sm text-[#908fa0]">Membership và thanh toán chưa có trong Backend Contract.</div>
        <button type="button" onClick={onClose} className="w-full mt-4 py-2.5 rounded-full bg-[#262a33] text-[#dfe2ee] text-xs font-semibold">Đóng</button>
      </div>
    </div>
  );
};
