export type StoryStatus = 'Đang ra' | 'Hoàn thành' | 'Tạm dừng';

export interface Chapter {
  id: string;
  storyId: string;
  index: number;
  title: string;
  durationSec: number;
  durationFormatted: string;
  isVip: boolean;
  coinPrice?: number;
  publishedAt: string;
  narrator?: string;
  audioUrl?: string;
  content: string;
  transcript: TranscriptSegment[];
}

export interface TranscriptSegment {
  startSec: number;
  endSec: number;
  speaker: string;
  text: string;
}

export interface Story {
  id: string;
  slug: string;
  title: string;
  author: string;
  authorId: string;
  narrator: string;
  narratorGroup?: string;
  cover: string;
  genres: string[];
  tags: string[];
  status: StoryStatus;
  description: string;
  synopsis?: string;
  rating: number;
  ratingCount: number;
  views: string;
  listeners: string;
  chaptersCount: number;
  totalAudioHours: string;
  badge?: 'TOP 1 TUẦN' | 'NEW' | 'MỚI RA' | 'KỊCH THANH' | 'CẬP NHẬT' | 'SIÊU PHẨM' | 'ĐỘC QUYỀN';
  hasAudio: boolean;
  audioQuality: string;
  currentChapter?: string;
  chapters: Chapter[];
}

export interface Genre {
  id: string;
  name: string;
  slug: string;
  icon: string;
  count: number;
  audioCount: number;
  description?: string;
  isHot?: boolean;
  rankBadge?: string;
}

export interface CultivationUser {
  rank: number;
  name: string;
  realm: string;
  avatar: string;
  listeningHours: number;
  chaptersCompleted: number;
  xp: number;
  title: string;
  isCurrentUser?: boolean;
}

export interface Comment {
  id: string;
  userName: string;
  userAvatar: string;
  userRealm: string;
  content: string;
  timestamp?: string;
  createdAt?: string;
  likes: number;
  rating?: number;
  chapterIndex?: number;
  chapterTagged?: string;
}

export interface UserPlayHistory {
  storyId: string;
  chapterId: string;
  chapterIndex: number;
  chapterTitle: string;
  positionSec: number;
  durationSec: number;
  percent: number;
  lastPlayedAt: string;
}

export interface Playlist {
  id: string;
  name: string;
  title?: string;
  icon?: string;
  description?: string;
  storyIds: string[];
  storyCount?: number;
  totalDurationHours?: string;
  cover?: string;
  createdAt: string;
}

export interface ReaderSettings {
  fontFamily: 'Literata' | 'Plus Jakarta Sans' | 'serif';
  fontSize: number; // 14 to 28
  lineHeight: number; // 1.5 to 2.0
  theme: 'obsidian' | 'midnight' | 'sepia' | 'slate' | 'pureBlack';
}
