import React from 'react';

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  size?: 'sm' | 'md';
};

/** Shared square action control: removes icon-font baseline differences across surfaces. */
export function IconButton({ label, size = 'md', className = '', children, type = 'button', ...props }: IconButtonProps) {
  const dimension = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  return <button type={type} aria-label={label} className={`inline-flex ${dimension} shrink-0 items-center justify-center rounded-full leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f131c] ${className}`} {...props}>
    {children}
  </button>;
}
