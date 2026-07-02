import React from 'react';
import { Search, Mail, Share2, Globe, Link as LinkIcon } from 'lucide-react';
import { getSourceLabel, getSourceIcon } from '../../lib/attribution';
import type { LeadSource } from '../../types/lead';

export interface LeadSourceTagProps {
  source: LeadSource | any;
  className?: string;
}

export const LeadSourceTag: React.FC<LeadSourceTagProps> = ({ source = {}, className = '' }) => {
  const label = getSourceLabel(source);
  const iconName = getSourceIcon(source);

  const getIconComponent = (name: string) => {
    switch (name) {
      case 'search':
        return Search;
      case 'facebook':
        return Share2;
      case 'mail':
        return Mail;
      case 'share-2':
        return Share2;
      case 'globe':
        return Globe;
      case 'link':
      default:
        return LinkIcon;
    }
  };

  const IconComponent = getIconComponent(iconName);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-800/80 text-surface-300 border border-surface-700/60 text-xs font-medium shadow-sm transition-colors hover:bg-surface-800 hover:text-surface-200 select-none ${className}`}
      title={`Traffic source: ${label}`}
    >
      <IconComponent className="w-3.5 h-3.5 text-brand-400 shrink-0" />
      <span className="truncate max-w-[150px]">{label}</span>
    </span>
  );
};

export default LeadSourceTag;
