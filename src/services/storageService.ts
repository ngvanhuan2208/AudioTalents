import { UserPlayHistory, Playlist, ReaderSettings, Comment } from '../types';
import { DEFAULT_PLAYLISTS, MOCK_COMMENTS } from '../data/mockData';

const KEYS = {
  HISTORY: 'audiotales_history',
  FAVORITES: 'audiotales_favorites',
  FOLLOWED_AUTHORS: 'audiotales_followed_authors',
  COINS: 'audiotales_coins',
  IS_VIP: 'audiotales_is_vip',
  PLAYLISTS: 'audiotales_playlists',
  READER_SETTINGS: 'audiotales_reader_settings',
  USER_XP: 'audiotales_user_xp',
  COMMENTS: 'audiotales_comments'
};

const DEFAULT_HISTORY: UserPlayHistory[] = [
  {
    storyId: 'story-dau-pha-khung-thuong',
    chapterId: 'c-dp-342',
    chapterIndex: 342,
    chapterTitle: 'Chương 342: Dị Hỏa Xuất Thế',
    positionSec: 2535,
    durationSec: 3500,
    percent: 72,
    lastPlayedAt: '1 giờ trước'
  },
  {
    storyId: 'story-van-co-than-de',
    chapterId: 'c-vc-158',
    chapterIndex: 158,
    chapterTitle: 'Chương 158: Thần Mộc Kiếm Ý',
    positionSec: 1110,
    durationSec: 2710,
    percent: 41,
    lastPlayedAt: 'Hôm qua'
  },
  {
    storyId: 'story-toan-chuc-cao-thu',
    chapterId: 'c-tc-89',
    chapterIndex: 89,
    chapterTitle: 'Chương 89: Quân Mạc Tiếu Xuất Trận',
    positionSec: 2110,
    durationSec: 3120,
    percent: 67,
    lastPlayedAt: '3 ngày trước'
  }
];

export const storageService = {
  getHistory(): UserPlayHistory[] {
    try {
      const data = localStorage.getItem(KEYS.HISTORY);
      return data ? JSON.parse(data) : DEFAULT_HISTORY;
    } catch {
      return DEFAULT_HISTORY;
    }
  },

  saveHistory(item: UserPlayHistory) {
    try {
      const current = this.getHistory();
      const filtered = current.filter(h => h.storyId !== item.storyId);
      const updated = [item, ...filtered];
      localStorage.setItem(KEYS.HISTORY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save history', e);
    }
  },

  getFavorites(): string[] {
    try {
      const data = localStorage.getItem(KEYS.FAVORITES);
      return data ? JSON.parse(data) : ['story-he-thong-vo-dich', 'story-quy-bi-chi-chu'];
    } catch {
      return ['story-he-thong-vo-dich', 'story-quy-bi-chi-chu'];
    }
  },

  toggleFavorite(storyId: string): boolean {
    const list = this.getFavorites();
    const exists = list.includes(storyId);
    const updated = exists ? list.filter(id => id !== storyId) : [...list, storyId];
    localStorage.setItem(KEYS.FAVORITES, JSON.stringify(updated));
    return !exists;
  },

  getCoins(): number {
    try {
      const data = localStorage.getItem(KEYS.COINS);
      return data ? parseInt(data, 10) : 1250;
    } catch {
      return 1250;
    }
  },

  addCoins(amount: number): number {
    const current = this.getCoins();
    const updated = current + amount;
    localStorage.setItem(KEYS.COINS, updated.toString());
    return updated;
  },

  deductCoins(amount: number): boolean {
    const current = this.getCoins();
    if (current < amount) return false;
    const updated = current - amount;
    localStorage.setItem(KEYS.COINS, updated.toString());
    return true;
  },

  isVip(): boolean {
    try {
      return localStorage.getItem(KEYS.IS_VIP) === 'true';
    } catch {
      return false;
    }
  },

  setVip(val: boolean) {
    localStorage.setItem(KEYS.IS_VIP, val ? 'true' : 'false');
  },

  getPlaylists(): Playlist[] {
    try {
      const data = localStorage.getItem(KEYS.PLAYLISTS);
      return data ? JSON.parse(data) : DEFAULT_PLAYLISTS;
    } catch {
      return DEFAULT_PLAYLISTS;
    }
  },

  savePlaylists(playlists: Playlist[]) {
    localStorage.setItem(KEYS.PLAYLISTS, JSON.stringify(playlists));
  },

  getReaderSettings(): ReaderSettings {
    try {
      const data = localStorage.getItem(KEYS.READER_SETTINGS);
      return data ? JSON.parse(data) : {
        fontFamily: 'Literata',
        fontSize: 18,
        lineHeight: 1.75,
        theme: 'obsidian'
      };
    } catch {
      return {
        fontFamily: 'Literata',
        fontSize: 18,
        lineHeight: 1.75,
        theme: 'obsidian'
      };
    }
  },

  saveReaderSettings(settings: ReaderSettings) {
    localStorage.setItem(KEYS.READER_SETTINGS, JSON.stringify(settings));
  },

  getUserXp(): number {
    try {
      const data = localStorage.getItem(KEYS.USER_XP);
      return data ? parseInt(data, 10) : 84250;
    } catch {
      return 84250;
    }
  },

  addUserXp(xp: number): number {
    const current = this.getUserXp();
    const updated = current + xp;
    localStorage.setItem(KEYS.USER_XP, updated.toString());
    return updated;
  },

  getComments(): Comment[] {
    try {
      const data = localStorage.getItem(KEYS.COMMENTS);
      return data ? JSON.parse(data) : MOCK_COMMENTS;
    } catch {
      return MOCK_COMMENTS;
    }
  },

  addComment(comment: Comment) {
    const list = this.getComments();
    const updated = [comment, ...list];
    localStorage.setItem(KEYS.COMMENTS, JSON.stringify(updated));
  }
};
