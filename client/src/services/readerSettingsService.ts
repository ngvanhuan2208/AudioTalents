import { ReaderSettings } from '../types';

const KEY = 'audiotalents_reader_settings';
const DEFAULT_SETTINGS: ReaderSettings = {
  fontFamily: 'Literata',
  fontSize: 18,
  lineHeight: 1.75,
  theme: 'obsidian',
};

export const readerSettingsService = {
  get(): ReaderSettings {
    try {
      const stored = localStorage.getItem(KEY);
      return stored ? JSON.parse(stored) as ReaderSettings : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  save(settings: ReaderSettings) {
    localStorage.setItem(KEY, JSON.stringify(settings));
  },
};
