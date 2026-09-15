import React, { useEffect, useState } from 'react';
import type { AuthUser } from '../../services/authService';
import { ProfileMenu } from './ProfileMenu';
import { SearchBar } from './SearchBar';
import { IconButton } from '../ui/IconButton';

interface HeaderProps {
  user?: AuthUser | null;
  onOpenLogin?: () => void;
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenWallet: () => void;
  onOpenNotifications: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  role?: 'USER' | 'ADMIN';
  authorStatus?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  onApplyAuthor?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onOpenLogin,
  currentTab,
  onSelectTab,
  onOpenWallet,
  onOpenNotifications,
  searchQuery,
  onSearchChange,
  role = 'USER',
  authorStatus = 'NONE',
  onApplyAuthor,
  onLogout,
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const displayName = user?.username || 'Khách';
  const userRealm = role === 'ADMIN' ? 'Quản trị hệ thống' : authorStatus === 'APPROVED' ? 'Tác giả đã xác minh' : 'Kim Đan tầng 1';

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        event.preventDefault();
        document.getElementById('global-search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navItems = [
    {id: 'home', label: 'Trang chủ'},
    {id: 'discover', label: 'Khám phá'},
    {id: 'genres', label: 'Thể loại'},
    {id: 'rankings', label: 'BXH Tu Vi'},
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0f131c]/85 backdrop-blur-xl border-b border-white/[0.05] shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="h-20 max-w-7xl mx-auto px-4 lg:px-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6 min-w-0">
          <button onClick={() => onSelectTab('home')} className="flex items-center gap-2.5 focus:outline-none group text-left shrink-0" type="button">
            <div className="w-9 h-9 rounded-xl bg-[#1c2028] border border-white/10 flex items-center justify-center p-1.5 shadow-sm group-hover:border-primary/50 transition-colors">
              <div className="flex items-center gap-0.5 h-full">
                <span className="w-1 h-3.5 bg-gradient-to-t from-secondary to-primary rounded-full animate-pulse" />
                <span className="w-1 h-6 bg-gradient-to-t from-primary to-tertiary rounded-full animate-pulse" style={{animationDelay: '150ms'}} />
                <span className="w-1 h-4 bg-gradient-to-t from-tertiary to-secondary rounded-full animate-pulse" style={{animationDelay: '300ms'}} />
                <span className="w-1 h-2 bg-gradient-to-t from-primary to-primary-container rounded-full animate-pulse" style={{animationDelay: '450ms'}} />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-primary">AudioTalents</span>
              <span className="text-[9px] font-semibold tracking-[0.18em] text-[#908fa0]">Audio Platform</span>
            </div>
          </button>

          <nav className="hidden xl:flex items-center gap-1 px-1.5 py-1 rounded-full bg-[#181c24]/55 border border-white/5 backdrop-blur-md">
            {navItems.map(item => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ease-out ${isActive ? 'bg-white/[0.08] backdrop-blur-md border border-white/10 text-[#dfe2ee] shadow-[0_0_16px_rgba(192,193,255,0.08)]' : 'border border-transparent text-[#c7c4d7] hover:text-[#dfe2ee] hover:bg-white/[0.05]'}`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <SearchBar
          currentTab={currentTab}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          onSelectTab={onSelectTab}
        />

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <IconButton
            label="Thông báo"
            title="Thông báo"
            onClick={onOpenNotifications}
            className="relative bg-[#262a33]/70 border border-white/5 text-[#c7c4d7] hover:text-[#dfe2ee] hover:bg-white/[0.08]"
          >
            <span className="material-symbols-outlined text-xl leading-none">notifications</span>
          </IconButton>
          {!user ? (
            <button type="button" onClick={onOpenLogin} className="px-3.5 py-2 rounded-full bg-primary text-on-primary text-xs font-bold shadow-[0_5px_18px_rgba(192,193,255,0.16)] transition-transform hover:-translate-y-px">Đăng nhập</button>
          ) : (
          <div className="relative">
            <button
              type="button"
              aria-label="Mở menu tài khoản"
              aria-expanded={showProfileMenu}
              onPointerDown={event => event.stopPropagation()}
              onClick={() => setShowProfileMenu(value => !value)}
              className="flex h-10 items-center gap-2 rounded-full pl-1 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f131c]"
            >
              <div className="relative">
                {user.profile?.avatar ? <img alt={displayName} className="w-8 h-8 rounded-full object-cover ring-1 ring-primary/40 group-hover:ring-primary group-focus-visible:ring-primary transition-all" src={user.profile.avatar} /> : <div aria-label="Ảnh đại diện mặc định" className="w-8 h-8 rounded-full bg-[#31353e] ring-1 ring-primary/40" />}
                <span className="absolute -bottom-1 -right-1 bg-[#0a0e16] px-1 rounded-full text-[9px] text-tertiary font-bold leading-tight border border-white/10">{role === 'ADMIN' ? 'ADM' : 'KĐ1'}</span>
              </div>
              <div className="hidden lg:flex flex-col text-left">
                <span className="text-xs text-[#dfe2ee] font-semibold leading-tight group-hover:text-primary transition-colors">{displayName}</span>
                <span className="text-[10px] text-tertiary font-medium leading-tight">{userRealm}</span>
              </div>
              <span className="material-symbols-outlined text-[#c7c4d7] text-base group-hover:text-[#dfe2ee] transition-transform duration-200" style={{transform: showProfileMenu ? 'rotate(180deg)' : undefined}}>expand_more</span>
            </button>
            {showProfileMenu && (
              <ProfileMenu
                user={user}
                onSelectTab={onSelectTab}
                onOpenWallet={onOpenWallet}
                onOpenNotifications={onOpenNotifications}
                onClose={() => setShowProfileMenu(false)}
                role={role}
                authorStatus={authorStatus}
                onApplyAuthor={onApplyAuthor}
                onLogout={onLogout}
              />
            )}
          </div>
          )}
        </div>
      </div>
    </header>
  );
};
