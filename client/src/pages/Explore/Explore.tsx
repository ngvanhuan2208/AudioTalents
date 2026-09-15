import React, { useState, useMemo, useEffect } from 'react';
import { StoryCard } from '../../components/story/StoryCard';
import { getGenres, getStories, searchStories } from '../../services/contentService';
import { Genre, Story } from '../../types';

interface DiscoverViewProps {
  initialGenre?: string;
  initialSearch?: string;
  onOpenDetail: (storyId: string) => void;
}

export const Explore: React.FC<DiscoverViewProps> = ({
  initialGenre,
  initialSearch = '',
  onOpenDetail,
}) => {
  const [search, setSearch] = useState<string>(initialSearch);
  const [selectedGenre, setSelectedGenre] = useState<string>(initialGenre || 'all');
  const [selectedFormat, setSelectedFormat] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'listeners' | 'rating' | 'newest'>('listeners');
  const [stories, setStories] = useState<Story[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    Promise.all([
      search.trim() ? searchStories(search) : getStories(),
      getGenres(),
    ]).then(([loadedStories, loadedGenres]) => {
      if (!active) return;
      setStories(loadedStories);
      setGenres(loadedGenres);
    }).catch(() => {
      if (active) setError('Không thể tải dữ liệu khám phá. Vui lòng thử lại sau.');
    }).finally(() => {
      if (active) setIsLoading(false);
    });

    return () => { active = false; };
  }, [search]);

  // Filtered and sorted stories
  const filteredStories = useMemo(() => {
    return stories.filter(s => {
      // Search match
      const matchSearch =
        !search.trim() ||
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.author.toLowerCase().includes(search.toLowerCase()) ||
        s.narrator.toLowerCase().includes(search.toLowerCase());

      // Genre match
      const matchGenre =
        selectedGenre === 'all' ||
        s.genres.some(g => g.toLowerCase().includes(selectedGenre.toLowerCase())) ||
        (selectedGenre === 'tien-hiep' && s.genres.includes('Tiên Hiệp')) ||
        (selectedGenre === 'huyen-huyen' && s.genres.includes('Huyền Huyễn')) ||
        (selectedGenre === 'kiem-hiep' && s.genres.includes('Kiếm Hiệp')) ||
        (selectedGenre === 'do-thi' && s.genres.includes('Đô Thị')) ||
        (selectedGenre === 'khoa-huyen' && s.genres.includes('Khoa Huyễn'));

      // Format match
      const matchFormat =
        selectedFormat === 'all' ||
        (selectedFormat === '8d' && s.audioQuality.includes('8D')) ||
        (selectedFormat === 'lossless' && s.audioQuality.includes('Lossless'));

      // Status match
      const matchStatus =
        selectedStatus === 'all' ||
        (selectedStatus === 'ongoing' && s.status === 'Đang ra') ||
        (selectedStatus === 'completed' && s.status === 'Hoàn thành');

      return matchSearch && matchGenre && matchFormat && matchStatus;
    }).sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'newest') return b.chaptersCount - a.chaptersCount;
      return b.listeners.localeCompare(a.listeners); // approx sort
    });
  }, [stories, search, selectedGenre, selectedFormat, selectedStatus, sortBy]);

  if (isLoading) {
    return <div className="max-w-7xl mx-auto px-4 lg:px-8 py-16 text-center text-sm text-[#908fa0]">Đang tải nội dung...</div>;
  }

  if (error) {
    return <div className="max-w-7xl mx-auto px-4 lg:px-8 py-16 text-center text-sm text-error">{error}</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 w-full text-left">
      {/* Header title */}
      <div className="flex flex-col gap-1 pb-6">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <span className="material-symbols-outlined text-lg">explore</span>
          </span>
          <span className="text-xs uppercase tracking-widest text-primary font-bold">Thư Viện Vũ Trụ</span>
        </div>
        <h1 className="text-3xl font-extrabold text-[#dfe2ee] tracking-tight">Khám Phá & Tìm Kiếm</h1>
        <p className="text-xs text-[#908fa0]">Tìm kiếm trong hơn 12.000 tác phẩm tiểu thuyết chữ & audio kịch thanh cao cấp</p>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-[#1c2028] border border-white/10 rounded-2xl p-4 sm:p-6 mb-8 space-y-4">
        {/* Search input bar */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#908fa0]">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo tên truyện, tác giả hoặc giọng đọc..."
            className="w-full bg-[#181c24] border border-white/10 rounded-full pl-10 pr-4 py-2.5 text-xs sm:text-sm text-[#dfe2ee] placeholder-[#908fa0] focus:outline-none focus:border-primary"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#908fa0] hover:text-[#dfe2ee]"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-[#908fa0] font-semibold mr-1">Thể loại:</span>
          <button
            onClick={() => setSelectedGenre('all')}
            className={`px-3 py-1 rounded-full transition-all ${
              selectedGenre === 'all'
                ? 'bg-primary text-on-primary font-bold shadow-sm'
                : 'bg-[#262a33] text-[#c7c4d7] hover:text-[#dfe2ee]'
            }`}
          >
            Tất cả
          </button>
          {genres.slice(0, 7).map(g => (
            <button
              key={g.id}
              onClick={() => setSelectedGenre(g.slug)}
              className={`px-3 py-1 rounded-full transition-all ${
                selectedGenre === g.slug
                  ? 'bg-primary text-on-primary font-bold shadow-sm'
                  : 'bg-[#262a33] text-[#c7c4d7] hover:text-[#dfe2ee]'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>

        {/* Secondary filters row */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-white/5 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[#908fa0]">Chất lượng:</span>
              <select
                value={selectedFormat}
                onChange={e => setSelectedFormat(e.target.value)}
                className="bg-[#262a33] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-[#dfe2ee] focus:outline-none"
              >
                <option value="all">Tất cả định dạng</option>
                <option value="8d">Không gian 8D</option>
                <option value="lossless">Lossless 320kbps</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[#908fa0]">Trạng thái:</span>
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="bg-[#262a33] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-[#dfe2ee] focus:outline-none"
              >
                <option value="all">Tất cả</option>
                <option value="ongoing">Đang ra</option>
                <option value="completed">Hoàn thành</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[#908fa0]">Sắp xếp:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-[#262a33] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-[#dfe2ee] focus:outline-none font-semibold"
            >
              <option value="listeners">Lượt nghe nhiều nhất</option>
              <option value="rating">Đánh giá cao nhất</option>
              <option value="newest">Số lượng chương</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between pb-4">
        <span className="text-xs text-[#908fa0]">
          Tìm thấy <strong className="text-[#dfe2ee]">{filteredStories.length}</strong> tác phẩm phù hợp
        </span>
      </div>

      {/* Grid */}
      {filteredStories.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredStories.map(story => (
            <StoryCard
              key={story.id}
              story={story}
              onOpenDetail={onOpenDetail}
            />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center bg-[#1c2028] rounded-2xl border border-white/5">
          <span className="material-symbols-outlined text-4xl text-[#908fa0] mb-2">sentiment_dissatisfied</span>
          <h3 className="text-base font-bold text-[#dfe2ee]">Không tìm thấy tác phẩm phù hợp</h3>
          <p className="text-xs text-[#908fa0] mt-1">Hãy thử tìm với từ khóa khác hoặc điều chỉnh bộ lọc thể loại.</p>
        </div>
      )}
    </div>
  );
};
