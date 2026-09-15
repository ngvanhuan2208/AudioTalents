import React, { useEffect, useRef } from 'react';
import type { AuthUser } from '../../services/authService';

type UserRole = 'USER' | 'ADMIN';
type AuthorStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

interface ProfileMenuProps {
  user?: AuthUser | null;
  role?: UserRole;
  authorStatus?: AuthorStatus;
  onSelectTab: (tab: string) => void;
  onOpenWallet: () => void;
  onOpenNotifications: () => void;
  onClose: () => void;
  onLogout?: () => void;
  onApplyAuthor?: () => void;
}

export const ProfileMenu: React.FC<ProfileMenuProps> = ({
  user,
  role = 'LISTENER',
  onSelectTab,
  onOpenWallet,
  onOpenNotifications,
  onClose,
  onLogout,
  onApplyAuthor,
  authorStatus = 'NONE',
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const displayName = user?.username || 'Khách';
  const accountLabel = user?.accountStatus === 'SUSPENDED' ? 'Tài khoản bị đình chỉ' : user?.accountStatus === 'DEACTIVATED' ? 'Tài khoản đã vô hiệu' : 'Tài khoản đang hoạt động';
  const realm = user?.role === 'ADMIN' ? 'Quản trị hệ thống' : user?.authorStatus === 'APPROVED' ? 'Tác giả đã xác minh' : 'Kim Đan tầng 1';

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const navigate = (tab: string) => {
    onSelectTab(tab);
    onClose();
  };

  const itemClass = 'w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-xl text-[#c7c4d7] hover:text-[#dfe2ee] hover:bg-white/[0.07] transition-colors text-left';

  return (
    <div ref={menuRef} className="absolute right-0 mt-3 w-64 bg-[#1c2028]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-2 z-50 text-left animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="px-3 py-3 border-b border-white/5 flex items-center gap-3">
        {user?.profile?.avatar ? <img src={user.profile.avatar} alt={displayName} className="w-10 h-10 rounded-full object-cover ring-1 ring-primary/40" /> : <div className="w-10 h-10 rounded-full bg-[#31353e] ring-1 ring-primary/40" />}
        <div className="min-w-0">
          <p className="text-xs font-bold text-[#dfe2ee] truncate">{displayName}</p>
          <p className="text-[11px] text-[#908fa0] truncate">{user?.email || 'Chưa đăng nhập'}</p>
          <p className="text-[10px] text-tertiary font-medium">{realm}</p>
          <p className="text-[10px] text-[#908fa0]">{accountLabel}</p>
        </div>
      </div>

      <div className="py-1.5 border-b border-white/5">
        <button type="button" onClick={onClose} className={itemClass}>
          <span className="material-symbols-outlined text-sm text-primary">person</span>
          Hồ sơ
        </button>
        <button type="button" onClick={() => navigate('library')} className={itemClass}>
          <span className="material-symbols-outlined text-sm text-primary">auto_stories</span>
          Tủ truyện của tôi
        </button>
        <button type="button" onClick={() => navigate('library')} className={itemClass}>
          <span className="material-symbols-outlined text-sm text-error">favorite</span>
          Yêu thích
        </button>
        <button type="button" onClick={() => { onOpenNotifications(); onClose(); }} className={itemClass}>
          <span className="material-symbols-outlined text-sm text-secondary">notifications</span>
          Thông báo
        </button>
        {authorStatus === 'NONE' ? (
          <button type="button" onClick={() => { onApplyAuthor?.(); onClose(); }} className={itemClass}>
            <span className="material-symbols-outlined text-sm text-tertiary">edit_note</span>
            Đăng ký quyền tác giả
          </button>
        ) : authorStatus === 'PENDING' ? (
          <div className="px-3 py-2 flex items-center gap-2.5 text-xs text-tertiary">
            <span className="material-symbols-outlined text-sm">hourglass_top</span>
            <span>Hồ sơ tác giả đang chờ duyệt</span>
          </div>
        ) : authorStatus === 'REJECTED' ? (
          <button type="button" onClick={() => { onApplyAuthor?.(); onClose(); }} className={itemClass}>
            <span className="material-symbols-outlined text-sm text-error">info</span>
            Trạng thái hồ sơ: bị từ chối
          </button>
        ) : authorStatus === 'SUSPENDED' ? (
          <div className="px-3 py-2 flex items-center gap-2.5 text-xs text-error">
            <span className="material-symbols-outlined text-sm">warning</span>
            <span>Quyền tác giả bị đình chỉ</span>
          </div>
        ) : null}
      </div>

      <div className="py-2 border-b border-white/5">
        <div className="px-3 pb-1 flex items-center gap-2 text-tertiary">
          <span className="material-symbols-outlined text-sm">diamond</span>
          <span className="text-[11px] font-semibold">AudioCoin</span>
        </div>
        <div className="px-3 flex items-center justify-between gap-3">
          <span className="text-xs text-[#908fa0]">Số dư chưa khả dụng</span>
          <button type="button" onClick={onClose} className="text-[11px] font-bold text-[#908fa0] cursor-not-allowed">
            Chưa hỗ trợ
          </button>
        </div>
      </div>

      {(role === 'ADMIN' || authorStatus === 'APPROVED') && (
        <div className="py-1.5 border-b border-white/5">
          {role === 'ADMIN' && (
            <button type="button" onClick={() => navigate('admin')} className={itemClass}>
              <span className="material-symbols-outlined text-sm text-primary">admin_panel_settings</span>
              Quản trị hệ thống
            </button>
          )}
          {authorStatus === 'APPROVED' && (
            <button type="button" onClick={() => navigate('creator')} className={itemClass}>
              <span className="material-symbols-outlined text-sm text-primary">draw</span>
              Quản trị tác giả
            </button>
          )}
        </div>
      )}

      <div className="pt-1.5">
        <button type="button" onClick={() => onClose()} className={itemClass}>
          <span className="material-symbols-outlined text-sm">settings</span>
          Cài đặt
        </button>
        <button type="button" onClick={() => { onLogout?.(); onClose(); }} className={`${itemClass} text-error/80 hover:text-error`}>
          <span className="material-symbols-outlined text-sm">logout</span>
          Đăng xuất
        </button>
      </div>
    </div>
  );
};
