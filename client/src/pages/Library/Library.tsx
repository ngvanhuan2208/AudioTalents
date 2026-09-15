import React, { useState, useEffect } from 'react';
import { StoryCard } from '../../components/story/StoryCard';
import { UserPlayHistory, Playlist } from '../../types';
import { useAudio } from '../../context/AudioContext';
import { useAuth } from '../../context/AuthContext';
import { createPlaylist, getFavorites, getHistory, getPlaylists, getStories } from '../../services/contentService';
import { Story } from '../../types';

interface LibraryViewProps {
  onOpenStoryDetail: (storyId: string) => void;
}

export const Library: React.FC<LibraryViewProps> = ({ onOpenStoryDetail }) => {
  const { playStory } = useAudio();
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<'history' | 'favorites' | 'playlists'>('history');
  const [history, setHistory] = useState<UserPlayHistory[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [newPlaylistName, setNewPlaylistName] = useState<string>('');
  const [showCreatePlaylist, setShowCreatePlaylist] = useState<boolean>(false);
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }
    Promise.all([getHistory(), getFavorites(), getPlaylists(), getStories()])
      .then(([loadedHistory, loadedFavorites, loadedPlaylists, loadedStories]) => {
        setHistory(loadedHistory);
        setFavoriteIds(loadedFavorites.map(item => item.storyId));
        setPlaylists(loadedPlaylists);
        setStories(loadedStories);
      })
      .catch(() => setError('Không thể tải tủ truyện. Vui lòng thử lại sau.'))
      .finally(() => setIsLoading(false));
  }, [isAuthenticated]);

  const favoriteStories = stories.filter(s => favoriteIds.includes(s.id));

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;

    try {
      const newPlaylist = await createPlaylist(newPlaylistName.trim());
      setPlaylists(current => [...current, newPlaylist]);
      setNewPlaylistName('');
      setShowCreatePlaylist(false);
    } catch {
      setError('Không thể tạo danh sách phát.');
    }
  };

  if (!isAuthenticated) {
    return <div className="max-w-7xl mx-auto px-4 lg:px-8 py-16 text-center text-sm text-[#908fa0]">Vui lòng đăng nhập để xem tủ truyện.</div>;
  }

  if (isLoading) {
    return <div className="max-w-7xl mx-auto px-4 lg:px-8 py-16 text-center text-sm text-[#908fa0]">Đang tải tủ truyện...</div>;
  }

  if (error) {
    return <div className="max-w-7xl mx-auto px-4 lg:px-8 py-16 text-center text-sm text-error">{error}</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 w-full text-left">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-white/10">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-primary/15 text-primary">
              <span className="material-symbols-outlined text-base">auto_stories</span>
            </span>
            <span className="text-xs uppercase tracking-widest text-primary font-bold">Không Gian Cá Nhân</span>
          </div>
          <h1 className="text-3xl font-extrabold text-[#dfe2ee] tracking-tight">Tủ Truyện & Danh Sách Phát</h1>
          <p className="text-xs text-[#908fa0]">Toàn bộ tiến trình nghe, truyện đã lưu và playlist được đồng bộ theo tài khoản</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 bg-[#1c2028] p-1.5 rounded-2xl border border-white/5">
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-[#c7c4d7] hover:text-[#dfe2ee]'
            }`}
          >
            Lịch Sử Nghe ({history.length})
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'favorites'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-[#c7c4d7] hover:text-[#dfe2ee]'
            }`}
          >
            Yêu Thích ({favoriteStories.length})
          </button>
          <button
            onClick={() => setActiveTab('playlists')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'playlists'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-[#c7c4d7] hover:text-[#dfe2ee]'
            }`}
          >
            Danh Sách Phát ({playlists.length})
          </button>
        </div>
      </div>

      {/* 1. HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="py-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#908fa0]">Tự động ghi nhớ vị trí từng giây nghe:</span>
          </div>

          <div className="space-y-3">
            {history.map((item, idx) => {
              const matchedStory = stories.find(s => s.id === item.storyId);
              if (!matchedStory) return null;
              return (
                <div
                  key={idx}
                  className="bg-[#1c2028] border border-white/5 hover:border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:bg-[#262a33]"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      onClick={() => onOpenStoryDetail(matchedStory.id)}
                      className="w-14 h-20 rounded-xl overflow-hidden bg-[#0a0e16] flex-shrink-0 cursor-pointer shadow-md"
                    >
                      <img src={matchedStory.cover} alt={matchedStory.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-tertiary font-bold">
                        Đã nghe {item.percent}% • {item.lastPlayedAt}
                      </span>
                      <h3
                        onClick={() => onOpenStoryDetail(matchedStory.id)}
                        className="text-base font-bold text-[#dfe2ee] truncate hover:text-primary transition-colors cursor-pointer"
                      >
                        {matchedStory.title}
                      </h3>
                      <p className="text-xs text-[#c7c4d7] truncate">{item.chapterTitle}</p>

                      {/* Progress bar */}
                      <div className="w-48 sm:w-64 h-1.5 bg-[#31353e] rounded-full overflow-hidden mt-2">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${item.percent}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => playStory(matchedStory, item.chapterIndex, item.positionSec)}
                      className="px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-bold flex items-center gap-1.5 shadow-md hover:brightness-110 active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-base">play_arrow</span>
                      Nghe tiếp
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. FAVORITES TAB */}
      {activeTab === 'favorites' && (
        <div className="py-6">
          {favoriteStories.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {favoriteStories.map(story => (
                <StoryCard key={story.id} story={story} onOpenDetail={onOpenStoryDetail} />
              ))}
            </div>
          ) : (
            <div className="py-16 text-center bg-[#1c2028] rounded-2xl border border-white/5">
              <span className="material-symbols-outlined text-4xl text-[#908fa0] mb-2">bookmark_border</span>
              <h3 className="text-base font-bold text-[#dfe2ee]">Chưa có truyện nào trong danh sách yêu thích</h3>
              <p className="text-xs text-[#908fa0] mt-1">Hãy nhấp vào biểu tượng trái tim ở bất kỳ trang chi tiết truyện nào để lưu lại.</p>
            </div>
          )}
        </div>
      )}

      {/* 3. PLAYLISTS TAB */}
      {activeTab === 'playlists' && (
        <div className="py-6 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#908fa0]">Danh sách phát cá nhân hóa của bạn:</span>
            <button
              onClick={() => setShowCreatePlaylist(!showCreatePlaylist)}
              className="px-4 py-2 rounded-full bg-primary-container hover:bg-primary text-on-primary-container hover:text-on-primary text-xs font-bold flex items-center gap-1 transition-all"
            >
              <span className="material-symbols-outlined text-base">add</span>
              Tạo Playlist Mới
            </button>
          </div>

          {showCreatePlaylist && (
            <form onSubmit={handleCreatePlaylist} className="p-4 rounded-2xl bg-[#1c2028] border border-white/10 flex items-center gap-3">
              <input
                type="text"
                value={newPlaylistName}
                onChange={e => setNewPlaylistName(e.target.value)}
                placeholder="Tên danh sách phát (VD: Nghe trước khi ngủ, Audio Tu Tiên...)"
                className="flex-1 bg-[#181c24] border border-white/10 rounded-xl px-4 py-2 text-xs text-[#dfe2ee] focus:outline-none focus:border-primary"
              />
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:brightness-110"
              >
                Tạo
              </button>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {playlists.map(pl => (
              <div
                key={pl.id}
                className="bg-[#1c2028] border border-white/5 hover:border-white/10 rounded-2xl p-4 flex gap-4 items-center group cursor-pointer hover:bg-[#262a33] transition-all"
              >
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#0a0e16] flex-shrink-0 relative">
                  <img src={pl.cover} alt={pl.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  <span className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="material-symbols-outlined text-white text-2xl">play_arrow</span>
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-[#dfe2ee] truncate group-hover:text-primary transition-colors">
                    {pl.title}
                  </h3>
                  <p className="text-xs text-[#908fa0] mt-1">
                    {pl.storyCount} tác phẩm • {pl.totalDurationHours}
                  </p>
                  <span className="text-[10px] text-tertiary font-bold mt-2 inline-block">
                    Đã sẵn sàng phát
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
