import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Story, Chapter } from '../types';
import {createPlaybackRequestGuard, nextPlaybackPosition, NoPlayableAudioError, previousPlaybackPosition, resolvePlayableStory} from '../services/playbackService';

interface AudioContextType {
  currentStory: Story | null;
  currentChapter: Chapter | null;
  isPlaying: boolean;
  isResolving: boolean;
  playbackError: string | null;
  currentTime: number;
  duration: number;
  progressPercent: number;
  volume: number;
  speed: number;
  sleepTimer: number | null; // minutes remaining
  isExpanded: boolean;
  activeSegmentIndex: number;
  playStory: (story: Story, chapterIndex?: number, startSec?: number) => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  seekPercent: (percent: number) => void;
  skip: (seconds: number) => void;
  setSpeed: (rate: number) => void;
  setVolume: (val: number) => void;
  setSleepTimerMinutes: (mins: number | null) => void;
  nextChapter: () => void;
  prevChapter: () => void;
  setIsExpanded: (open: boolean) => void;
}

const AudioPlayerContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [currentPartIndex, setCurrentPartIndex] = useState(0);
  const [shouldPlay, setShouldPlay] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [volume, setVolumeState] = useState<number>(0.8);
  const [speed, setSpeedState] = useState<number>(1.2);
  const [sleepTimer, setSleepTimerState] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const sleepIntervalRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingStartSecRef = useRef(0);
  const requestGuardRef = useRef(createPlaybackRequestGuard());

  const activePart = currentChapter?.audioParts?.[currentPartIndex];
  const playbackUrl = activePart?.audioUrl;

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  // Compute active transcript segment
  const activeSegmentIndex = currentChapter?.transcript?.findIndex(
    seg => currentTime >= seg.startSec && currentTime <= seg.endSec
  ) ?? -1;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = speed;
    audio.volume = volume;
  }, [speed, volume, playbackUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let active = true;
    if (!shouldPlay || !playbackUrl) {
      audio.pause();
      return () => { active = false; };
    }
    void audio.play().catch(() => {
      if (!active) return;
      setShouldPlay(false);
      setIsPlaying(false);
      setPlaybackError('Không thể phát Audio lúc này.');
    });
    return () => { active = false; };
  }, [shouldPlay, playbackUrl]);

  useEffect(() => () => {
    requestGuardRef.current.invalidate();
    if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
    audioRef.current?.pause();
  }, []);

  // Sleep timer countdown
  useEffect(() => {
    if (sleepTimer && sleepTimer > 0 && isPlaying) {
      sleepIntervalRef.current = window.setInterval(() => {
        setSleepTimerState(prev => {
          if (!prev || prev <= 1) {
            setShouldPlay(false);
            setIsPlaying(false);
            return null;
          }
          return prev - 1;
        });
      }, 60000); // every minute
    } else {
      if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
    }
    return () => {
      if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
    };
  }, [sleepTimer, isPlaying]);

  const playStory = (story: Story, chapterIndex?: number, startSec?: number) => {
    const request = requestGuardRef.current.next();
    audioRef.current?.pause();
    setShouldPlay(false);
    setIsPlaying(false);
    setCurrentStory(null);
    setCurrentChapter(null);
    setCurrentPartIndex(0);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackError(null);
    setIsResolving(true);
    void resolvePlayableStory(story.id, chapterIndex)
      .then(({story: resolvedStory, chapter}) => {
        if (!requestGuardRef.current.isCurrent(request)) return;
        pendingStartSecRef.current = Math.max(0, startSec ?? 0);
        setCurrentStory(resolvedStory);
        setCurrentChapter(chapter);
        setCurrentPartIndex(0);
        setDuration(chapter.audioParts?.[0]?.durationSec || chapter.durationSec || 0);
        setCurrentTime(pendingStartSecRef.current);
        setShouldPlay(true);
      })
      .catch(error => {
        if (!requestGuardRef.current.isCurrent(request)) return;
        setPlaybackError(error instanceof NoPlayableAudioError ? error.message : 'Không thể tải Audio lúc này.');
      })
      .finally(() => {
        if (requestGuardRef.current.isCurrent(request)) setIsResolving(false);
      });
  };

  const togglePlay = () => {
    if (!playbackUrl) return;
    setPlaybackError(null);
    setShouldPlay(prev => !prev);
  };

  const seek = (seconds: number) => {
    const clamped = Math.max(0, Math.min(duration, seconds));
    if (audioRef.current) audioRef.current.currentTime = clamped;
    setCurrentTime(clamped);
  };

  const seekPercent = (percent: number) => {
    const target = (Math.max(0, Math.min(100, percent)) / 100) * duration;
    seek(target);
  };

  const skip = (seconds: number) => {
    seek(currentTime + seconds);
  };

  const setSpeed = (rate: number) => {
    setSpeedState(rate);
  };

  const setVolume = (val: number) => {
    setVolumeState(val);
  };

  const setSleepTimerMinutes = (mins: number | null) => {
    setSleepTimerState(mins);
  };

  const nextChapter = () => {
    if (!currentStory || !currentChapter) return;
    const next = nextPlaybackPosition(currentStory, currentChapter.id, currentPartIndex);
    if (next) {
      setCurrentChapter(next.chapter);
      setCurrentPartIndex(next.partIndex);
      setDuration(next.chapter.audioParts?.[next.partIndex]?.durationSec || next.chapter.durationSec || 0);
      setCurrentTime(0);
      pendingStartSecRef.current = 0;
      setIsPlaying(false);
      setShouldPlay(true);
    } else {
      setShouldPlay(false);
      setIsPlaying(false);
    }
  };

  const prevChapter = () => {
    if (!currentStory || !currentChapter) return;
    const prev = previousPlaybackPosition(currentStory, currentChapter.id, currentPartIndex);
    if (prev) {
      setCurrentChapter(prev.chapter);
      setCurrentPartIndex(prev.partIndex);
      setDuration(prev.chapter.audioParts?.[prev.partIndex]?.durationSec || prev.chapter.durationSec || 0);
      setCurrentTime(0);
      pendingStartSecRef.current = 0;
      setIsPlaying(false);
      setShouldPlay(true);
    } else {
      seek(0);
    }
  };

  return (
    <AudioPlayerContext.Provider
      value={{
        currentStory,
        currentChapter,
        isPlaying,
        isResolving,
        playbackError,
        currentTime,
        duration,
        progressPercent,
        volume,
        speed,
        sleepTimer,
        isExpanded,
        activeSegmentIndex,
        playStory,
        togglePlay,
        seek,
        seekPercent,
        skip,
        setSpeed,
        setVolume,
        setSleepTimerMinutes,
        nextChapter,
        prevChapter,
        setIsExpanded
      }}
    >
      {playbackUrl && <audio key={playbackUrl} ref={audioRef} src={playbackUrl} preload="auto" onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)} onLoadedMetadata={event => {
        const audio = event.currentTarget;
        setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
        if (pendingStartSecRef.current > 0) {
          audio.currentTime = Math.min(pendingStartSecRef.current, Number.isFinite(audio.duration) ? audio.duration : pendingStartSecRef.current);
          pendingStartSecRef.current = 0;
        }
      }} onPlaying={() => { setIsPlaying(true); setPlaybackError(null); }} onPause={() => setIsPlaying(false)} onEnded={nextChapter} onError={() => {
        setShouldPlay(false);
        setIsPlaying(false);
        setPlaybackError('Không thể phát Audio lúc này.');
      }} />}
      {isResolving && <div role="status" className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[#1c2028] px-4 py-2 text-sm text-[#dfe2ee] shadow-lg">Đang tìm tập Audio...</div>}
      {playbackError && <div role="alert" className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-error/30 bg-[#1c2028] px-4 py-2 text-sm text-error shadow-lg">{playbackError}</div>}
      {children}
    </AudioPlayerContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};
