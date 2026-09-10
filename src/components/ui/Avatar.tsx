import React, { useState } from 'react';
import { 
  Terminal, 
  Cpu, 
  Compass, 
  Box, 
  Bot, 
  Code2, 
  Shield, 
  Grid,
  Sparkles,
  Layers
} from 'lucide-react';
import type { User } from '../../services/mockAuth';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface AvatarPreset {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  bgClass: string;
  textClass: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'terminal', name: 'Terminal', icon: Terminal, bgClass: 'bg-[#15191C]', textClass: 'text-[#00FF66]' },
  { id: 'grid', name: 'Blueprint Grid', icon: Grid, bgClass: 'bg-[#0B3C5D]', textClass: 'text-white' },
  { id: 'chip', name: 'Microchip', icon: Cpu, bgClass: 'bg-[#1F2937]', textClass: 'text-[#38BDF8]' },
  { id: 'compass', name: 'Architect', icon: Compass, bgClass: 'bg-[#064E3B]', textClass: 'text-[#34D399]' },
  { id: 'cube', name: 'Isometric 3D', icon: Box, bgClass: 'bg-[#4C1D95]', textClass: 'text-[#C084FC]' },
  { id: 'code', name: 'Algorithm', icon: Code2, bgClass: 'bg-[#7C2D12]', textClass: 'text-[#FDBA74]' },
  { id: 'robot', name: 'Automaton', icon: Bot, bgClass: 'bg-[#1E293B]', textClass: 'text-[#94A3B8]' },
  { id: 'shield', name: 'Root Admin', icon: Shield, bgClass: 'bg-[#881337]', textClass: 'text-[#FDA4AF]' },
  { id: 'sparkles', name: 'Synthetic', icon: Sparkles, bgClass: 'bg-[#0F172A]', textClass: 'text-[#FCD34D]' },
  { id: 'layers', name: 'Stack Depth', icon: Layers, bgClass: 'bg-[#164E63]', textClass: 'text-[#67E8F9]' },
];

const MONOGRAM_PALETTES = [
  { bg: 'bg-[#0B3C5D]', text: 'text-white' },
  { bg: 'bg-[#164E63]', text: 'text-[#67E8F9]' },
  { bg: 'bg-[#064E3B]', text: 'text-[#6EE7B7]' },
  { bg: 'bg-[#701A75]', text: 'text-[#F5D0FE]' },
  { bg: 'bg-[#7C2D12]', text: 'text-[#FED7AA]' },
  { bg: 'bg-[#1F2937]', text: 'text-[#E5E7EB]' },
  { bg: 'bg-[#881337]', text: 'text-[#FECDD3]' },
  { bg: 'bg-[#312E81]', text: 'text-[#C7D2FE]' },
];

export const getInitials = (name?: string, email?: string): string => {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) {
    const handle = email.split('@')[0];
    return handle.slice(0, 2).toUpperCase();
  }
  return 'DG';
};

const getMonogramPalette = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % MONOGRAM_PALETTES.length;
  return MONOGRAM_PALETTES[index];
};

interface AvatarProps {
  user?: Partial<User> | null;
  size?: AvatarSize;
  className?: string;
  showBorder?: boolean;
  showStatus?: boolean;
  statusOnline?: boolean;
  onClick?: () => void;
}

const SIZE_MAP = {
  xs: { box: 'w-6 h-6', font: 'text-[9px]', icon: 'w-3.5 h-3.5', dot: 'w-1.5 h-1.5' },
  sm: { box: 'w-8 h-8', font: 'text-[11px]', icon: 'w-4 h-4', dot: 'w-2 h-2' },
  md: { box: 'w-10 h-10', font: 'text-[13px]', icon: 'w-5 h-5', dot: 'w-2.5 h-2.5' },
  lg: { box: 'w-14 h-14', font: 'text-[17px]', icon: 'w-7 h-7', dot: 'w-3 h-3' },
  xl: { box: 'w-20 h-20', font: 'text-[24px]', icon: 'w-10 h-10', dot: 'w-3.5 h-3.5' },
  '2xl': { box: 'w-28 h-28', font: 'text-[32px]', icon: 'w-14 h-14', dot: 'w-4 h-4' },
};

export const Avatar: React.FC<AvatarProps> = ({
  user,
  size = 'md',
  className = '',
  showBorder = true,
  showStatus = false,
  statusOnline = true,
  onClick,
}) => {
  const [imgError, setImgError] = useState(false);
  const dims = SIZE_MAP[size];

  const avatarType = user?.avatarType || (user?.avatar ? 'custom' : 'preset');
  const presetId = user?.presetAvatar || (user?.role === 'admin' ? 'shield' : 'terminal');
  const preset = AVATAR_PRESETS.find(p => p.id === presetId) || AVATAR_PRESETS[0];
  const PresetIcon = preset.icon;

  const initials = getInitials(user?.name, user?.email);
  const monogramPalette = getMonogramPalette(user?.email || user?.name || 'diagrid');

  const borderClasses = showBorder 
    ? 'border border-ink shadow-[2px_2px_0px_0px_rgba(21,25,28,0.15)] dark:border-[#38424B]' 
    : '';

  return (
    <div 
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${dims.box} ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      <div className={`w-full h-full flex items-center justify-center overflow-hidden font-mono font-bold ${borderClasses}`}>
        {/* Case 1: Custom image uploaded and valid */}
        {avatarType === 'custom' && user?.avatar && !imgError ? (
          <img 
            src={user.avatar} 
            alt={user.name || user.email || 'User Avatar'} 
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : avatarType === 'initials' ? (
          /* Case 2: Initials Monogram */
          <div className={`w-full h-full flex items-center justify-center ${monogramPalette.bg} ${monogramPalette.text} ${dims.font}`}>
            {initials}
          </div>
        ) : (
          /* Case 3: Curated Blueprint Preset */
          <div className={`w-full h-full flex items-center justify-center ${preset.bgClass} ${preset.textClass}`}>
            <PresetIcon className={dims.icon} />
          </div>
        )}
      </div>

      {/* Optional online/active status pill */}
      {showStatus && (
        <span 
          className={`absolute bottom-0 right-0 ${dims.dot} border border-paper ${statusOnline ? 'bg-emerald-500' : 'bg-gray-400'}`}
          title={statusOnline ? 'Active' : 'Offline'}
        />
      )}
    </div>
  );
};
