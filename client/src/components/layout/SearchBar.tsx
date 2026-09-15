import React, { useState } from 'react';
import { IconButton } from '../ui/IconButton';

interface SearchBarProps {
  currentTab: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectTab: (tab: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  currentTab,
  searchQuery,
  onSearchChange,
  onSelectTab,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div
      className={`hidden md:flex flex-1 mx-2 transition-[max-width] duration-300 ease-out ${
        isFocused ? 'max-w-xl' : 'max-w-md'
      }`}
    >
      <div className="relative w-full flex items-center bg-[#262a33]/80 border border-white/5 hover:border-white/15 focus-within:border-primary/45 focus-within:bg-[#262a33] rounded-full px-4 py-2 transition-all duration-300">
        <span className="material-symbols-outlined text-[#908fa0] text-lg mr-2">search</span>
        <input
          id="global-search-input"
          aria-label="Tìm kiếm"
          value={searchQuery}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={event => {
            onSearchChange(event.target.value);
            if (currentTab !== 'discover' && event.target.value) onSelectTab('discover');
          }}
          className="w-full bg-transparent text-sm text-[#dfe2ee] placeholder-[#908fa0] focus:outline-none"
          placeholder={isFocused ? 'Tìm truyện, tác giả, thể loại...' : 'Tìm kiếm...'}
          type="search"
        />
        {searchQuery && (
          <IconButton
            label="Xóa tìm kiếm"
            size="sm"
            onMouseDown={event => event.preventDefault()}
            onClick={() => onSearchChange('')}
            className="text-[#908fa0] hover:text-[#dfe2ee] hover:bg-white/10"
          >
            <span className="material-symbols-outlined text-base leading-none">close</span>
          </IconButton>
        )}
        {!isFocused && !searchQuery && (
          <kbd className="hidden lg:inline-flex items-center justify-center px-2 py-0.5 rounded bg-[#31353e] text-[11px] text-[#c7c4d7] font-mono border border-white/5">
            /
          </kbd>
        )}
      </div>
    </div>
  );
};
