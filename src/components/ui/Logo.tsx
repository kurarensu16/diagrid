import React from 'react';

export interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ink' | 'paper' | 'inherit';
  showText?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  variant = 'inherit',
  showText = true,
  className = '',
}) => {
  const sizeClasses = {
    sm: {
      mark: 'text-[14px]',
      text: 'text-[15px]',
      gap: 'gap-1.5',
    },
    md: {
      mark: 'text-[17px]',
      text: 'text-[18px]',
      gap: 'gap-2',
    },
    lg: {
      mark: 'text-[22px]',
      text: 'text-[23px]',
      gap: 'gap-2.5',
    },
  }[size];

  const variantClasses = {
    ink: 'text-ink',
    paper: 'text-paper',
    inherit: 'text-current',
  }[variant];

  return (
    <div className={`flex items-center ${sizeClasses.gap} font-mono font-bold select-none ${variantClasses} ${className}`}>
      {/* [+] Logo Symbol Mark */}
      <span className={`${sizeClasses.mark} text-blueprint font-mono tracking-tight font-extrabold group-hover:text-blueprint transition-colors`}>
        [+]
      </span>
      {showText && (
        <span className={`${sizeClasses.text} font-bold font-sans tracking-tight leading-none`}>
          diagrid
        </span>
      )}
    </div>
  );
};
