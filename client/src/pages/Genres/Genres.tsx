import React, { useEffect, useState } from 'react';
import { getGenres, getStories } from '../../services/contentService';
import { Genre, Story } from '../../types';

interface GenresViewProps {
  onSelectGenre: (genreSlug: string) => void;
  onOpenDetail: (storyId: string) => void;
}

export const Genres: React.FC<GenresViewProps> = ({ onSelectGenre, onOpenDetail }) => {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getGenres(), getStories()])
      .then(([loadedGenres, loadedStories]) => {
        setGenres(loadedGenres);
        setStories(loadedStories);
      })
      .catch(() => setError('Không thể tải thể loại. Vui lòng thử lại sau.'))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return <div className="max-w-7xl mx-auto px-4 lg:px-8 py-16 text-center text-sm text-[#908fa0]">Đang tải thể loại...</div>;
  }

  if (error) {
    return <div className="max-w-7xl mx-auto px-4 lg:px-8 py-16 text-center text-sm text-error">{error}</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 w-full text-left">
      <div className="flex flex-col gap-1 pb-6">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-tertiary-container text-on-tertiary">
            <span className="material-symbols-outlined text-lg">category</span>
          </span>
          <span className="text-xs uppercase tracking-widest text-tertiary font-bold">Phân Loại Chuyên Biệt</span>
        </div>
        <h1 className="text-3xl font-extrabold text-[#dfe2ee] tracking-tight">Tất Cả Thể Loại Truyện</h1>
        <p className="text-xs text-[#908fa0]">Khám phá các thế giới văn học mạng phong phú với hơn 24 nhánh phân loại</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {genres.map(genre => {
          // Find sample stories for this genre
          const matchingStories = stories.filter(s =>
            s.genres.some(g => g.toLowerCase().includes(genre.name.toLowerCase()))
          );

          return (
            <div
              key={genre.id}
              className="bg-[#1c2028] border border-white/5 hover:border-white/10 rounded-2xl p-5 flex flex-col justify-between gap-4 group transition-all duration-300 shadow-md"
            >
              <div>
                <div className="flex items-center justify-between pb-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl">{genre.icon}</span>
                  </div>
                  {genre.rankBadge && (
                    <span className="px-2 py-0.5 rounded-md bg-tertiary/20 text-tertiary text-xs font-mono font-bold">
                      {genre.rankBadge}
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-bold text-[#dfe2ee] group-hover:text-primary transition-colors">
                  {genre.name}
                </h3>
                <p className="text-xs text-[#908fa0] mt-1 leading-relaxed">
                  {genre.description}
                </p>

                <div className="flex items-center gap-4 text-xs text-[#c7c4d7] pt-3">
                  <span><strong>{genre.count.toLocaleString()}</strong> truyện</span>
                  <span>•</span>
                  <span className="text-tertiary"><strong>{(genre.audioCount / 1000).toFixed(1)}k</strong> tập audio</span>
                </div>
              </div>

              {/* Sample stories thumbnail strip */}
              {matchingStories.length > 0 && (
                <div className="pt-3 border-t border-white/5">
                  <span className="text-[11px] text-[#908fa0] block mb-2">Tác phẩm tiêu biểu:</span>
                  <div className="flex items-center gap-2">
                    {matchingStories.slice(0, 3).map(st => (
                      <div
                        key={st.id}
                        onClick={() => onOpenDetail(st.id)}
                        className="w-12 h-16 rounded-md overflow-hidden bg-[#0a0e16] cursor-pointer hover:scale-105 transition-transform"
                        title={st.title}
                      >
                        <img src={st.cover} alt={st.title} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => onSelectGenre(genre.slug)}
                className="w-full py-2 rounded-xl bg-[#262a33] hover:bg-primary hover:text-on-primary text-[#dfe2ee] text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                Khám phá mục này
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
