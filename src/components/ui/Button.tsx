import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  children,
  className,
  ...props
}) => {
  return (
    <button
      className={twMerge(
        clsx(
          'font-mono text-[13px] uppercase tracking-wider px-[22px] py-[13px] border transition-colors select-none focus:outline-none focus:ring-1 focus:ring-ink active:translate-y-[1px]',
          {
            // Primary variant: solid background, paper text, dark border
            'bg-ink text-paper border-ink hover:bg-ink-soft hover:border-ink-soft disabled:bg-line disabled:border-line disabled:text-ink-soft':
              variant === 'primary',
            // Secondary variant: transparent background, line border, ink text
            'bg-transparent text-ink border-line hover:border-ink disabled:border-line disabled:text-ink-soft':
              variant === 'secondary',
            // Danger variant: solid secondary accent, paper text, danger border
            'bg-signal text-paper border-signal hover:bg-opacity-90 disabled:bg-line disabled:border-line disabled:text-ink-soft':
              variant === 'danger',
          }
        ),
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};
