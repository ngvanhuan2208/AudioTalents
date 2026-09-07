import React, { useState, useEffect } from 'react';
import { storageService } from '../../services/storageService';

interface HeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenWallet: () => void;
  onOpenNotifications: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  onOpenWallet,
  onOpenNotifications,
  searchQuery,
  onSearchChange,
}) => {
  const [coins, setCoins] = useState<number>(1250);
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);

  useEffect(() => {
    setCoins(storageService.getCoins());
    const interval = setInterval(() => {
      setCoins(storageService.getCoins());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        document.getElementById('global-search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navItems = [
    { id: 'home', label: 'Trang chủ' },
    { id: 'discover', label: 'Khám phá' },
    { id: 'genres', label: 'Thể loại' },
    { id: 'rankings', label: 'Bảng xếp hạng' },
    { id: 'library', label: 'Tủ truyện' },
    { id: 'creator', label: 'Tác giả' },
    { id: 'admin', label: 'Quản trị' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0f131c]/85 backdrop-blur-xl border-b border-white/[0.05] shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="h-20 max-w-7xl mx-auto px-4 lg:px-8 flex items-center justify-between gap-4">
        {/* Brand Logo & Nav */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => onSelectTab('home')}
            className="flex items-center gap-2.5 focus:outline-none group text-left"
          >
            {/* AudioWaveform Icon matching Image 1 & 2 */}
            <div className="w-9 h-9 rounded-xl bg-[#1c2028] border border-white/10 flex items-center justify-center p-1.5 shadow-sm group-hover:border-primary/50 transition-colors">
              <div className="flex items-center gap-0.5 h-full">
                <span className="w-1 h-3.5 bg-gradient-to-t from-secondary to-primary rounded-full animate-pulse" />
                <span className="w-1 h-6 bg-gradient-to-t from-primary to-tertiary rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-4 bg-gradient-to-t from-tertiary to-secondary rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                <span className="w-1 h-2 bg-gradient-to-t from-primary to-primary-container rounded-full animate-pulse" style={{ animationDelay: '450ms' }} />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-primary flex items-center gap-1">
                AudioVerse
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-widest text-[#908fa0]">
                AUDIO NOVEL PLATFORM
              </span>
            </div>
          </button>

          {/* Desktop Nav Tabs */}
          <nav className="hidden xl:flex items-center gap-1 px-1.5 py-1 rounded-full bg-[#181c24] border border-white/5">
            {navItems.map(item => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-primary-container text-on-primary-container shadow-sm font-bold'
                      : 'text-[#c7c4d7] hover:text-[#dfe2ee] hover:bg-[#262a33]/60'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Search Bar */}
        <div className="hidden md:flex flex-1 max-w-md mx-2">
          <div className="relative w-full flex items-center bg-[#262a33] border border-white/5 hover:border-white/15 focus-within:border-primary/50 rounded-full px-4 py-2 transition-all">
            <span className="material-symbols-outlined text-[#908fa0] text-lg mr-2">search</span>
            <input
              id="global-search-input"
              value={searchQuery}
              onChange={e => {
                onSearchChange(e.target.value);
                if (currentTab !== 'discover' && e.target.value) {
                  onSelectTab('discover');
                }
              }}
              className="w-full bg-transparent text-sm text-[#dfe2ee] placeholder-[#908fa0] focus:outline-none"
              placeholder="Bạn muốn nghe truyện gì? (Nhấn / để tìm)"
              type="text"
            />
            <kbd className="hidden lg:inline-flex items-center justify-center px-2 py-0.5 rounded bg-[#31353e] text-[11px] text-[#c7c4d7] font-mono border border-white/5">
              /
            </kbd>
          </div>
        </div>

        {/* Right Actions: Coins, Notifications, User */}
        <div className="flex items-center gap-3">
          {/* AudioCoin Balance */}
          <div className="flex items-center gap-2 bg-[#262a33] border border-white/5 py-1 pl-3 pr-1 rounded-full shadow-inner">
            <span className="material-symbols-outlined text-tertiary text-base">diamond</span>
            <span className="text-xs font-bold text-tertiary-fixed font-mono">{coins.toLocaleString()} AC</span>
            <button
              onClick={onOpenWallet}
              className="bg-tertiary-container hover:bg-tertiary text-on-tertiary text-xs font-bold px-2.5 py-1 rounded-full transition-colors flex items-center gap-0.5 shadow-sm active:scale-95"
              type="button"
            >
              <span className="material-symbols-outlined text-xs font-bold">add</span>
              Nạp xu
            </button>
          </div>

          {/* Notifications */}
          <button
            aria-label="Thông báo"
            onClick={onOpenNotifications}
            className="relative p-2 rounded-full bg-[#262a33] text-[#c7c4d7] hover:text-[#dfe2ee] hover:bg-[#31353e] transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-xl">notifications</span>
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-error text-on-error text-[10px] flex items-center justify-center font-bold">
              3
            </span>
          </button>

          {/* User Profile */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 pl-1 group cursor-pointer focus:outline-none"
            >
              <div className="relative">
                <img
                  alt="Lục Diệp"
                  className="w-8 h-8 rounded-full object-cover ring-1 ring-primary/40 group-hover:ring-primary transition-all"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuARScFz_wiNNvTzID_N2lTMB-5vFdoidLZmVRWC4w83u7E8aa7aUAqeB81raX4wbAmgy_pSg474VJA5i1wy40lRavr4SbbLPiCX8LuApIFPFKnoOeZhqKdJDeRHf79F-Z6vLeBut2f2VNkW6sm4Ggzbbbzg_9oSMwJwH4HpEbc4UwUpwJFPxu5acIPgBLa4wGl7YZ79ezhO4GUYiU6juwQ_Zu9GOBxUFdIpI07x9-nwR4MVaQTe9Fc"
                />
                <span className="absolute -bottom-1 -right-1 bg-[#0a0e16] px-1 rounded-full text-[9px] text-tertiary font-bold leading-tight border border-white/10">
                  KĐ3
                </span>
              </div>
              <div className="hidden lg:flex flex-col text-left">
                <span className="text-xs text-[#dfe2ee] font-semibold leading-tight group-hover:text-primary transition-colors">
                  Lục Diệp
                </span>
                <span className="text-[10px] text-tertiary font-medium leading-tight">
                  Kim Đan tầng 3
                </span>
              </div>
              <span className="material-symbols-outlined text-[#c7c4d7] text-base group-hover:text-[#dfe2ee]">
                expand_more
              </span>
            </button>

            {/* Profile Dropdown */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-3 w-56 bg-[#1c2028] border border-white/10 rounded-2xl shadow-2xl p-2 z-50 text-left animate-in fade-in duration-200">
                <div className="px-3 py-2 border-b border-white/5">
                  <p className="text-xs font-bold text-[#dfe2ee]">Đạo Hữu: Lục Diệp</p>
                  <p className="text-[11px] text-tertiary font-mono">Tu vi: 84.250 XP (Cần 1.250 XP để phá cảnh)</p>
                </div>
                <button
                  onClick={() => {
                    onSelectTab('library');
                    setShowProfileMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-xl hover:bg-[#262a33] text-[#c7c4d7] hover:text-[#dfe2ee]"
                >
                  <span className="material-symbols-outlined text-sm text-primary">auto_stories</span>
                  Tủ truyện của tôi
                </button>
                <button
                  onClick={() => {
                    onSelectTab('rankings');
                    setShowProfileMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-xl hover:bg-[#262a33] text-[#c7c4d7] hover:text-[#dfe2ee]"
                >
                  <span className="material-symbols-outlined text-sm text-tertiary">military_tech</span>
                  Bảng xếp hạng Tu Vi
                </button>
                <button
                  onClick={() => {
                    onOpenWallet();
                    setShowProfileMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-xl hover:bg-[#262a33] text-[#c7c4d7] hover:text-[#dfe2ee]"
                >
                  <span className="material-symbols-outlined text-sm text-secondary">account_balance_wallet</span>
                  Ví AudioCoin ({coins} AC)
                </button>
                <button
                  onClick={() => {
                    onSelectTab('creator');
                    setShowProfileMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-xl hover:bg-[#262a33] text-[#c7c4d7] hover:text-[#dfe2ee]"
                >
                  <span className="material-symbols-outlined text-sm text-primary">draw</span>
                  Creator Studio
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
