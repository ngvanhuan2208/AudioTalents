import React, { useRef, useEffect } from 'react';
import { useAudio } from '../../context/AudioContext';

interface ExpandedPlayerModalProps {
  onOpenReader: () => void;
  onOpenGift: () => void;
}

export const ExpandedPlayerModal: React.FC<ExpandedPlayerModalProps> = ({ onOpenReader, onOpenGift }) => {
  const {
    currentStory,
    currentChapter,
    isPlaying,
    currentTime,
    duration,
    progressPercent,
    speed,
    sleepTimer,
    isExpanded,
    activeSegmentIndex,
    togglePlay,
    seek,
    skip,
    nextChapter,
    prevChapter,
    setSpeed,
    setIsExpanded,
  } = useAudio();

  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Auto scroll transcript to active segment
  useEffect(() => {
    if (activeSegmentIndex >= 0 && transcriptContainerRef.current) {
      const activeEl = transcriptContainerRef.current.children[activeSegmentIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeSegmentIndex]);

  if (!currentStory || !currentChapter) return null;
  if (!isExpanded) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0e16]/95 backdrop-blur-2xl flex flex-col p-4 sm:p-6 lg:p-10 animate-in fade-in zoom-in-95 duration-200">
      {/* Top Header */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <span className="material-symbols-outlined text-xl">spatial_audio_off</span>
          </span>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Phòng Thu Không Gian 8D</h3>
            <p className="text-[11px] text-[#908fa0]">Đang phát với chất lượng Lossless 320kbps</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenGift}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-tertiary-container hover:bg-tertiary text-on-tertiary text-xs font-bold transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">redeem</span>
            Tặng quà
          </button>
          <button
            onClick={() => setIsExpanded(false)}
            className="p-2 rounded-full bg-[#1c2028] hover:bg-[#262a33] text-[#dfe2ee] transition-colors border border-white/10"
            title="Thu nhỏ"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
      </div>

      {/* Main Dual-Column Content */}
      <div className="max-w-6xl w-full mx-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 py-6 overflow-hidden items-center">
        {/* Left Column: Artwork, Story Info, and Big Controls */}
        <div className="lg:col-span-6 flex flex-col items-center text-center gap-5">
          {/* Artwork with ambient blur halo */}
          <div className="relative group">
            <div className="absolute -inset-4 bg-gradient-to-tr from-primary/30 to-secondary/20 rounded-3xl blur-2xl -z-10 group-hover:scale-105 transition-transform" />
            <div className="w-56 h-72 sm:w-64 sm:h-84 rounded-2xl overflow-hidden shadow-2xl border border-white/15 relative bg-[#181c24]">
              <img
                src={currentStory.cover}
                alt={currentStory.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <span className="absolute bottom-3 left-3 px-2 py-0.5 rounded bg-primary text-on-primary text-[10px] font-bold">
                {currentStory.audioQuality}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1 max-w-md">
            <span className="text-xs text-secondary font-semibold uppercase tracking-wider">
              {currentStory.genres.join(' • ')}
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-[#dfe2ee]">
              {currentStory.title}
            </h2>
            <p className="text-sm text-[#908fa0]">
              {currentChapter.title}
            </p>
            <p className="text-xs text-primary font-medium mt-0.5">
              Diễn đọc: {currentStory.narrator} ({currentStory.narratorGroup})
            </p>
          </div>

          {/* Animated Waveform Bars */}
          <div className="flex items-center gap-1.5 h-8">
            {[40, 70, 25, 90, 60, 30, 85, 45, 100, 50, 75, 35, 95, 65, 40].map((h, i) => (
              <span
                key={i}
                className={`w-1 rounded-full bg-gradient-to-t from-primary to-secondary transition-all duration-300 ${
                  isPlaying ? 'animate-pulse' : 'opacity-40'
                }`}
                style={{
                  height: isPlaying ? `${h}%` : '20%',
                  animationDelay: `${i * 80}ms`
                }}
              />
            ))}
          </div>

          {/* Scrubber & Timestamps */}
          <div className="w-full max-w-md flex flex-col gap-1.5">
            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const percent = (clickX / rect.width);
                seek(percent * duration);
              }}
              className="w-full h-2 bg-[#262a33] hover:h-2.5 rounded-full overflow-hidden cursor-pointer relative transition-all"
            >
              <div
                className="h-full bg-gradient-to-r from-primary via-secondary to-tertiary rounded-full transition-all duration-100"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-[#908fa0] font-mono">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Big Player Buttons */}
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              onClick={prevChapter}
              className="text-[#c7c4d7] hover:text-[#dfe2ee] p-2 rounded-full hover:bg-white/5 transition-colors"
              title="Chương trước"
            >
              <span className="material-symbols-outlined text-2xl">skip_previous</span>
            </button>

            <button
              onClick={() => skip(-15)}
              className="text-[#c7c4d7] hover:text-[#dfe2ee] p-2 rounded-full hover:bg-white/5 transition-colors"
              title="Lùi 15s"
            >
              <span className="material-symbols-outlined text-2xl">replay_10</span>
            </button>

            <button
              onClick={togglePlay}
              className="w-14 h-14 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-[0_0_30px_rgba(192,193,255,0.5)] hover:scale-105 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-3xl font-bold">
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>

            <button
              onClick={() => skip(15)}
              className="text-[#c7c4d7] hover:text-[#dfe2ee] p-2 rounded-full hover:bg-white/5 transition-colors"
              title="Tua 15s"
            >
              <span className="material-symbols-outlined text-2xl">forward_10</span>
            </button>

            <button
              onClick={nextChapter}
              className="text-[#c7c4d7] hover:text-[#dfe2ee] p-2 rounded-full hover:bg-white/5 transition-colors"
              title="Chương sau"
            >
              <span className="material-symbols-outlined text-2xl">skip_next</span>
            </button>
          </div>
        </div>

        {/* Right Column: Synchronized Interactive Transcript */}
        <div className="lg:col-span-6 flex flex-col h-full bg-[#181c24] rounded-2xl border border-white/10 p-4 sm:p-6 overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-lg">subtitles</span>
              <h3 className="text-sm font-bold text-[#dfe2ee]">Transcript Đồng Bộ Âm Thanh</h3>
            </div>
            <button
              onClick={() => {
                setIsExpanded(false);
                onOpenReader();
              }}
              className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">menu_book</span>
              Chuyển sang chế độ đọc truyện
            </button>
          </div>

          <p className="text-[11px] text-[#908fa0] py-2">
            * Nhấp vào bất kỳ đoạn thoại nào bên dưới để tua âm thanh trực tiếp đến thời điểm đó.
          </p>

          {/* Transcript Scroll Area */}
          <div
            ref={transcriptContainerRef}
            className="flex-1 overflow-y-auto space-y-3 pr-2 scroll-smooth py-2"
          >
            {currentChapter.transcript && currentChapter.transcript.length > 0 ? (
              currentChapter.transcript.map((segment, idx) => {
                const isActive = idx === activeSegmentIndex;
                return (
                  <div
                    key={idx}
                    onClick={() => seek(segment.startSec)}
                    className={`p-3 rounded-xl cursor-pointer transition-all duration-200 border text-left ${
                      isActive
                        ? 'bg-primary/15 border-primary text-[#dfe2ee] shadow-sm scale-[1.01]'
                        : 'bg-[#1c2028] border-white/5 hover:bg-[#262a33] text-[#c7c4d7]'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-1 text-[11px]">
                      <span className={`font-semibold px-2 py-0.5 rounded-full text-[10px] ${
                        isActive ? 'bg-primary text-on-primary' : 'bg-[#31353e] text-[#dfe2ee]'
                      }`}>
                        {segment.speaker}
                      </span>
                      <span className="font-mono text-[#908fa0]">
                        {formatTime(segment.startSec)} - {formatTime(segment.endSec)}
                      </span>
                    </div>
                    <p className={`text-sm sm:text-base leading-relaxed ${isActive ? 'font-medium text-white' : ''}`}>
                      {segment.text}
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-[#908fa0] text-sm">
                Đang chuẩn bị bản ghi âm thanh cho tập này...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
