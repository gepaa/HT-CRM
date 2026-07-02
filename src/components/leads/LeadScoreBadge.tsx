import React from 'react';
import type { LeadTier } from '../../types/lead';

export interface LeadScoreBadgeProps {
  score: number;
  tier: LeadTier;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LeadScoreBadge: React.FC<LeadScoreBadgeProps> = ({
  score,
  tier,
  size = 'md',
  className = '',
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-semibold rounded-lg transition-colors select-none shadow-sm';

  const tierStyles: Record<LeadTier, string> = {
    hot: 'bg-red-500/20 text-red-400 border border-red-500/30',
    warm: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    cold: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  };

  const sizeStyles: Record<NonNullable<LeadScoreBadgeProps['size']>, string> = {
    sm: 'px-2 py-0.5 text-xs gap-1 rounded-md',
    md: 'px-2.5 py-1 text-sm gap-1.5',
    lg: 'px-3.5 py-1.5 text-base gap-2',
  };

  return (
    <span className={`${baseStyles} ${tierStyles[tier]} ${sizeStyles[size]} ${className}`}>
      {tier === 'hot' && (
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shrink-0" />
      )}
      <span className="font-bold">{score}</span>
      <span className="text-[0.85em] uppercase tracking-wider opacity-90 font-medium">
        {tier}
      </span>
    </span>
  );
};

export default LeadScoreBadge;
