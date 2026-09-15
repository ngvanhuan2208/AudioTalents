import React, { useEffect, useState } from 'react';
import { StoryCard } from '../../components/story/StoryCard';
import { useAudio } from '../../context/AudioContext';
import { getGenres, getStories } from '../../services/contentService';
import { Genre, Story } from '../../types';

interface HomeViewProps {
  onOpenStoryDetail: (storyId: string) => void;
  onSelectGenre: (genreSlug: string) => void;
  onSelectTab: (tab: string) => void;
  onOpenWallet: () => void;
  onOpenVip: () => void;
}

export const Home: React.FC<HomeViewProps> = ({
  onOpenStoryDetail,
  onSelectGenre,
  onSelectTab,
  onOpenWallet,
  onOpenVip
}) => {
  const { playStory } = useAudio();
  const [stories, setStories] = useState<Story[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rankingTimeframe, setRankingTimeframe] = useState<'24h' | '7d' | '30d'>('24h');
  const [releaseFilter, setReleaseFilter] = useState<'all' | 'exclusive' | 'completed'>('all');

  useEffect(() => {
    Promise.all([getStories({sort: 'popular'}), getGenres()])
      .then(([loadedStories, loadedGenres]) => {
        setStories(loadedStories);
        setGenres(loadedGenres);
      })
      .catch(() => setError('Không thể tải nội dung trang chủ. Vui lòng thử lại sau.'))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return <div className="max-w-7xl mx-auto px-4 lg:px-8 py-16 text-center text-sm text-[#908fa0]">Đang tải trang chủ...</div>;
  }

  if (error) {
    return <div className="max-w-7xl mx-auto px-4 lg:px-8 py-16 text-center text-sm text-error">{error}</div>;
  }

  if (!stories.length) {
    return <div className="max-w-7xl mx-auto px-4 lg:px-8 py-16 text-center text-sm text-[#908fa0]">Chưa có truyện nào.</div>;
  }

  const heroStory = stories[0];

  // Continue listening items
  const continueListeningItems = stories.slice(1, 4).map((story, index) => ({
    story,
    percent: 0,
    timeAgo: '',
    chapter: story.currentChapter || '',
    timeFormatted: '',
    narrator: story.narrator,
    index,
  }));

  // 5 new release stories
  const newReleaseStories = stories.slice(4, 9);

  // Filtered new releases
  const filteredNewReleases = newReleaseStories.filter(s => {
    if (releaseFilter === 'exclusive') return s.badge === 'ĐỘC QUYỀN' || s.badge === 'TOP 1 TUẦN';
    if (releaseFilter === 'completed') return s.status === 'Hoàn thành';
    return true;
  });

  // Top 5 trending stories
  const trendingStories = [
    ...stories.slice(0, 5).map((story, index) => ({ rank: String(index + 1).padStart(2, '0'), story, rankColor: index === 0 ? 'text-tertiary' : 'text-[#908fa0]', change: '', tag: '' })),
  ];

  return (
    <div className="flex flex-col w-full">
      {/* Subtle Ambient Top Glow */}
      <div className="relative w-full overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[70rem] h-[28rem] bg-gradient-to-b from-primary-container/20 via-secondary-container/10 to-transparent blur-3xl pointer-events-none -z-10" />
        <div className="absolute top-20 right-[-10%] w-[32rem] h-[32rem] bg-tertiary-container/10 rounded-full blur-[100px] pointer-events-none -z-10" />

        {/* 1. HERO DISCOVERY SECTION */}
        <section className="max-w-7xl mx-auto px-4 lg:px-8 pt-6 pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Hero Narrative */}
            <div className="lg:col-span-7 flex flex-col gap-4 text-left">
              {/* Overline Badge */}
              <div className="inline-flex items-center gap-2 self-start px-3 py-1 rounded-full bg-[#262a33] border border-white/5 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary" />
                </span>
                <span className="text-xs text-tertiary-fixed tracking-wide uppercase font-semibold">
                  Âm Thanh Đa Tầng Không Gian 8D
                </span>
                <span className="text-xs text-[#908fa0]">• Mới ra mắt</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-5xl font-extrabold text-[#dfe2ee] tracking-tight leading-[1.15]">
                Đọc những câu chuyện. <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-primary-fixed-dim via-secondary to-tertiary bg-clip-text text-transparent">
                  Nghe những thế giới.
                </span>
              </h1>

              <p className="text-base text-[#c7c4d7] max-w-xl leading-relaxed">
                Hàng nghìn tiểu thuyết huyền ảo, tiên hiệp, kiếm hiệp và audio chất lượng phòng thu, giọng đọc AI song hành cùng voice talent truyền cảm đỉnh cao.
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => onSelectTab('discover')}
                  className="px-6 py-3 rounded-full bg-primary text-on-primary text-sm font-bold shadow-[0_0_28px_-4px_rgba(192,193,255,0.45)] hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-xl">explore</span>
                  <span>Khám phá truyện</span>
                </button>

                <button
                  onClick={() => playStory(heroStory, 128)}
                  className="px-6 py-3 rounded-full bg-[#262a33] hover:bg-[#353942] text-[#dfe2ee] text-sm font-semibold transition-all flex items-center gap-2 border border-white/10 group"
                  type="button"
                >
                  <span className="material-symbols-outlined text-tertiary group-hover:scale-110 transition-transform">
                    play_circle
                  </span>
                  <span>Nghe ngay - Tập mới</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#31353e] text-tertiary font-bold">
                    VIP
                  </span>
                </button>
              </div>

              {/* Quick Metrics Bar */}
              <div className="grid grid-cols-3 gap-4 pt-4 max-w-lg">
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-[#dfe2ee]">120K+</span>
                  <span className="text-xs text-[#908fa0]">Chương truyện chữ</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-tertiary">45.000h</span>
                  <span className="text-xs text-[#908fa0]">Thời lượng Audio HD</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-secondary">99.4%</span>
                  <span className="text-xs text-[#908fa0]">Độc giả hài lòng</span>
                </div>
              </div>
            </div>

            {/* Right Hero Showcase Featured Card */}
            <div className="lg:col-span-5 relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary-container/30 to-tertiary/20 rounded-3xl blur-2xl -z-10 transform scale-95" />
              <div className="relative bg-[#1c2028] border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-4 flex flex-col gap-3 group">
                <div
                  onClick={() => onOpenStoryDetail(heroStory.id)}
                  className="relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-[#0a0e16] cursor-pointer"
                >
                  <img
                    src={heroStory.cover}
                    alt={heroStory.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e16] via-[#0a0e16]/40 to-transparent" />

                  {/* Badges on Cover */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="px-2 py-1 rounded-md bg-error text-on-error text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 shadow-sm">
                      <span className="material-symbols-outlined text-[12px]">local_fire_department</span>
                      TOP 1 TUẦN
                    </span>
                    <span className="px-2 py-1 rounded-md bg-[#31353e]/90 backdrop-blur-md text-primary text-[10px] font-bold border border-white/10">
                      Bản Diễn Đọc Độc Quyền
                    </span>
                  </div>

                  {/* Animated Sound Waveform Indicator */}
                  <div className="absolute bottom-3 right-3 flex items-end gap-1 px-2.5 py-1 rounded-full bg-[#0a0e16]/80 backdrop-blur-md border border-white/10">
                    <span className="w-1 h-3 bg-primary rounded-full animate-pulse" />
                    <span className="w-1 h-6 bg-secondary rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-4 bg-tertiary rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                    <span className="w-1 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '450ms' }} />
                    <span className="text-[10px] text-[#dfe2ee] font-mono ml-1">HQ 320k</span>
                  </div>
                </div>

                {/* Novel Data */}
                <div className="flex flex-col gap-1 text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {heroStory.genres.map(g => (
                        <span key={g} className="px-2 py-0.5 rounded-full bg-[#31353e] text-primary text-xs font-medium">
                          {g}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 text-tertiary font-bold text-xs">
                      <span className="material-symbols-outlined text-base">star</span>
                      <span>4.9</span>
                      <span className="text-[#908fa0] font-normal text-[11px]">(12.4k)</span>
                    </div>
                  </div>

                  <h3
                    onClick={() => onOpenStoryDetail(heroStory.id)}
                    className="text-lg font-bold text-[#dfe2ee] tracking-tight line-clamp-1 hover:text-primary transition-colors cursor-pointer"
                  >
                    {heroStory.title}
                  </h3>

                  <p className="text-xs text-[#c7c4d7]">
                    Tác giả: <span className="text-[#dfe2ee] font-semibold">{heroStory.author}</span> • Diễn đọc:{' '}
                    <span className="text-primary font-medium">{heroStory.narrator}</span>
                  </p>

                  {/* Stats strip */}
                  <div className="flex items-center justify-between pt-1 text-[#908fa0] text-xs">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">headphones</span> {heroStory.listeners} lượt nghe
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">auto_stories</span> {heroStory.chaptersCount} chương
                    </span>
                    <span className="flex items-center gap-1 text-tertiary">
                      <span className="material-symbols-outlined text-sm">bolt</span> Đang ra C.851
                    </span>
                  </div>

                  {/* Quick action banner inside hero card */}
                  <div className="mt-1 p-2 rounded-xl bg-[#262a33] flex items-center justify-between gap-3 border border-white/5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-lg">play_arrow</span>
                      </div>
                      <div className="min-w-0 text-left">
                        <p className="text-xs text-[#dfe2ee] font-semibold truncate">
                          Chương 128: Kiếm Phá Vạn Pháp
                        </p>
                        <p className="text-[10px] text-[#908fa0]">Nghe thử miễn phí 15 phút</p>
                      </div>
                    </div>
                    <button
                      onClick={() => playStory(heroStory, 128)}
                      className="px-3 py-1.5 rounded-full bg-primary text-on-primary text-xs font-bold hover:brightness-110 flex-shrink-0 shadow-sm transition-transform active:scale-95"
                      type="button"
                    >
                      Nghe ngay
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 2. 'TIẾP TỤC NGHE' (CONTINUE LISTENING) ROW */}
      <section className="w-full bg-[#0a0e16] py-8 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-left">
              <div className="p-1.5 rounded-lg bg-[#262a33] text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">history</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#dfe2ee]">Tiếp tục nghe</h2>
                <p className="text-xs text-[#908fa0]">Nhật ký thính giác lưu trữ tự động trên đám mây</p>
              </div>
            </div>
            <button
              onClick={() => onSelectTab('library')}
              className="text-xs text-primary hover:underline font-semibold flex items-center gap-0.5"
            >
              Tủ nghe cá nhân <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>

          {/* Continue Listening Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {continueListeningItems.map((item, i) => (
              <div
                key={i}
                className="bg-[#1c2028] border border-white/5 rounded-xl p-3 flex flex-col justify-between gap-3 hover:bg-[#262a33] transition-colors group text-left"
              >
                <div className="flex items-start gap-3">
                  <div
                    onClick={() => onOpenStoryDetail(item.story.id)}
                    className="w-14 h-18 rounded-lg overflow-hidden bg-[#31353e] flex-shrink-0 relative cursor-pointer"
                  >
                    <img
                      src={item.story.cover}
                      alt={item.story.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <span className="absolute top-1 left-1 px-1 rounded bg-[#0a0e16]/80 text-secondary text-[9px] font-bold">
                      Audio
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] text-tertiary font-bold">Đã nghe {item.percent}%</span>
                      <span className="text-[10px] text-[#908fa0]">{item.timeAgo}</span>
                    </div>
                    <h3
                      onClick={() => onOpenStoryDetail(item.story.id)}
                      className="text-xs font-semibold text-[#dfe2ee] truncate group-hover:text-primary transition-colors cursor-pointer mt-0.5"
                    >
                      {item.story.title}
                    </h3>
                    <p className="text-xs text-[#c7c4d7] truncate">{item.chapter}</p>
                    <div className="flex items-center text-[#908fa0] text-[11px] mt-1 font-mono">
                      <span>{item.timeFormatted}</span>
                    </div>
                  </div>
                </div>

                {/* Progress Bar & Quick Action */}
                <div className="flex flex-col gap-1.5 pt-1 border-t border-white/5">
                  <div className="w-full h-1.5 bg-[#31353e] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#c7c4d7]">Giọng đọc: {item.narrator}</span>
                    <button
                      onClick={() => playStory(item.story)}
                      className="px-2.5 py-1 rounded-full bg-primary-container/30 hover:bg-primary text-primary hover:text-on-primary text-xs font-bold flex items-center gap-1 transition-all"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-sm">play_arrow</span> Tiếp tục
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. 'TRUYỆN MỚI CẬP NHẬT' (NEW RELEASES GRID) */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-10 w-full" id="kham-pha">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 text-left">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-secondary-container text-secondary flex items-center justify-center">
                  <span className="material-symbols-outlined text-sm">fiber_new</span>
                </span>
                <span className="text-xs text-secondary uppercase tracking-widest font-bold">Mới Lên Sóng</span>
              </div>
              <h2 className="text-2xl font-bold text-[#dfe2ee] tracking-tight">Truyện Mới Cập Nhật Audio</h2>
              <p className="text-xs text-[#c7c4d7]">
                Cập nhật liên tục các tập lồng tiếng và dịch thuật mới nhất trong 24 giờ qua
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-[#181c24] p-1 rounded-full border border-white/5">
              <button
                onClick={() => setReleaseFilter('all')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  releaseFilter === 'all'
                    ? 'bg-[#262a33] text-primary shadow-sm'
                    : 'text-[#c7c4d7] hover:text-[#dfe2ee]'
                }`}
                type="button"
              >
                Tất cả
              </button>
              <button
                onClick={() => setReleaseFilter('exclusive')}
                className={`px-3 py-1 rounded-full text-xs transition-all ${
                  releaseFilter === 'exclusive'
                    ? 'bg-[#262a33] text-primary font-bold shadow-sm'
                    : 'text-[#c7c4d7] hover:text-[#dfe2ee]'
                }`}
                type="button"
              >
                Độc quyền
              </button>
              <button
                onClick={() => setReleaseFilter('completed')}
                className={`px-3 py-1 rounded-full text-xs transition-all ${
                  releaseFilter === 'completed'
                    ? 'bg-[#262a33] text-primary font-bold shadow-sm'
                    : 'text-[#c7c4d7] hover:text-[#dfe2ee]'
                }`}
                type="button"
              >
                Trọn bộ
              </button>
            </div>
          </div>

          {/* 5-Column Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredNewReleases.map(story => (
              <StoryCard
                key={story.id}
                story={story}
                onOpenDetail={onOpenStoryDetail}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 4. 'KHÁM PHÁ THEO THỂ LOẠI HOT' (GENRE BENTO GRID) */}
      <section className="w-full bg-[#181c24] py-10 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 flex flex-col gap-6 text-left">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-tertiary uppercase tracking-widest font-bold">Thế Giới Phân Loại</span>
              <h2 className="text-2xl font-bold text-[#dfe2ee] tracking-tight">Khám Phá Theo Thể Loại Hot</h2>
            </div>
            <button
              onClick={() => onSelectTab('genres')}
              className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
            >
              Xem tất cả 24 thể loại <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>

          {/* 8 Genres Bento/Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
              {genres.slice(0, 8).map(genre => (
              <button
                key={genre.id}
                onClick={() => onSelectGenre(genre.slug)}
                className="relative p-4 rounded-2xl bg-[#1c2028] border border-white/5 overflow-hidden group hover:bg-[#262a33] transition-all shadow-sm text-left"
              >
                <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-primary-container/10 rounded-full blur-xl group-hover:scale-150 transition-transform" />
                <div className="flex items-center justify-between pb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl">{genre.icon}</span>
                  </div>
                  {genre.rankBadge && (
                    <span className="text-[10px] text-tertiary font-mono font-bold">
                      {genre.rankBadge}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-[#dfe2ee] group-hover:text-primary transition-colors">
                  {genre.name}
                </h3>
                <p className="text-xs text-[#908fa0] mt-1">
                  {genre.count.toLocaleString()} truyện • {(genre.audioCount / 1000).toFixed(1)}k audio
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 5 & 6. SPLIT SECTION: 'ĐANG THỊNH HÀNH' (TRENDING 01-05) & 'BẢNG XẾP HẠNG TU VI ĐỘC GIẢ' */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
          {/* 5. TRENDING RANKINGS (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded bg-tertiary text-on-tertiary flex items-center justify-center">
                  <span className="material-symbols-outlined text-sm font-bold">trending_up</span>
                </div>
                <h2 className="text-xl font-bold text-[#dfe2ee]">Đang Thịnh Hành</h2>
              </div>
              {/* Timeframe Selector Tabs */}
              <div className="inline-flex p-1 rounded-full bg-[#262a33] self-start border border-white/5">
                <button
                  onClick={() => setRankingTimeframe('24h')}
                  className={`px-3 py-1 rounded-full text-xs transition-all ${
                    rankingTimeframe === '24h'
                      ? 'bg-primary text-on-primary font-bold'
                      : 'text-[#c7c4d7] hover:text-[#dfe2ee]'
                  }`}
                  type="button"
                >
                  24 Giờ
                </button>
                <button
                  onClick={() => setRankingTimeframe('7d')}
                  className={`px-3 py-1 rounded-full text-xs transition-all ${
                    rankingTimeframe === '7d'
                      ? 'bg-primary text-on-primary font-bold'
                      : 'text-[#c7c4d7] hover:text-[#dfe2ee]'
                  }`}
                  type="button"
                >
                  7 Ngày
                </button>
                <button
                  onClick={() => setRankingTimeframe('30d')}
                  className={`px-3 py-1 rounded-full text-xs transition-all ${
                    rankingTimeframe === '30d'
                      ? 'bg-primary text-on-primary font-bold'
                      : 'text-[#c7c4d7] hover:text-[#dfe2ee]'
                  }`}
                  type="button"
                >
                  30 Ngày
                </button>
              </div>
            </div>

            {/* 01 - 05 Ranked List */}
            <div className="flex flex-col gap-2">
              {trendingStories.map(item => (
                <div
                  key={item.rank}
                  className="bg-[#1c2028] border border-white/5 rounded-2xl p-3 flex items-center justify-between gap-4 hover:bg-[#262a33] transition-colors group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className={`text-2xl sm:text-3xl font-black ${item.rankColor} w-8 text-center flex-shrink-0 font-mono`}>
                      {item.rank}
                    </span>
                    <div
                      onClick={() => onOpenStoryDetail(item.story.id)}
                      className="w-12 h-16 rounded-lg overflow-hidden bg-[#0a0e16] flex-shrink-0 cursor-pointer"
                    >
                      <img
                        src={item.story.cover}
                        alt={item.story.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      {item.tag && (
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-tertiary/20 text-tertiary font-bold">
                            {item.tag}
                          </span>
                          {item.change && (
                            <span className="text-[10px] text-tertiary flex items-center">
                              <span className="material-symbols-outlined text-xs">arrow_upward</span>
                              {item.change}
                            </span>
                          )}
                        </div>
                      )}
                      <h4
                        onClick={() => onOpenStoryDetail(item.story.id)}
                        className="text-sm font-bold text-[#dfe2ee] truncate group-hover:text-primary transition-colors cursor-pointer"
                      >
                        {item.story.title}
                      </h4>
                      <p className="text-xs text-[#908fa0] truncate">
                        {item.story.author} • {item.story.listeners} lượt nghe
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => playStory(item.story)}
                    className="w-10 h-10 rounded-full bg-[#31353e] group-hover:bg-primary text-[#dfe2ee] group-hover:text-on-primary flex items-center justify-center flex-shrink-0 transition-colors shadow-sm"
                    type="button"
                    title={`Phát ${item.story.title}`}
                  >
                    <span className="material-symbols-outlined text-xl">play_arrow</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 6. BẢNG XẾP HẠNG TU VI ĐỘC GIẢ (GAMIFICATION) (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded bg-secondary text-on-secondary flex items-center justify-center">
                  <span className="material-symbols-outlined text-sm">military_tech</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#dfe2ee]">Tu Vi Độc Giả</h2>
                  <p className="text-xs text-[#908fa0]">Càng nghe nhiều, cảnh giới càng thăng tiến</p>
                </div>
              </div>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#262a33] text-tertiary font-bold border border-white/5">
                Mùa Tu Vi 04
              </span>
            </div>

            {/* Cultivation Tier Progress Mini Strip */}
            <div className="bg-[#262a33] border border-white/5 rounded-xl p-3 flex items-center justify-between text-center">
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-[#908fa0]">Cảnh giới</span>
                <span className="text-xs font-bold text-[#dfe2ee]">Luyện Khí</span>
              </div>
              <span className="material-symbols-outlined text-[#908fa0] text-xs">arrow_forward</span>
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-[#908fa0]">Cảnh giới</span>
                <span className="text-xs font-bold text-primary">Trúc Cơ</span>
              </div>
              <span className="material-symbols-outlined text-[#908fa0] text-xs">arrow_forward</span>
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-[#908fa0]">Cảnh giới</span>
                <span className="text-xs font-bold text-tertiary">Kim Đan</span>
              </div>
              <span className="material-symbols-outlined text-[#908fa0] text-xs">arrow_forward</span>
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-[#908fa0]">Đỉnh phong</span>
                <span className="text-xs font-bold text-secondary">Hóa Thần</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#262a33] border border-white/5 text-sm text-[#908fa0]">
              Bảng tu vi chưa có trong Backend Contract.
            </div>
          </div>
        </div>
      </section>

      {/* 7. 'AUDIOCOIN & MEMBERSHIP SHOWCASE BANNER' */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-8 w-full text-left">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#1c2028] to-[#262a33] border border-white/10 p-6 lg:p-10 shadow-xl">
          <div className="absolute -right-10 -bottom-10 w-96 h-96 bg-tertiary-container/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute left-1/3 top-0 w-64 h-64 bg-primary-container/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 flex flex-col gap-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-tertiary-container text-on-tertiary self-start text-xs font-bold">
                <span className="material-symbols-outlined text-base">diamond</span>
                HỆ SINH THÁI AUDIOCOIN & VIP PASS
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-[#dfe2ee] tracking-tight">
                Mở Khóa Toàn Bộ Vũ Trụ Thính Giác Không Giới Hạn
              </h2>
              <p className="text-sm text-[#c7c4d7] max-w-xl leading-relaxed">
                Sử dụng AudioCoin (AC) để mở khóa các tập truyện độc quyền trước 7 ngày, gửi quà tiếp sức tinh thần cho tác giả và voice talent yêu thích của bạn.
              </p>

              {/* 3 Value propositions */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-[#31353e] text-tertiary material-symbols-outlined text-lg">
                    lock_open
                  </span>
                  <span className="text-xs font-semibold text-[#dfe2ee]">Mở khóa VIP sớm</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-[#31353e] text-secondary material-symbols-outlined text-lg">
                    redeem
                  </span>
                  <span className="text-xs font-semibold text-[#dfe2ee]">Tặng quà Tác giả</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-[#31353e] text-primary material-symbols-outlined text-lg">
                    high_quality
                  </span>
                  <span className="text-xs font-semibold text-[#dfe2ee]">Âm thanh Lossless</span>
                </div>
              </div>
            </div>

            {/* Action Card on Right */}
            <div className="lg:col-span-5 bg-[#0a0e16]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex flex-col gap-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#908fa0]">Gói hội viên đề xuất</span>
                  <h3 className="text-lg font-bold text-tertiary-fixed">Thần Vương VIP PASS</h3>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-[#dfe2ee] font-mono">69.000đ</span>
                  <span className="text-[11px] text-[#908fa0]">/ tháng</span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-[#c7c4d7]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-tertiary text-base">check_circle</span>
                  <span>Nghe không giới hạn hơn 50.000 chương VIP</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-tertiary text-base">check_circle</span>
                  <span>Tặng 500 AudioCoin mỗi tháng để ủng hộ tác giả</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-tertiary text-base">check_circle</span>
                  <span>Tải nghe offline không giới hạn trên thiết bị</span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={onOpenVip}
                  className="flex-1 py-2.5 rounded-full bg-gradient-to-r from-tertiary to-tertiary-container text-on-tertiary text-xs font-bold hover:brightness-110 active:scale-95 transition-all text-center shadow-[0_0_20px_-4px_rgba(255,185,95,0.4)]"
                  type="button"
                >
                  Đăng Ký VIP Ngay
                </button>
                <button
                  onClick={onOpenWallet}
                  className="px-5 py-2.5 rounded-full bg-[#31353e] hover:bg-[#353942] text-[#dfe2ee] text-xs font-semibold transition-colors border border-white/5"
                  type="button"
                >
                  Nạp AC
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
