import React, { useState, useEffect } from 'react';
import { Story, Chapter, Comment } from '../types';
import { STORIES_DATA } from '../data/mockData';
import { useAudio } from '../context/AudioContext';
import { storageService } from '../services/storageService';

interface StoryDetailViewProps {
  storyId: string;
  onBack: () => void;
  onOpenReader: () => void;
  onOpenGift: () => void;
  onOpenReport: (chapterTitle: string) => void;
}

export const StoryDetailView: React.FC<StoryDetailViewProps> = ({
  storyId,
  onBack,
  onOpenReader,
  onOpenGift,
  onOpenReport
}) => {
  const { playStory, currentStory, currentChapter, isPlaying } = useAudio();
  const [story, setStory] = useState<Story>(STORIES_DATA[0]);
  const [activeTab, setActiveTab] = useState<'chapters' | 'about' | 'comments'>('chapters');
  const [chapterSortAsc, setChapterSortAsc] = useState<boolean>(true);
  const [chapterFilter, setChapterFilter] = useState<'all' | 'free' | 'vip'>('all');
  const [chapterSearch, setChapterSearch] = useState<string>('');
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [newCommentRating, setNewCommentRating] = useState<number>(5);

  useEffect(() => {
    const found = STORIES_DATA.find(s => s.id === storyId) || STORIES_DATA[0];
    setStory(found);
    const favs = storageService.getFavorites();
    setIsFavorite(favs.includes(found.id));
    setComments(storageService.getComments());
  }, [storyId]);

  const handleToggleFav = () => {
    const status = storageService.toggleFavorite(story.id);
    setIsFavorite(status);
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const newComment: Comment = {
      id: `cm-${Date.now()}`,
      userName: 'Lục Diệp',
      userAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuARScFz_wiNNvTzID_N2lTMB-5vFdoidLZmVRWC4w83u7E8aa7aUAqeB81raX4wbAmgy_pSg474VJA5i1wy40lRavr4SbbLPiCX8LuApIFPFKnoOeZhqKdJDeRHf79F-Z6vLeBut2f2VNkW6sm4Ggzbbbzg_9oSMwJwH4HpEbc4UwUpwJFPxu5acIPgBLa4wGl7YZ79ezhO4GUYiU6juwQ_Zu9GOBxUFdIpI07x9-nwR4MVaQTe9Fc',
      userRealm: 'Kim Đan tầng 3',
      rating: newCommentRating,
      content: newCommentText,
      likes: 0,
      createdAt: 'Vừa xong',
      chapterTagged: currentChapter.title
    };

    storageService.addComment(newComment);
    setComments([newComment, ...comments]);
    setNewCommentText('');
  };

  // Filter & sort chapters
  const filteredChapters = story.chapters
    .filter(c => {
      if (chapterFilter === 'free') return !c.isVip;
      if (chapterFilter === 'vip') return c.isVip;
      return true;
    })
    .filter(c => c.title.toLowerCase().includes(chapterSearch.toLowerCase()))
    .sort((a, b) => (chapterSortAsc ? a.index - b.index : b.index - a.index));

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 w-full text-left">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-[#908fa0] hover:text-[#dfe2ee] mb-4 group transition-colors"
      >
        <span className="material-symbols-outlined text-sm group-hover:-translate-x-1 transition-transform">
          arrow_back
        </span>
        Quay lại trang trước
      </button>

      {/* Story Hero Header Card */}
      <div className="bg-[#1c2028] border border-white/10 rounded-3xl p-6 lg:p-8 shadow-xl relative overflow-hidden mb-8">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-container/10 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start relative">
          {/* Cover */}
          <div className="md:col-span-4 lg:col-span-3">
            <div className="aspect-[2/3] w-full max-w-[240px] mx-auto rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative bg-[#0a0e16]">
              <img
                src={story.cover}
                alt={story.title}
                className="w-full h-full object-cover"
              />
              <span className="absolute top-3 left-3 px-2 py-0.5 rounded bg-primary text-on-primary text-[10px] font-bold">
                {story.audioQuality}
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="md:col-span-8 lg:col-span-9 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {story.genres.map(g => (
                <span key={g} className="px-2.5 py-0.5 rounded-full bg-[#262a33] text-primary text-xs font-semibold">
                  {g}
                </span>
              ))}
              <span className="px-2 py-0.5 rounded-md bg-[#31353e] text-[#dfe2ee] text-xs">
                {story.status}
              </span>
              {story.badge && (
                <span className="px-2 py-0.5 rounded-md bg-error text-on-error text-xs font-bold">
                  {story.badge}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#dfe2ee] tracking-tight">
              {story.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-[#908fa0]">
              <span>Tác giả: <strong className="text-[#dfe2ee]">{story.author}</strong></span>
              <span>•</span>
              <span>Diễn đọc: <strong className="text-primary">{story.narrator}</strong> ({story.narratorGroup})</span>
            </div>

            {/* Metrics */}
            <div className="flex flex-wrap items-center gap-6 py-2 border-y border-white/5 my-1">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-tertiary text-xl">star</span>
                <span className="text-base font-bold text-[#dfe2ee]">{story.rating.toFixed(1)}</span>
                <span className="text-xs text-[#908fa0]">(4.8k đánh giá)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-secondary text-xl">headphones</span>
                <span className="text-base font-bold text-[#dfe2ee]">{story.listeners}</span>
                <span className="text-xs text-[#908fa0]">lượt nghe</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-xl">auto_stories</span>
                <span className="text-base font-bold text-[#dfe2ee]">{story.chaptersCount}</span>
                <span className="text-xs text-[#908fa0]">chương ({story.totalAudioHours})</span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#c7c4d7] line-clamp-3 leading-relaxed">
              {story.synopsis || story.description}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-3">
              <button
                onClick={() => playStory(story, 1)}
                className="px-6 py-2.5 rounded-full bg-primary text-on-primary text-xs font-bold flex items-center gap-2 shadow-lg hover:brightness-110 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-lg">play_arrow</span>
                Nghe từ đầu (C.1)
              </button>

              <button
                onClick={onOpenReader}
                className="px-5 py-2.5 rounded-full bg-[#262a33] hover:bg-[#31353e] text-[#dfe2ee] text-xs font-semibold flex items-center gap-1.5 border border-white/5 transition-all"
              >
                <span className="material-symbols-outlined text-lg">menu_book</span>
                Đọc truyện chữ
              </button>

              <button
                onClick={handleToggleFav}
                className={`p-2.5 rounded-full border transition-all ${
                  isFavorite
                    ? 'bg-error/15 border-error text-error'
                    : 'bg-[#262a33] border-white/5 text-[#c7c4d7] hover:text-[#dfe2ee]'
                }`}
                title={isFavorite ? 'Bỏ lưu' : 'Lưu vào tủ truyện'}
              >
                <span className="material-symbols-outlined text-lg">
                  {isFavorite ? 'favorite' : 'favorite_border'}
                </span>
              </button>

              <button
                onClick={onOpenGift}
                className="px-4 py-2.5 rounded-full bg-tertiary-container hover:bg-tertiary text-on-tertiary text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-base">redeem</span>
                Tặng quà tác giả
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Chapters / About / Comments */}
      <div className="flex items-center gap-2 border-b border-white/10 mb-6">
        <button
          onClick={() => setActiveTab('chapters')}
          className={`pb-3 px-3 text-sm font-bold transition-all relative ${
            activeTab === 'chapters'
              ? 'text-primary'
              : 'text-[#908fa0] hover:text-[#dfe2ee]'
          }`}
        >
          Danh sách chương ({story.chapters.length})
          {activeTab === 'chapters' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('about')}
          className={`pb-3 px-3 text-sm font-bold transition-all relative ${
            activeTab === 'about'
              ? 'text-primary'
              : 'text-[#908fa0] hover:text-[#dfe2ee]'
          }`}
        >
          Giới thiệu tác phẩm
          {activeTab === 'about' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('comments')}
          className={`pb-3 px-3 text-sm font-bold transition-all relative ${
            activeTab === 'comments'
              ? 'text-primary'
              : 'text-[#908fa0] hover:text-[#dfe2ee]'
          }`}
        >
          Bình luận & Đánh giá ({comments.length})
          {activeTab === 'comments' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
      </div>

      {/* TAB 1: CHAPTERS LIST */}
      {activeTab === 'chapters' && (
        <div className="flex flex-col gap-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#181c24] p-3 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setChapterFilter('all')}
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  chapterFilter === 'all' ? 'bg-primary text-on-primary' : 'bg-[#262a33] text-[#c7c4d7]'
                }`}
              >
                Tất cả
              </button>
              <button
                onClick={() => setChapterFilter('free')}
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  chapterFilter === 'free' ? 'bg-primary text-on-primary' : 'bg-[#262a33] text-[#c7c4d7]'
                }`}
              >
                Miễn phí
              </button>
              <button
                onClick={() => setChapterFilter('vip')}
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  chapterFilter === 'vip' ? 'bg-primary text-on-primary' : 'bg-[#262a33] text-[#c7c4d7]'
                }`}
              >
                VIP (AC)
              </button>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between">
              <input
                type="text"
                value={chapterSearch}
                onChange={e => setChapterSearch(e.target.value)}
                placeholder="Tìm chương..."
                className="bg-[#262a33] border border-white/10 rounded-full px-3 py-1 text-xs text-[#dfe2ee] placeholder-[#908fa0] focus:outline-none"
              />

              <button
                onClick={() => setChapterSortAsc(!chapterSortAsc)}
                className="flex items-center gap-1 text-xs text-[#c7c4d7] hover:text-[#dfe2ee]"
              >
                <span className="material-symbols-outlined text-sm">
                  {chapterSortAsc ? 'arrow_upward' : 'arrow_downward'}
                </span>
                {chapterSortAsc ? 'Cũ nhất' : 'Mới nhất'}
              </button>
            </div>
          </div>

          {/* Chapters Table */}
          <div className="space-y-2">
            {filteredChapters.map(chapter => {
              const isCurrent = currentStory.id === story.id && currentChapter.id === chapter.id;
              return (
                <div
                  key={chapter.id}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                    isCurrent
                      ? 'bg-primary/10 border-primary shadow-sm'
                      : 'bg-[#1c2028] border-white/5 hover:bg-[#262a33]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => playStory(story, chapter.index)}
                      className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                        isCurrent && isPlaying
                          ? 'bg-primary text-on-primary'
                          : 'bg-[#31353e] text-[#dfe2ee] hover:bg-primary hover:text-on-primary'
                      }`}
                    >
                      <span className="material-symbols-outlined text-lg">
                        {isCurrent && isPlaying ? 'pause' : 'play_arrow'}
                      </span>
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className={`text-xs sm:text-sm font-semibold truncate ${
                          isCurrent ? 'text-primary font-bold' : 'text-[#dfe2ee]'
                        }`}>
                          {chapter.title}
                        </h4>
                        {chapter.isVip && (
                          <span className="px-1.5 py-0.2 rounded bg-tertiary-container text-on-tertiary text-[9px] font-bold">
                            VIP {chapter.coinPrice ? `(${chapter.coinPrice} AC)` : ''}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[#908fa0]">
                        Thời lượng: {Math.round(chapter.durationSec / 60)} phút • Diễn đọc: {chapter.narrator}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => onOpenReport(chapter.title)}
                      className="text-[#908fa0] hover:text-error p-1 rounded transition-colors"
                      title="Báo lỗi chương này"
                    >
                      <span className="material-symbols-outlined text-sm">flag</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: ABOUT */}
      {activeTab === 'about' && (
        <div className="bg-[#1c2028] border border-white/10 rounded-2xl p-6 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-[#dfe2ee] mb-2">Tóm tắt cốt truyện</h3>
            <p className="text-xs sm:text-sm text-[#c7c4d7] leading-relaxed whitespace-pre-line">
              {story.synopsis || story.description}
            </p>
          </div>

          <div className="border-t border-white/5 pt-4">
            <h3 className="text-sm font-bold text-[#dfe2ee] mb-2">Thông tin sản xuất & Bản quyền</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-[#908fa0] block">Tác giả nguyên tác:</span>
                <span className="font-semibold text-[#dfe2ee]">{story.author}</span>
              </div>
              <div>
                <span className="text-[#908fa0] block">Voice Studio:</span>
                <span className="font-semibold text-primary">{story.narratorGroup}</span>
              </div>
              <div>
                <span className="text-[#908fa0] block">Chuẩn âm thanh:</span>
                <span className="font-semibold text-tertiary">{story.audioQuality}</span>
              </div>
              <div>
                <span className="text-[#908fa0] block">Tình trạng dịch:</span>
                <span className="font-semibold text-[#dfe2ee]">{story.status}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: COMMENTS */}
      {activeTab === 'comments' && (
        <div className="space-y-6">
          {/* Add Comment Form */}
          <form onSubmit={handleAddComment} className="bg-[#1c2028] border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between pb-3">
              <span className="text-xs font-bold text-[#dfe2ee]">Để lại bình luận của bạn:</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setNewCommentRating(star)}
                    className="text-tertiary hover:scale-110 transition-transform"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {star <= newCommentRating ? 'star' : 'star_border'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={2}
              value={newCommentText}
              onChange={e => setNewCommentText(e.target.value)}
              placeholder="Chia sẻ cảm nghĩ về diễn đọc, giọng điệu nhân vật hoặc cốt truyện..."
              className="w-full bg-[#181c24] border border-white/10 rounded-xl p-3 text-xs text-[#dfe2ee] placeholder-[#908fa0] focus:outline-none focus:border-primary resize-none"
            />

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2 rounded-full bg-primary text-on-primary text-xs font-bold hover:brightness-110 active:scale-95 transition-all"
              >
                Gửi Bình Luận
              </button>
            </div>
          </form>

          {/* Comments List */}
          <div className="space-y-3">
            {comments.map(c => (
              <div key={c.id} className="bg-[#1c2028] border border-white/5 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img src={c.userAvatar} alt={c.userName} className="w-8 h-8 rounded-full object-cover border border-white/10" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#dfe2ee]">{c.userName}</span>
                        <span className="px-1.5 py-0.2 rounded bg-tertiary/20 text-tertiary text-[9px] font-bold">
                          {c.userRealm}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#908fa0]">{c.createdAt}</span>
                    </div>
                  </div>

                  <div className="flex items-center text-tertiary">
                    {Array.from({ length: c.rating }).map((_, i) => (
                      <span key={i} className="material-symbols-outlined text-sm">star</span>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-[#c7c4d7] leading-relaxed">
                  {c.content}
                </p>

                {c.chapterTagged && (
                  <span className="inline-block text-[10px] text-primary bg-[#262a33] px-2 py-0.5 rounded">
                    📌 {c.chapterTagged}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
