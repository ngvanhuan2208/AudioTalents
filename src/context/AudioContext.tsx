import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Story, Chapter } from '../types';
import { STORIES_DATA } from '../data/mockData';
import { storageService } from '../services/storageService';

interface AudioContextType {
  currentStory: Story;
  currentChapter: Chapter;
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

const AudioContext = createContext<AudioContextType | undefined>(undefined);

// Web Audio Ambient Synthesizer for pleasant tactile audio playback feedback
class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private isSynthesizing = false;

  start(rate: number, volume: number) {
    if (this.isSynthesizing) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.ctx) this.ctx = new AudioCtx();
      if (this.ctx.state === 'suspended') this.ctx.resume();

      this.osc = this.ctx.createOscillator();
      this.gain = this.ctx.createGain();

      this.osc.type = 'sine';
      this.osc.frequency.setValueAtTime(144 * rate, this.ctx.currentTime);

      // Low volume pleasant ambient tone
      this.gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
      this.gain.gain.exponentialRampToValueAtTime(0.015 * volume, this.ctx.currentTime + 1);

      this.osc.connect(this.gain);
      this.gain.connect(this.ctx.destination);
      this.osc.start();
      this.isSynthesizing = true;
    } catch {
      // Audio autoplay policy fallback
    }
  }

  stop() {
    if (!this.isSynthesizing) return;
    try {
      if (this.gain && this.ctx) {
        this.gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.3);
        setTimeout(() => {
          this.osc?.stop();
          this.osc?.disconnect();
          this.isSynthesizing = false;
        }, 300);
      } else {
        this.osc?.stop();
        this.isSynthesizing = false;
      }
    } catch {
      this.isSynthesizing = false;
    }
  }

  update(rate: number, volume: number) {
    if (!this.isSynthesizing || !this.osc || !this.gain || !this.ctx) return;
    try {
      this.osc.frequency.setValueAtTime(144 * rate, this.ctx.currentTime);
      this.gain.gain.setValueAtTime(0.015 * volume, this.ctx.currentTime);
    } catch {
      // Ignored
    }
  }
}

const synth = new SoundSynthesizer();

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default loaded story: 'Ta Có Một Hệ Thống Vô Địch'
  const defaultStory = STORIES_DATA[0];
  const [currentStory, setCurrentStory] = useState<Story>(defaultStory);
  const [currentChapter, setCurrentChapter] = useState<Chapter>(defaultStory.chapters[0]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(420); // 7m in
  const [duration, setDuration] = useState<number>(defaultStory.chapters[0]?.durationSec || 1320);
  const [volume, setVolumeState] = useState<number>(0.8);
  const [speed, setSpeedState] = useState<number>(1.2);
  const [sleepTimer, setSleepTimerState] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const timerRef = useRef<number | null>(null);
  const sleepIntervalRef = useRef<number | null>(null);

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  // Compute active transcript segment
  const activeSegmentIndex = currentChapter.transcript?.findIndex(
    seg => currentTime >= seg.startSec && currentTime <= seg.endSec
  ) ?? -1;

  // Timer simulation loop
  useEffect(() => {
    if (isPlaying) {
      synth.start(speed, volume);
      timerRef.current = window.setInterval(() => {
        setCurrentTime(prev => {
          const next = prev + 1 * speed;
          if (next >= duration) {
            // Auto next chapter or loop
            nextChapter();
            return 0;
          }
          return next;
        });
      }, 1000);
    } else {
      synth.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      synth.stop();
    };
  }, [isPlaying, duration, speed]);

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

  // Save history periodically
  useEffect(() => {
    if (currentTime > 0 && currentTime % 10 === 0) {
      storageService.saveHistory({
        storyId: currentStory.id,
        chapterId: currentChapter.id,
        chapterIndex: currentChapter.index,
        chapterTitle: currentChapter.title,
        positionSec: Math.floor(currentTime),
        durationSec: duration,
        percent: Math.round(progressPercent),
        lastPlayedAt: 'Vừa xong'
      });
      // Award 2 XP per 10s of listening
      storageService.addUserXp(2);
    }
  }, [currentTime]);

  const playStory = (story: Story, chapterIndex?: number, startSec?: number) => {
    setCurrentStory(story);
    const targetChapter = chapterIndex
      ? story.chapters.find(c => c.index === chapterIndex) || story.chapters[0]
      : story.chapters[0];
    setCurrentChapter(targetChapter);
    setDuration(targetChapter.durationSec || 1200);
    setCurrentTime(startSec !== undefined ? startSec : 0);
    setIsPlaying(true);
  };

  const togglePlay = () => {
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
    synth.update(rate, volume);
  };

  const setVolume = (val: number) => {
    setVolumeState(val);
    synth.update(speed, val);
  };

  const setSleepTimerMinutes = (mins: number | null) => {
    setSleepTimerState(mins);
  };

  const nextChapter = () => {
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
    <AudioContext.Provider
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
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};
