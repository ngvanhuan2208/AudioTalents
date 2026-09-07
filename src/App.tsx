import React, { useState } from 'react';
import { AudioProvider, useAudio } from './context/AudioContext';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { AudioPlayerDock } from './components/audio/AudioPlayerDock';
import { ExpandedPlayerModal } from './components/audio/ExpandedPlayerModal';
import { HomeView } from './views/HomeView';
import { DiscoverView } from './views/DiscoverView';
import { GenresView } from './views/GenresView';
import { RankingsView } from './views/RankingsView';
import { LibraryView } from './views/LibraryView';
import { CreatorStudioView } from './views/CreatorStudioView';
import { AdminPortalView } from './views/AdminPortalView';
import { StoryDetailView } from './views/StoryDetailView';
import { ReaderView } from './views/ReaderView';
import { WalletModal } from './components/modals/WalletModal';
import { VipPassModal } from './components/modals/VipPassModal';
import { GiftModal } from './components/modals/GiftModal';
import { ReportModal } from './components/modals/ReportModal';

function MainContent() {
  const { currentStory, currentChapter } = useAudio();

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

  const handleSelectTab = (tab: string) => {
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
        <ReaderView
          onBack={() => setIsReaderOpen(false)}
          onOpenAudioModal={() => {}}
        />
        <AudioPlayerDock onOpenStoryDetail={handleOpenStoryDetail} />
        <ExpandedPlayerModal
          onOpenReader={handleOpenReader}
          onOpenGift={() => setIsGiftOpen(true)}
        />
        <GiftModal
          isOpen={isGiftOpen}
          onClose={() => setIsGiftOpen(false)}
          storyTitle={currentStory.title}
          authorName={currentStory.author}
          onCoinsUpdated={() => triggerToast('Tặng quà thành công! Bạn nhận thêm XP tu vi.')}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f131c] text-[#dfe2ee] flex flex-col font-sans selection:bg-primary selection:text-on-primary">
      {/* Persistent Global Header */}
      <Header
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        onOpenWallet={() => setIsWalletOpen(true)}
        onOpenNotifications={() => setShowNotifications(!showNotifications)}
        searchQuery={searchQuery}
        onSearchChange={q => setSearchQuery(q)}
      />

      {/* Notifications Popover */}
      {showNotifications && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 w-80 bg-[#1c2028] border border-white/10 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-top-2 text-left">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <span className="text-xs font-bold text-[#dfe2ee]">Thông Báo Mới</span>
            <button onClick={() => setShowNotifications(false)} className="text-[#908fa0] hover:text-[#dfe2ee]">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
          <div className="space-y-2 pt-2 text-xs">
            <div className="p-2.5 rounded-xl bg-[#262a33] text-[#c7c4d7]">
              <p className="font-bold text-[#dfe2ee]">🎉 Đột phá cảnh giới!</p>
              <p className="text-[11px] text-[#908fa0]">Bạn vừa đạt Kim Đan tầng 3 nhờ 48 giờ nghe truyện.</p>
            </div>
            <div className="p-2.5 rounded-xl bg-[#262a33] text-[#c7c4d7]">
              <p className="font-bold text-tertiary">💎 AudioCoin hàng tháng</p>
              <p className="text-[11px] text-[#908fa0]">Bạn nhận được +500 AC từ gói Thần Vương VIP Pass.</p>
            </div>
            <div className="p-2.5 rounded-xl bg-[#262a33] text-[#c7c4d7]">
              <p className="font-bold text-primary">🎧 Tập mới ra lò</p>
              <p className="text-[11px] text-[#908fa0]">Đấu Phá Khung Thương vừa cập nhật Chương 343 Audio 8D.</p>
            </div>
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
          <StoryDetailView
            storyId={selectedStoryId}
            onBack={() => setSelectedStoryId(null)}
            onOpenReader={handleOpenReader}
            onOpenGift={() => setIsGiftOpen(true)}
            onOpenReport={handleOpenReport}
          />
        ) : (
          <>
            {currentTab === 'home' && (
              <HomeView
                onOpenStoryDetail={handleOpenStoryDetail}
                onSelectGenre={handleSelectGenre}
                onSelectTab={handleSelectTab}
                onOpenWallet={() => setIsWalletOpen(true)}
                onOpenVip={() => setIsVipOpen(true)}
              />
            )}
            {currentTab === 'discover' && (
              <DiscoverView
                initialGenre={selectedGenreSlug}
                initialSearch={searchQuery}
                onOpenDetail={handleOpenStoryDetail}
              />
            )}
            {currentTab === 'genres' && (
              <GenresView
                onSelectGenre={handleSelectGenre}
                onOpenDetail={handleOpenStoryDetail}
              />
            )}
            {currentTab === 'rankings' && (
              <RankingsView onOpenStoryDetail={handleOpenStoryDetail} />
            )}
            {currentTab === 'library' && (
              <LibraryView onOpenStoryDetail={handleOpenStoryDetail} />
            )}
            {currentTab === 'creator' && <CreatorStudioView />}
            {currentTab === 'admin' && <AdminPortalView />}
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

      <GiftModal
        isOpen={isGiftOpen}
        onClose={() => setIsGiftOpen(false)}
        storyTitle={currentStory.title}
        authorName={currentStory.author}
        onCoinsUpdated={() => triggerToast('Đã tặng quà tác giả thành công!')}
      />

      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        chapterTitle={reportChapterTitle || currentChapter.title}
      />
    </div>
  );
}

export default function App() {
  return (
    <AudioProvider>
      <MainContent />
    </AudioProvider>
  );
}
