import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'blueprint' | 'signal' | 'ink';
  children: React.ReactNode;
  raised?: boolean;
}

export const Card: React.FC<CardProps> = ({
  variant = 'blueprint',
  children,
  className,
  raised = true,
  ...props
}) => {
  return (
    <div
      className={twMerge(
        clsx(
          'border-[1.5px] border-ink bg-paper-raised p-6 relative transition-all',
          {
            'shadow-hard-blueprint': raised && variant === 'blueprint',
            'shadow-hard-signal': raised && variant === 'signal',
            'shadow-hard-ink': raised && variant === 'ink',
          }
        ),
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
