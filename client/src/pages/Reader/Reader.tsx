import React, { useState, useEffect, useRef } from 'react';
import { useAudio } from '../../context/AudioContext';
import { readerSettingsService } from '../../services/readerSettingsService';
import { ReaderSettings } from '../../types';

interface ReaderViewProps {
  onBack: () => void;
  onOpenAudioModal: () => void;
}

export const Reader: React.FC<ReaderViewProps> = ({ onBack, onOpenAudioModal }) => {
  const {
    currentStory,
    currentChapter,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    nextChapter,
    prevChapter,
    seek,
  } = useAudio();

  const [settings, setSettings] = useState<ReaderSettings>(readerSettingsService.get());
  const [showSettingsPanel, setShowSettingsPanel] = useState<boolean>(false);
  const readerContentRef = useRef<HTMLDivElement>(null);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleUpdateSettings = (newSettings: Partial<ReaderSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    readerSettingsService.save(updated);
  };

  // Theme styling definitions
  const getThemeClass = () => {
    switch (settings.theme) {
      case 'sepia':
        return 'bg-[#2b2620] text-[#f4ecd8]';
      case 'slate':
        return 'bg-[#1e232d] text-[#e2e8f0]';
      case 'pureBlack':
        return 'bg-[#000000] text-[#e0e0e0]';
      case 'obsidian':
      default:
        return 'bg-[#0f131c] text-[#dfe2ee]';
    }
  };

  // Find active transcript index for sync highlight
  const activeSegmentIndex = currentChapter?.transcript?.findIndex(
    seg => currentTime >= seg.startSec && currentTime <= seg.endSec
  ) ?? -1;

  // Auto scroll to active reading paragraph
  useEffect(() => {
    if (activeSegmentIndex >= 0 && readerContentRef.current) {
      const el = readerContentRef.current.children[activeSegmentIndex] as HTMLElement;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeSegmentIndex]);

  if (!currentStory || !currentChapter) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-[#908fa0]">Chưa có chương để đọc.</div>;
  }

  return (
    <div className={`min-h-screen w-full transition-colors duration-300 ${getThemeClass()} pb-24`}>
      {/* Top Floating Reading Bar */}
      <header className="sticky top-0 z-40 bg-[#0f131c]/90 backdrop-blur-md border-b border-white/10 px-4 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-full hover:bg-white/10 text-[#c7c4d7] hover:text-[#dfe2ee]"
            title="Quay lại"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <div>
            <h2 className="text-xs font-bold text-[#dfe2ee] truncate max-w-xs sm:max-w-md">
              {currentStory.title}
            </h2>
            <p className="text-[11px] text-[#908fa0] truncate">{currentChapter.title}</p>
          </div>
        </div>

        {/* Audio Quick Bar & Settings */}
        <div className="flex items-center gap-3">
          {/* Synchronized Audio Pill */}
          <div className="flex items-center gap-2 bg-[#1c2028] px-3 py-1 rounded-full border border-white/10">
            <button
              onClick={togglePlay}
              className="text-primary hover:text-primary-fixed transition-colors flex items-center"
              title={isPlaying ? 'Tạm dừng audio' : 'Phát audio đồng bộ'}
            >
              <span className="material-symbols-outlined text-xl">
                {isPlaying ? 'pause_circle' : 'play_circle'}
              </span>
            </button>
            <span className="text-[11px] font-mono text-[#908fa0] hidden sm:inline">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <button
              onClick={onOpenAudioModal}
              className="text-[#908fa0] hover:text-[#dfe2ee] transition-colors"
              title="Mở trình phát đầy đủ"
            >
              <span className="material-symbols-outlined text-sm">open_in_new</span>
            </button>
          </div>

          {/* Reader Settings Toggle Button */}
          <button
            onClick={() => setShowSettingsPanel(!showSettingsPanel)}
            className="p-2 rounded-full bg-[#1c2028] hover:bg-[#262a33] text-[#c7c4d7] hover:text-[#dfe2ee] border border-white/10 transition-colors"
            title="Tùy chỉnh đọc (Font chữ, cỡ chữ, nền)"
          >
            <span className="material-symbols-outlined text-lg">format_size</span>
          </button>
        </div>
      </header>

      {/* Reader Settings Drawer/Popover */}
      {showSettingsPanel && (
        <div className="sticky top-16 z-30 max-w-md mx-auto bg-[#1c2028] border border-white/10 rounded-2xl p-4 shadow-2xl mb-4 animate-in slide-in-from-top-2 text-left">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="text-xs font-bold text-[#dfe2ee]">Tùy chỉnh giao diện đọc</span>
            <button onClick={() => setShowSettingsPanel(false)} className="text-[#908fa0] hover:text-[#dfe2ee]">
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>

          <div className="space-y-4 pt-3 text-xs">
            {/* Font Size */}
            <div>
              <div className="flex justify-between text-[#908fa0] mb-1">
                <span>Cỡ chữ:</span>
                <span className="font-mono text-[#dfe2ee]">{settings.fontSize}px</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleUpdateSettings({ fontSize: Math.max(14, settings.fontSize - 1) })}
                  className="px-2.5 py-1 rounded bg-[#262a33] hover:bg-[#31353e] text-[#dfe2ee] font-bold"
                >
                  A-
                </button>
                <input
                  type="range"
                  min="14"
                  max="28"
                  value={settings.fontSize}
                  onChange={e => handleUpdateSettings({ fontSize: parseInt(e.target.value) })}
                  className="flex-1 accent-primary cursor-pointer"
                />
                <button
                  onClick={() => handleUpdateSettings({ fontSize: Math.min(28, settings.fontSize + 1) })}
                  className="px-2.5 py-1 rounded bg-[#262a33] hover:bg-[#31353e] text-[#dfe2ee] font-bold"
                >
                  A+
                </button>
              </div>
            </div>

            {/* Font Family */}
            <div>
              <span className="text-[#908fa0] block mb-1">Font chữ:</span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'Literata', label: 'Literata (Sách)' },
                  { id: 'Plus Jakarta Sans', label: 'Jakarta (Không chân)' },
                  { id: 'serif', label: 'Serif Cổ Điển' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => handleUpdateSettings({ fontFamily: f.id as any })}
                    className={`p-1.5 rounded-lg border text-center ${
                      settings.fontFamily === f.id
                        ? 'border-primary bg-primary/20 text-[#dfe2ee] font-bold'
                        : 'border-white/5 bg-[#181c24] text-[#908fa0]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Themes */}
            <div>
              <span className="text-[#908fa0] block mb-1">Màu nền đọc:</span>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'obsidian', label: 'Huyền Thạch', bg: 'bg-[#0f131c]' },
                  { id: 'slate', label: 'Xám Đêm', bg: 'bg-[#1e232d]' },
                  { id: 'sepia', label: 'Giấy Cũ', bg: 'bg-[#2b2620]' },
                  { id: 'pureBlack', label: 'OLED Đen', bg: 'bg-[#000000]' },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleUpdateSettings({ theme: t.id as any })}
                    className={`p-2 rounded-xl border flex flex-col items-center gap-1 ${
                      settings.theme === t.id ? 'border-primary ring-1 ring-primary' : 'border-white/10'
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-full border border-white/20 ${t.bg}`} />
                    <span className="text-[10px] text-[#c7c4d7]">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Reading Container */}
      <main className="max-w-3xl mx-auto px-6 lg:px-8 py-8 text-left">
        {/* Chapter Title Header */}
        <div className="text-center pb-8 border-b border-white/10 mb-8">
          <span className="text-xs text-primary font-bold tracking-widest uppercase block mb-1">
            {currentStory.title}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {currentChapter.title}
          </h1>
          <p className="text-xs text-[#908fa0] mt-2">
            Diễn đọc: {currentStory.narrator} • Thời lượng Audio: {Math.round(currentChapter.durationSec / 60)} phút
          </p>
        </div>

        {/* Text Paragraphs (Synchronized with Transcript) */}
        <div
          ref={readerContentRef}
          style={{
            fontFamily: settings.fontFamily,
            fontSize: `${settings.fontSize}px`,
            lineHeight: settings.lineHeight
          }}
          className="space-y-6 select-text"
        >
          {currentChapter.transcript && currentChapter.transcript.length > 0 ? (
            currentChapter.transcript.map((seg, idx) => {
              const isActive = idx === activeSegmentIndex;
              return (
                <p
                  key={idx}
                  onClick={() => seek(seg.startSec)}
                  className={`p-3 rounded-2xl cursor-pointer transition-all duration-300 relative ${
                    isActive
                      ? 'bg-primary/15 border-l-4 border-primary text-white font-medium shadow-md'
                      : 'hover:bg-white/5'
                  }`}
                  title="Nhấp để nghe đoạn này"
                >
                  {seg.text}
                </p>
              );
            })
          ) : (
            <div className="space-y-4 leading-relaxed">
              <p>Trời đất mênh mông, vạn đạo tranh phong...</p>
              <p>Chương này đang tiếp tục được cập nhật văn bản và bản phối âm đa chiều.</p>
            </div>
          )}
        </div>

        {/* Bottom Chapter Switcher */}
        <div className="flex items-center justify-between pt-12 mt-12 border-t border-white/10">
          <button
            onClick={prevChapter}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#1c2028] hover:bg-[#262a33] text-xs font-semibold text-[#dfe2ee] transition-colors border border-white/5"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Chương trước
          </button>

          <button
            onClick={onBack}
            className="px-4 py-2.5 rounded-full bg-[#1c2028] hover:bg-[#262a33] text-xs font-semibold text-[#dfe2ee] transition-colors border border-white/5"
          >
            Mục lục
          </button>

          <button
            onClick={nextChapter}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-primary text-on-primary text-xs font-bold hover:brightness-110 transition-all shadow-md"
          >
            Chương sau
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </button>
        </div>
      </main>
    </div>
  );
};
