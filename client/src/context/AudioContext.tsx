import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Story, Chapter } from '../types';

interface AudioContextType {
  currentStory: Story | null;
  currentChapter: Chapter | null;
  isPlaying: boolean;
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
  const [currentTime, setCurrentTime] = useState<number>(420); // 7m in
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(0.8);
  const [speed, setSpeedState] = useState<number>(1.2);
  const [sleepTimer, setSleepTimerState] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const timerRef = useRef<number | null>(null);
  const sleepIntervalRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
    if (isPlaying && currentChapter?.audioUrl) {
      void audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [isPlaying, currentChapter?.audioUrl, speed, volume]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
    audioRef.current?.pause();
  }, []);

  // Sleep timer countdown
  useEffect(() => {
    if (sleepTimer && sleepTimer > 0 && isPlaying) {
      sleepIntervalRef.current = window.setInterval(() => {
        setSleepTimerState(prev => {
          if (!prev || prev <= 1) {
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
    setCurrentStory(story);
    const targetChapter = chapterIndex
      ? story.chapters.find(c => c.index === chapterIndex) || story.chapters[0]
      : story.chapters[0];
    if (!targetChapter) {
      setCurrentChapter(null);
      setIsPlaying(false);
      return;
    }
    setCurrentChapter(targetChapter);
    setDuration(targetChapter.durationSec || 1200);
    setCurrentTime(startSec !== undefined ? startSec : 0);
    setIsPlaying(true);
  };

  const togglePlay = () => {
    if (!currentChapter?.audioUrl) return;
    setIsPlaying(prev => !prev);
  };

  const seek = (seconds: number) => {
    const clamped = Math.max(0, Math.min(duration, seconds));
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
    const currentIndex = currentStory.chapters.findIndex(c => c.id === currentChapter.id);
    if (currentIndex >= 0 && currentIndex < currentStory.chapters.length - 1) {
      const next = currentStory.chapters[currentIndex + 1];
      setCurrentChapter(next);
      setDuration(next.durationSec);
      setCurrentTime(0);
    } else {
      // Loop or pause
      setIsPlaying(false);
    }
  };

  const prevChapter = () => {
    if (!currentStory || !currentChapter) return;
    const currentIndex = currentStory.chapters.findIndex(c => c.id === currentChapter.id);
    if (currentIndex > 0) {
      const prev = currentStory.chapters[currentIndex - 1];
      setCurrentChapter(prev);
      setDuration(prev.durationSec);
      setCurrentTime(0);
    } else {
      setCurrentTime(0);
    }
  };

  return (
    <AudioPlayerContext.Provider
      value={{
        currentStory,
        currentChapter,
        isPlaying,
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
      {currentChapter?.audioUrl && <audio ref={audioRef} src={currentChapter.audioUrl} onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)} onLoadedMetadata={event => setDuration(event.currentTarget.duration)} onEnded={nextChapter} />}
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
