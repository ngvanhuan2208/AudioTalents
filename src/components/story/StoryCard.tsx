import React from 'react';
import { Story } from '../../types';
import { useAudio } from '../../context/AudioContext';

interface StoryCardProps {
  story: Story;
  onOpenDetail: (storyId: string) => void;
}

export const StoryCard: React.FC<StoryCardProps> = ({ story, onOpenDetail }) => {
  const { playStory, currentStory, isPlaying } = useAudio();

  const isCurrentStory = currentStory.id === story.id;

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    playStory(story);
  };

  const getBadgeColor = (badge?: string) => {
    switch (badge) {
      case 'TOP 1 TUẦN':
      case 'SIÊU PHẨM':
        return 'bg-error text-on-error';
      case 'MỚI RA':
        return 'bg-primary-container text-on-primary-container';
      case 'KỊCH THANH':
        return 'bg-tertiary-container text-on-tertiary';
      default:
        return 'bg-primary text-on-primary';
    }
  };

  return (
    <div
      onClick={() => onOpenDetail(story.id)}
      className="bg-[#1c2028] hover:bg-[#262a33] rounded-2xl p-2 flex flex-col gap-2 group transition-all duration-300 shadow-md border border-white/5 hover:border-white/10 cursor-pointer"
    >
      {/* Cover Image Container */}
      <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-[#0a0e16]">
        <img
          src={story.cover}
          alt={story.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e16]/90 via-transparent to-transparent pointer-events-none" />

        {/* Top Badge */}
        {story.badge && (
          <span
            className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${getBadgeColor(
              story.badge
            )} shadow-sm`}
          >
            {story.badge}
          </span>
        )}

        {/* Bottom Metadata on image */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-tertiary text-xs">
          <span className="flex items-center gap-0.5 font-bold">
            <span className="material-symbols-outlined text-sm text-tertiary">star</span>
            {story.rating.toFixed(1)}
          </span>
          <span className="text-[#dfe2ee]/90 text-[11px] flex items-center gap-0.5 font-mono">
            <span className="material-symbols-outlined text-xs">headphones</span>
            {story.listeners}
          </span>
        </div>

        {/* Play Button Overlay */}
        <button
          onClick={handlePlayClick}
          className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-200 shadow-xl hover:brightness-110 active:scale-95"
          type="button"
          title={`Nghe ngay ${story.title}`}
        >
          <span className="material-symbols-outlined text-2xl">
            {isCurrentStory && isPlaying ? 'pause' : 'play_arrow'}
          </span>
        </button>
      </div>

      {/* Story Metadata */}
      <div className="flex flex-col gap-0.5 px-1 text-left">
        <span className="text-[11px] text-secondary font-semibold truncate">
          {story.genres.slice(0, 2).join(' • ')}
        </span>
        <h3 className="text-sm font-semibold text-[#dfe2ee] line-clamp-1 group-hover:text-primary transition-colors">
          {story.title}
        </h3>
        <div className="flex items-center justify-between text-xs text-[#908fa0] pt-0.5">
          <span>{story.chaptersCount} chương</span>
          <span className="text-tertiary font-medium">{story.totalAudioHours}</span>
        </div>
      </div>
    </div>
  );
};
