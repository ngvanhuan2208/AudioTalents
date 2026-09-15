import React, { useEffect, useState } from 'react';
import { useAudio } from '../../context/AudioContext';
import { getStories } from '../../services/contentService';
import { Story } from '../../types';

interface RankingsViewProps {
  onOpenStoryDetail: (storyId: string) => void;
}

export const Rankings: React.FC<RankingsViewProps> = ({ onOpenStoryDetail }) => {
  const { playStory } = useAudio();
  const [rankingType, setRankingType] = useState<'stories' | 'cultivation'>('stories');
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month'>('week');
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStories({sort: 'popular'})
      .then(setStories)
      .catch(() => setError('Không thể tải bảng xếp hạng. Vui lòng thử lại sau.'))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return <div className="max-w-7xl mx-auto px-4 lg:px-8 py-16 text-center text-sm text-[#908fa0]">Đang tải bảng xếp hạng...</div>;
  }

  if (error) {
    return <div className="max-w-7xl mx-auto px-4 lg:px-8 py-16 text-center text-sm text-error">{error}</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 w-full text-left">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-white/10">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-tertiary text-on-tertiary">
              <span className="material-symbols-outlined text-base">military_tech</span>
            </span>
            <span className="text-xs uppercase tracking-widest text-tertiary font-bold">Vinh Danh Đỉnh Phong</span>
          </div>
          <h1 className="text-3xl font-extrabold text-[#dfe2ee] tracking-tight">Bảng Xếp Hạng Toàn Vũ Trụ</h1>
          <p className="text-xs text-[#908fa0]">Cập nhật định kỳ lúc 00:00 hàng ngày theo dữ liệu thính giác thực tế</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 bg-[#1c2028] p-1.5 rounded-2xl border border-white/5">
          <button
            onClick={() => setRankingType('stories')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              rankingType === 'stories'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-[#c7c4d7] hover:text-[#dfe2ee]'
            }`}
          >
            Bảng Xếp Hạng Truyện
          </button>
          <button
            onClick={() => setRankingType('cultivation')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              rankingType === 'cultivation'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-[#c7c4d7] hover:text-[#dfe2ee]'
            }`}
          >
            Phong Thần Bảng Tu Vi
          </button>
        </div>
      </div>

      {/* SUB-VIEW 1: STORY RANKINGS */}
      {rankingType === 'stories' && (
        <div className="py-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#908fa0]">Xếp theo tổng lượt nghe và điểm đề cử:</span>
            <div className="flex items-center gap-1.5 bg-[#181c24] p-1 rounded-full border border-white/5 text-xs">
              <button
                onClick={() => setTimeframe('day')}
                className={`px-3 py-1 rounded-full ${timeframe === 'day' ? 'bg-[#262a33] text-tertiary font-bold' : 'text-[#908fa0]'}`}
              >
                Hôm nay
              </button>
              <button
                onClick={() => setTimeframe('week')}
                className={`px-3 py-1 rounded-full ${timeframe === 'week' ? 'bg-[#262a33] text-tertiary font-bold' : 'text-[#908fa0]'}`}
              >
                Tuần này
              </button>
              <button
                onClick={() => setTimeframe('month')}
                className={`px-3 py-1 rounded-full ${timeframe === 'month' ? 'bg-[#262a33] text-tertiary font-bold' : 'text-[#908fa0]'}`}
              >
                Tháng này
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {stories.length > 0 ? stories.map((story, index) => {
              const rankNum = index + 1;
              const rankColor =
                rankNum === 1
                  ? 'text-tertiary'
                  : rankNum === 2
                  ? 'text-secondary'
                  : rankNum === 3
                  ? 'text-primary'
                  : 'text-[#908fa0]';

              return (
                <div
                  key={story.id}
                  className="bg-[#1c2028] border border-white/5 hover:border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4 transition-all hover:bg-[#262a33]"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className={`text-2xl sm:text-3xl font-black font-mono w-8 text-center flex-shrink-0 ${rankColor}`}>
                      {rankNum.toString().padStart(2, '0')}
                    </span>
                    <div
                      onClick={() => onOpenStoryDetail(story.id)}
                      className="w-14 h-20 rounded-xl overflow-hidden bg-[#0a0e16] flex-shrink-0 cursor-pointer shadow-md"
                    >
                      <img src={story.cover} alt={story.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-secondary font-semibold">
                          {story.genres.slice(0, 2).join(' • ')}
                        </span>
                        {rankNum === 1 && (
                          <span className="px-1.5 py-0.2 rounded bg-error text-on-error text-[9px] font-bold">
                            QUÁN QUÂN
                          </span>
                        )}
                      </div>
                      <h3
                        onClick={() => onOpenStoryDetail(story.id)}
                        className="text-base font-bold text-[#dfe2ee] truncate hover:text-primary transition-colors cursor-pointer"
                      >
                        {story.title}
                      </h3>
                      <p className="text-xs text-[#908fa0] truncate">
                        Tác giả: {story.author} • Diễn đọc: <span className="text-primary">{story.narrator}</span>
                      </p>
                      <div className="flex items-center gap-4 text-xs text-[#c7c4d7] mt-1">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm text-tertiary">star</span>
                          {story.rating.toFixed(1)}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">headphones</span>
                          {story.listeners}
                        </span>
                        <span>{story.chaptersCount} chương</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => playStory(story)}
                    className="w-11 h-11 rounded-full bg-[#31353e] hover:bg-primary text-[#dfe2ee] hover:text-on-primary flex items-center justify-center flex-shrink-0 transition-colors shadow-md"
                    title={`Nghe ngay ${story.title}`}
                  >
                    <span className="material-symbols-outlined text-2xl">play_arrow</span>
                  </button>
                </div>
              );
            }) : <div className="py-12 text-center text-sm text-[#908fa0]">Bảng xếp hạng chưa có dữ liệu.</div>}
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: CULTIVATION LEADERBOARD */}
      {rankingType === 'cultivation' && (
        <div className="py-6 space-y-6">
          {/* Cultivation system explainer card */}
          <div className="bg-gradient-to-r from-[#1c2028] via-[#262a33] to-[#1c2028] border border-white/10 rounded-3xl p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs text-tertiary font-bold uppercase tracking-wider">Hệ Thống Thăng Cảnh Tu Vi</span>
                <h3 className="text-lg font-bold text-[#dfe2ee] mt-1">Nghe Sách Luyện Tâm - Đột Phá Tiên Giới</h3>
                <p className="text-xs text-[#c7c4d7] max-w-xl mt-1 leading-relaxed">
                  Mỗi 10 giây nghe audio tích lũy +2 XP. Mỗi chương hoàn thành +50 XP. Tặng quà tác giả nhận x5 XP. Đạt top 10 mỗi tháng nhận danh hiệu tôn quý và AudioCoin vĩnh viễn!
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-[#0a0e16]/60 border border-white/10 text-center min-w-[160px]">
                <span className="text-[11px] text-[#908fa0]">Tu Vi Của Bạn</span>
                <p className="text-lg font-bold text-tertiary">Kim Đan tầng 3</p>
                <span className="text-xs font-mono text-[#dfe2ee]">84.250 XP</span>
              </div>
            </div>
          </div>

          {/* User List */}
          <div className="space-y-3">
            <div className="py-12 text-center text-sm text-[#908fa0]">API bảng tu vi chưa có trong Backend Contract.</div>
          </div>
        </div>
      )}
    </div>
  );
};
