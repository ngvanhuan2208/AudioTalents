import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAudio } from '../../context/AudioContext';
import { getNotifications } from '../../services/contentService';
import { Header } from '../../components/layout/Header';
import { Footer } from '../../components/layout/Footer';
import { AudioPlayerDock } from '../../components/audio/AudioPlayerDock';
import { ExpandedPlayerModal } from '../../components/audio/ExpandedPlayerModal';
import { Home } from '../../pages/Home/Home';
import { Explore } from '../../pages/Explore/Explore';
import { Genres } from '../../pages/Genres/Genres';
import { Rankings } from '../../pages/Rankings/Rankings';
import { Library } from '../../pages/Library/Library';
import { CreatorDashboard } from '../../pages/Creator/CreatorDashboard';
import { AdminDashboard } from '../../pages/Admin/AdminDashboard';
import { StoryDetail } from '../../pages/StoryDetail/StoryDetail';
import { Reader } from '../../pages/Reader/Reader';
import { WalletModal } from '../../components/modals/WalletModal';
import { VipPassModal } from '../../components/modals/VipPassModal';
import { GiftModal } from '../../components/modals/GiftModal';
import { ReportModal } from '../../components/modals/ReportModal';
import { AuthorApplicationModal } from '../../components/modals/AuthorApplicationModal';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { IconButton } from '../../components/ui/IconButton';

function MainLayout({onNavigate}: {onNavigate: (path: string) => void}) {
  const { currentStory, currentChapter } = useAudio();
  const { user, isAuthenticated, logout } = useAuth();

  const [currentTab, setCurrentTab] = useState<string>('home');
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [isReaderOpen, setIsReaderOpen] = useState<boolean>(false);
  const [selectedGenreSlug, setSelectedGenreSlug] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [isWalletOpen, setIsWalletOpen] = useState<boolean>(false);
  const [isVipOpen, setIsVipOpen] = useState<boolean>(false);
  const [isGiftOpen, setIsGiftOpen] = useState<boolean>(false);
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);
  const [reportChapterTitle, setReportChapterTitle] = useState<string>('');
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [notificationToast, setNotificationToast] = useState<string | null>(null);
  const [isAuthorApplicationOpen, setIsAuthorApplicationOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{id: string; title: string; message: string; readAt?: string | null}>>([]);

  useEffect(() => {
    if (!showNotifications || !user) return;
    getNotifications().then(setNotifications).catch(() => setNotifications([]));
  }, [showNotifications, user]);

  const handleSelectTab = (tab: string) => {
    if (tab === 'library' && !isAuthenticated) { onNavigate('/login'); return; }
    if (tab === 'creator' && !isAuthenticated) { onNavigate('/login'); return; }
    if (tab === 'admin' && !isAuthenticated) { onNavigate('/login'); return; }
    setCurrentTab(tab);
    setSelectedStoryId(null);
    setIsReaderOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenStoryDetail = (storyId: string) => {
    setSelectedStoryId(storyId);
    setIsReaderOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectGenre = (genreSlug: string) => {
    setSelectedGenreSlug(genreSlug);
    setCurrentTab('discover');
    setSelectedStoryId(null);
    setIsReaderOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenReader = () => {
    setIsReaderOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenReport = (chapterTitle: string) => {
    setReportChapterTitle(chapterTitle);
    setIsReportOpen(true);
  };

  const triggerToast = (msg: string) => {
    setNotificationToast(msg);
    setTimeout(() => setNotificationToast(null), 3000);
  };

  // Render Reader view full screen
  if (isReaderOpen) {
    return (
      <div className="min-h-screen bg-[#0f131c] text-[#dfe2ee]">
        <Reader
          onBack={() => setIsReaderOpen(false)}
          onOpenAudioModal={() => {}}
        />
        <AudioPlayerDock onOpenStoryDetail={handleOpenStoryDetail} />
        <ExpandedPlayerModal
          onOpenReader={handleOpenReader}
          onOpenGift={() => setIsGiftOpen(true)}
        />
        {currentStory && <GiftModal
          isOpen={isGiftOpen}
          onClose={() => setIsGiftOpen(false)}
          storyTitle={currentStory.title}
          authorName={currentStory.author}
          onCoinsUpdated={() => triggerToast('Tặng quà thành công! Bạn nhận thêm XP tu vi.')}
        />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f131c] text-[#dfe2ee] flex flex-col font-sans selection:bg-primary selection:text-on-primary">
      {/* Persistent Global Header */}
      <Header
        user={user}
        onOpenLogin={() => onNavigate('/login')}
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        onOpenWallet={() => setIsWalletOpen(true)}
        onOpenNotifications={() => setShowNotifications(!showNotifications)}
        searchQuery={searchQuery}
        onSearchChange={q => setSearchQuery(q)}
        role={user?.role === 'ADMIN' ? 'ADMIN' : 'USER'}
        authorStatus={user?.authorStatus || 'NONE'}
        onApplyAuthor={() => {
          if (!user) { onNavigate('/login'); return; }
          if (!user.emailVerified) { onNavigate('/verify-email'); return; }
          setIsAuthorApplicationOpen(true);
        }}
        onLogout={logout}
      />

      {/* Notifications Popover */}
      {showNotifications && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 w-80 bg-[#1c2028] border border-white/10 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-top-2 text-left">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <span className="text-xs font-bold text-[#dfe2ee]">Thông Báo Mới</span>
            <IconButton label="Đóng thông báo" size="sm" onClick={() => setShowNotifications(false)} className="text-[#908fa0] hover:bg-white/10 hover:text-[#dfe2ee]"><span className="material-symbols-outlined text-sm leading-none">close</span></IconButton>
          </div>
          <div className="space-y-2 pt-2 text-xs">
            {!user ? (
              <p className="p-2.5 text-[#908fa0]">Vui lòng đăng nhập để xem thông báo.</p>
            ) : notifications.length === 0 ? (
              <p className="p-2.5 text-[#908fa0]">Bạn chưa có thông báo.</p>
            ) : notifications.map(notification => (
              <div key={notification.id} className="p-2.5 rounded-xl bg-[#262a33] text-[#c7c4d7]">
                <p className="font-bold text-[#dfe2ee]">{notification.title}</p>
                <p className="text-[11px] text-[#908fa0]">{notification.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {notificationToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-tertiary-container text-on-tertiary text-xs font-bold shadow-2xl animate-in fade-in zoom-in-95">
          ✓ {notificationToast}
        </div>
      )}

      {/* Main View Area */}
      <main className="flex-1 pt-20 pb-32">
        {selectedStoryId ? (
          <StoryDetail
            storyId={selectedStoryId}
            onBack={() => setSelectedStoryId(null)}
            onOpenReader={handleOpenReader}
            onOpenGift={() => setIsGiftOpen(true)}
            onOpenReport={handleOpenReport}
          />
        ) : (
          <>
            {currentTab === 'home' && (
              <Home
                onOpenStoryDetail={handleOpenStoryDetail}
                onSelectGenre={handleSelectGenre}
                onSelectTab={handleSelectTab}
                onOpenWallet={() => setIsWalletOpen(true)}
                onOpenVip={() => setIsVipOpen(true)}
              />
            )}
            {currentTab === 'discover' && (
              <Explore
                initialGenre={selectedGenreSlug}
                initialSearch={searchQuery}
                onOpenDetail={handleOpenStoryDetail}
              />
            )}
            {currentTab === 'genres' && (
              <Genres
                onSelectGenre={handleSelectGenre}
                onOpenDetail={handleOpenStoryDetail}
              />
            )}
            {currentTab === 'rankings' && (
              <Rankings onOpenStoryDetail={handleOpenStoryDetail} />
            )}
            {currentTab === 'library' && (
              <ProtectedRoute onNavigate={onNavigate}>
                <Library onOpenStoryDetail={handleOpenStoryDetail} />
              </ProtectedRoute>
            )}
            {currentTab === 'creator' && (
              <ProtectedRoute onNavigate={onNavigate}>
                <CreatorDashboard />
              </ProtectedRoute>
            )}
            {currentTab === 'admin' && (
              <ProtectedRoute onNavigate={onNavigate} requireAdmin>
                <AdminDashboard />
              </ProtectedRoute>
            )}
          </>
        )}
      </main>

      {/* Global Footer */}
      <Footer onSelectTab={handleSelectTab} />

      {/* Persistent Audio Player Dock */}
      <AudioPlayerDock onOpenStoryDetail={handleOpenStoryDetail} />

      {/* Expanded Fullscreen Audio Player Modal with Transcript sync */}
      <ExpandedPlayerModal
        onOpenReader={handleOpenReader}
        onOpenGift={() => setIsGiftOpen(true)}
      />

      {/* Modals */}
      <WalletModal
        isOpen={isWalletOpen}
        onClose={() => setIsWalletOpen(false)}
        onCoinsUpdated={() => triggerToast('Đã nạp AudioCoin vào ví thành công!')}
      />

      <VipPassModal
        isOpen={isVipOpen}
        onClose={() => setIsVipOpen(false)}
        onSuccess={() => triggerToast('Đăng ký Thần Vương VIP Pass thành công!')}
      />

      {currentStory && <GiftModal
        isOpen={isGiftOpen}
        onClose={() => setIsGiftOpen(false)}
        storyTitle={currentStory.title}
        authorName={currentStory.author}
        onCoinsUpdated={() => triggerToast('Đã tặng quà tác giả thành công!')}
      />}

      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        chapterTitle={reportChapterTitle || currentChapter?.title || ''}
      />

      <AuthorApplicationModal
        isOpen={isAuthorApplicationOpen}
        onClose={() => setIsAuthorApplicationOpen(false)}
        onSubmitted={triggerToast}
      />
    </div>
  );
}

export default MainLayout;
