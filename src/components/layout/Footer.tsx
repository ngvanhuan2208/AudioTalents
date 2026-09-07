import React from 'react';

interface FooterProps {
  onSelectTab: (tab: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectTab }) => {
  return (
    <footer className="w-full bg-[#181c24] text-[#c7c4d7] py-12 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 pb-10">
          {/* Logo & Description */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#1c2028] border border-white/10 flex items-center justify-center p-1 shadow-sm">
                <div className="flex items-center gap-0.5 h-full">
                  <span className="w-1 h-3 bg-secondary rounded-full" />
                  <span className="w-1 h-5 bg-primary rounded-full" />
                  <span className="w-1 h-4 bg-tertiary rounded-full" />
                  <span className="w-1 h-2 bg-primary-container rounded-full" />
                </div>
              </div>
              <span className="text-xl text-primary font-bold tracking-tight">AudioVerse</span>
            </div>
            <p className="text-sm text-[#908fa0] max-w-sm leading-relaxed">
              Vũ trụ webnovel và tiểu thuyết âm thanh sống động hàng đầu. Tận hưởng không gian thính giác và thị giác đỉnh cao cùng hàng ngàn tác phẩm được diễn đọc truyền cảm.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <a href="#" className="p-2 rounded-full bg-[#1c2028] hover:bg-[#262a33] text-[#dfe2ee] transition-colors border border-white/5">
                <span className="material-symbols-outlined text-base">podcasts</span>
              </a>
              <a href="#" className="p-2 rounded-full bg-[#1c2028] hover:bg-[#262a33] text-[#dfe2ee] transition-colors border border-white/5">
                <span className="material-symbols-outlined text-base">terminal</span>
              </a>
              <a href="#" className="p-2 rounded-full bg-[#1c2028] hover:bg-[#262a33] text-[#dfe2ee] transition-colors border border-white/5">
                <span className="material-symbols-outlined text-base">forum</span>
              </a>
            </div>
          </div>

          {/* Col 1 */}
          <div className="flex flex-col gap-2">
            <h4 className="text-sm text-[#dfe2ee] font-bold tracking-wide">Khám Phá</h4>
            <button onClick={() => onSelectTab('discover')} className="text-left text-xs text-[#908fa0] hover:text-primary transition-colors">
              Tiểu thuyết huyền huyễn
            </button>
            <button onClick={() => onSelectTab('discover')} className="text-left text-xs text-[#908fa0] hover:text-primary transition-colors">
              Đô thị dị năng
            </button>
            <button onClick={() => onSelectTab('discover')} className="text-left text-xs text-[#908fa0] hover:text-primary transition-colors">
              Khoa huyễn tương lai
            </button>
            <button onClick={() => onSelectTab('discover')} className="text-left text-xs text-[#908fa0] hover:text-primary transition-colors">
              Truyện độc quyền Audio
            </button>
          </div>

          {/* Col 2 */}
          <div className="flex flex-col gap-2">
            <h4 className="text-sm text-[#dfe2ee] font-bold tracking-wide">Tác Giả & Đối Tác</h4>
            <button onClick={() => onSelectTab('creator')} className="text-left text-xs text-[#908fa0] hover:text-primary transition-colors">
              Creator Studio
            </button>
            <a href="#" className="text-xs text-[#908fa0] hover:text-primary transition-colors">
              Chính sách nhuận bút
            </a>
            <a href="#" className="text-xs text-[#908fa0] hover:text-primary transition-colors">
              Hợp tác lồng tiếng AI/Voice
            </a>
            <a href="#" className="text-xs text-[#908fa0] hover:text-primary transition-colors">
              Bản quyền & DMCA
            </a>
          </div>

          {/* Col 3: Apps */}
          <div className="flex flex-col gap-2">
            <h4 className="text-sm text-[#dfe2ee] font-bold tracking-wide">Tải Ứng Dụng</h4>
            <p className="text-xs text-[#908fa0]">Nghe ngoại tuyến mọi lúc mọi nơi trên iOS & Android.</p>
            <div className="flex flex-col gap-2 pt-1">
              <div className="px-3 py-2 rounded-xl bg-[#1c2028] border border-white/5 flex items-center gap-2.5 cursor-pointer hover:bg-[#262a33] transition-colors">
                <span className="material-symbols-outlined text-xl text-[#dfe2ee]">phone_iphone</span>
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#908fa0] leading-tight">Tải trên</span>
                  <span className="text-xs text-[#dfe2ee] font-bold leading-tight">App Store</span>
                </div>
              </div>
              <div className="px-3 py-2 rounded-xl bg-[#1c2028] border border-white/5 flex items-center gap-2.5 cursor-pointer hover:bg-[#262a33] transition-colors">
                <span className="material-symbols-outlined text-xl text-[#dfe2ee]">smart_display</span>
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#908fa0] leading-tight">Tải trên</span>
                  <span className="text-xs text-[#dfe2ee] font-bold leading-tight">Google Play</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[#908fa0] text-xs">
          <p>© 2025 AudioVerse Global Inc. Bảo lưu mọi quyền.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-[#dfe2ee] transition-colors">Điều khoản dịch vụ</a>
            <a href="#" className="hover:text-[#dfe2ee] transition-colors">Chính sách bảo mật</a>
            <a href="#" className="hover:text-[#dfe2ee] transition-colors">Cài đặt Cookie</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
