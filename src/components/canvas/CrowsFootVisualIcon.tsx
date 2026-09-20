import React from 'react';
import type { EdgeMarkerType } from '../../services/mockDb';

export const CrowsFootVisualIcon: React.FC<{ type: EdgeMarkerType; isSelected?: boolean }> = ({ type, isSelected }) => {
  // Use CSS currentColor so parent's text color determines the stroke (inherits theme)
  const svgClass = `w-10 h-3.5 ${isSelected ? 'text-paper' : 'text-ink'}`;
  const stroke = 'currentColor';
  const circleFill = isSelected ? 'currentColor' : 'var(--bg-paper-raised)';

  if (type === 'none') {
    return (
      <svg className={svgClass} viewBox="0 0 40 14">
        <line x1="2" y1="7" x2="38" y2="7" stroke={stroke} strokeWidth="1.75" />
      </svg>
    );
  }
  if (type === 'arrow') {
    return (
      <svg className={svgClass} viewBox="0 0 40 14">
        <line x1="2" y1="7" x2="36" y2="7" stroke={stroke} strokeWidth="1.75" />
        <path d="M 28 2.5 L 37 7 L 28 11.5 z" fill={stroke} />
      </svg>
    );
  }
  if (type === 'zero-one') {
    // Zero or one: horizontal line with an open circle
    return (
      <svg className={svgClass} viewBox="0 0 40 14">
        <line x1="2" y1="7" x2="38" y2="7" stroke={stroke} strokeWidth="1.75" />
        <circle cx="28" cy="7" r="4" fill={circleFill} stroke={stroke} strokeWidth="1.75" />
      </svg>
    );
  }
  if (type === 'many') {
    // Many: line branching into 3 prongs
    return (
      <svg className={svgClass} viewBox="0 0 40 14">
        <line x1="2" y1="7" x2="38" y2="7" stroke={stroke} strokeWidth="1.75" />
        <line x1="22" y1="7" x2="38" y2="1.5" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
        <line x1="22" y1="7" x2="38" y2="12.5" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === 'one') {
    // One: single vertical crossbar
    return (
      <svg className={svgClass} viewBox="0 0 40 14">
        <line x1="2" y1="7" x2="38" y2="7" stroke={stroke} strokeWidth="1.75" />
        <line x1="30" y1="1.5" x2="30" y2="12.5" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === 'one-only') {
    // One (and only one): two vertical crossbars
    return (
      <svg className={svgClass} viewBox="0 0 40 14">
        <line x1="2" y1="7" x2="38" y2="7" stroke={stroke} strokeWidth="1.75" />
        <line x1="24" y1="1.5" x2="24" y2="12.5" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
        <line x1="31" y1="1.5" x2="31" y2="12.5" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === 'zero-many') {
    // Zero or many: circle followed by 3 prongs
    return (
      <svg className={svgClass} viewBox="0 0 40 14">
        <line x1="2" y1="7" x2="38" y2="7" stroke={stroke} strokeWidth="1.75" />
        <circle cx="19" cy="7" r="3.5" fill={circleFill} stroke={stroke} strokeWidth="1.75" />
        <line x1="22.5" y1="7" x2="38" y2="1.5" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
        <line x1="22.5" y1="7" x2="38" y2="12.5" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === 'one-many') {
    // One or many: vertical bar followed by 3 prongs
    return (
      <svg className={svgClass} viewBox="0 0 40 14">
        <line x1="2" y1="7" x2="38" y2="7" stroke={stroke} strokeWidth="1.75" />
        <line x1="21" y1="1.5" x2="21" y2="12.5" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
        <line x1="22" y1="7" x2="38" y2="1.5" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
        <line x1="22" y1="7" x2="38" y2="12.5" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }
  return null;
};
