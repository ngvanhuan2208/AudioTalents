import React, { useState, useRef } from 'react';
import { useAudio } from '../../context/AudioContext';
import { useAutoHidePlayer } from '../../hooks/useAutoHidePlayer';

interface AudioPlayerDockProps {
  onOpenStoryDetail: (storyId: string) => void;
}

export const AudioPlayerDock: React.FC<AudioPlayerDockProps> = ({ onOpenStoryDetail }) => {
  const {
    currentStory,
    currentChapter,
    isPlaying,
    currentTime,
    duration,
    progressPercent,
    speed,
    sleepTimer,
    volume,
    togglePlay,
    seekPercent,
    skip,
    setSpeed,
    setVolume,
    setSleepTimerMinutes,
    setIsExpanded,
  } = useAudio();

  const [showSleepMenu, setShowSleepMenu] = useState<boolean>(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState<boolean>(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const {playerRef, isVisible, revealPlayer} = useAutoHidePlayer();

  if (!currentStory || !currentChapter) return null;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    seekPercent(percent);
  };

  const speeds = [0.8, 1.0, 1.2, 1.5];
  const cycleSpeed = () => {
    const nextIdx = (speeds.indexOf(speed) + 1) % speeds.length;
    setSpeed(speeds[nextIdx]);
  };

  return (
    <>
      {!isVisible && (
        <div
          aria-hidden="true"
          onMouseEnter={revealPlayer}
          onClick={revealPlayer}
          className="fixed bottom-0 left-0 right-0 z-39 h-6"
        />
      )}
      <aside
        ref={playerRef}
        aria-hidden={!isVisible}
        inert={!isVisible}
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-3xl transition-[transform,opacity] duration-350 ease-out ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
      <div className="bg-[#262a33]/92 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-[0_16px_32px_-8px_rgba(0,0,0,0.7)] p-2 flex flex-col gap-1.5">
        {/* Interactive Scrubbable Progress Bar */}
        <div
          ref={progressBarRef}
          onClick={handleSeekClick}
          className="relative w-full h-1.5 bg-[#31353e] hover:h-2 rounded-full overflow-hidden cursor-pointer group transition-all"
          title={`Tua: ${formatTime(currentTime)} / ${formatTime(duration)}`}
        >
          <div
            className="h-full bg-gradient-to-r from-primary to-secondary rounded-full relative transition-all duration-150"
            style={{ width: `${progressPercent}%` }}
          >
            {/* Scrubber thumb handle on hover */}
            <span className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white opacity-0 group-hover:opacity-100 shadow-sm transition-opacity" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-1">
          {/* Story & Chapter Info */}
          <div
            onClick={() => onOpenStoryDetail(currentStory.id)}
            className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-lg bg-[#0a0e16] overflow-hidden flex-shrink-0 relative border border-white/5">
              <img
                src={currentStory.cover}
                alt={currentStory.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
              <span className="absolute inset-0 bg-black/10 group-hover:bg-transparent" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-[#dfe2ee] truncate group-hover:text-primary transition-colors">
                  {currentStory.title}
                </p>
                <span className="font-mono text-[10px] text-[#908fa0] flex-shrink-0">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
              <p className="text-[11px] text-[#c7c4d7] truncate">
                {currentChapter.audioUrl ? `${currentChapter.title} • Diễn đọc: ` : 'Audio chưa khả dụng. '}
                {currentChapter.audioUrl && <span className="text-primary font-medium">{currentStory.narrator}</span>}
              </p>
            </div>
          </div>

          {/* Primary Controls */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              aria-label="Tua lại 15 giây"
              onClick={() => skip(-15)}
              className="text-[#c7c4d7] hover:text-[#dfe2ee] p-1.5 rounded-full hover:bg-white/5 transition-colors relative group"
              type="button"
              title="Lùi 15s"
            >
              <span className="material-symbols-outlined text-lg">replay_10</span>
            </button>

            <button
              aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
              onClick={togglePlay}
              className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-[0_0_24px_-4px_rgba(99,102,241,0.5)] hover:brightness-110 active:scale-95 transition-all"
              type="button"
            >
              <span className="material-symbols-outlined text-2xl font-bold">
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>

            <button
              aria-label="Tua tới 15 giây"
              onClick={() => skip(15)}
              className="text-[#c7c4d7] hover:text-[#dfe2ee] p-1.5 rounded-full hover:bg-white/5 transition-colors relative group"
              type="button"
              title="Tua 15s"
            >
              <span className="material-symbols-outlined text-lg">forward_10</span>
            </button>
          </div>

          {/* Secondary Controls (Speed, Sleep timer, Volume, Fullscreen) */}
          <div className="hidden sm:flex items-center gap-2">
            {/* Speed Pill */}
            <button
              onClick={cycleSpeed}
              className="px-2 py-0.5 rounded-full bg-[#31353e] hover:bg-[#353942] text-xs font-semibold text-[#dfe2ee] transition-colors border border-white/5 font-mono"
              type="button"
              title="Tốc độ phát"
            >
              {speed}x
            </button>

            {/* Sleep Timer */}
            <div className="relative">
              <button
                aria-label="Hẹn giờ tắt"
                onClick={() => setShowSleepMenu(!showSleepMenu)}
                className={`p-1.5 rounded-full transition-colors ${
                  sleepTimer ? 'text-tertiary bg-tertiary/10' : 'text-[#c7c4d7] hover:text-[#dfe2ee] hover:bg-white/5'
                }`}
                type="button"
                title="Hẹn giờ ngủ"
              >
                <span className="material-symbols-outlined text-lg">bedtime</span>
                {sleepTimer && (
                  <span className="absolute -top-1 -right-1 px-1 rounded-full bg-tertiary text-on-tertiary text-[8px] font-bold">
                    {sleepTimer}m
                  </span>
                )}
              </button>

              {showSleepMenu && (
                <div className="absolute bottom-10 right-0 bg-[#1c2028] border border-white/10 rounded-xl p-1.5 shadow-xl min-w-[130px] z-50 text-left">
                  <p className="text-[10px] text-[#908fa0] px-2 py-1 font-bold">HẸN GIỜ TẮT</p>
                  {[15, 30, 45, 60].map(mins => (
                    <button
                      key={mins}
                      onClick={() => {
                        setSleepTimerMinutes(mins);
                        setShowSleepMenu(false);
                      }}
                      className={`w-full text-left px-2.5 py-1 text-xs rounded-lg hover:bg-[#262a33] ${
                        sleepTimer === mins ? 'text-tertiary font-bold' : 'text-[#dfe2ee]'
                      }`}
                    >
                      {mins} phút
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setSleepTimerMinutes(null);
                      setShowSleepMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1 text-xs rounded-lg hover:bg-[#262a33] text-error"
                  >
                    Tắt hẹn giờ
                  </button>
                </div>
              )}
            </div>

            {/* Volume */}
            <div className="relative flex items-center">
              <button
                onClick={() => setShowVolumeSlider(!showVolumeSlider)}
                className="text-[#c7c4d7] hover:text-[#dfe2ee] p-1.5 rounded-full hover:bg-white/5 transition-colors"
                type="button"
              >
                <span className="material-symbols-outlined text-lg">
                  {volume === 0 ? 'volume_off' : volume < 0.5 ? 'volume_down' : 'volume_up'}
                </span>
              </button>

              {showVolumeSlider && (
                <div className="absolute bottom-10 -right-4 bg-[#1c2028] border border-white/10 rounded-xl p-2 shadow-xl z-50 flex flex-col items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={e => setVolume(parseFloat(e.target.value))}
                    className="w-20 accent-primary cursor-pointer"
                  />
                  <span className="text-[10px] text-[#908fa0] font-mono">{Math.round(volume * 100)}%</span>
                </div>
              )}
            </div>

            {/* Expand Modal button */}
            <button
              aria-label="Mở rộng trình phát"
              onClick={() => setIsExpanded(true)}
              className="text-[#c7c4d7] hover:text-[#dfe2ee] p-1.5 rounded-full hover:bg-white/5 transition-colors"
              type="button"
              title="Phóng to giao diện nghe"
            >
              <span className="material-symbols-outlined text-lg">open_in_full</span>
            </button>
          </div>
        </div>
      </div>
      </aside>
    </>
  );
};
