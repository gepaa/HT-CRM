import React from 'react';
import { Clock, AlertTriangle, Building2, Tag } from 'lucide-react';
import { LeadScoreBadge } from './LeadScoreBadge';
import { formatSLARemaining, getSLAStatus } from '../../lib/sla';
import type { Lead } from '../../types/lead';

export interface LeadCardProps {
  lead: Lead | any;
  onClick?: () => void;
  className?: string;
}

export const LeadCard: React.FC<LeadCardProps> = ({ lead, onClick, className = '' }) => {
  const slaStatus = lead.slaStatus || getSLAStatus(lead.slaDeadline || null, lead.contactedAt || null);
  const slaRemainingText = formatSLARemaining(lead.slaDeadline || null);
  const isOverdue = slaStatus === 'overdue';
  const isHot = lead.tier === 'hot';

  let borderClasses = 'border-surface-800';
  if (isOverdue) {
    borderClasses = 'border-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.15)]';
  } else if (isHot) {
    borderClasses = 'border-surface-800 border-l-4 border-l-red-500';
  }

  return (
    <div
      onClick={onClick}
      className={`bg-surface-900 rounded-xl p-4 border transition-all duration-200 cursor-pointer hover:bg-surface-800/80 hover:shadow-lg flex flex-col justify-between gap-3 text-left group ${borderClasses} ${className}`}
    >
      {/* Top Row: Name and Score */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-base font-bold text-white truncate group-hover:text-brand-400 transition-colors">
            {lead.firstName} {lead.lastName}
          </h4>
          <div className="flex items-center gap-1.5 text-xs text-surface-400 mt-0.5 truncate">
            <Building2 className="w-3.5 h-3.5 shrink-0 text-surface-500" />
            <span className="truncate">{lead.company || 'Individual Client'}</span>
          </div>
        </div>
        <LeadScoreBadge
          score={lead.score || 0}
          tier={lead.tier || 'cold'}
          size="sm"
        />
      </div>

      {/* Middle Row: Product Category */}
      <div className="flex items-center gap-1.5 text-xs font-medium text-surface-300 bg-surface-800/60 px-2.5 py-1 rounded-md w-fit border border-surface-700/40">
        <Tag className="w-3.5 h-3.5 text-brand-400 shrink-0" />
        <span className="truncate">{lead.productCategory || 'General Inquiry'}</span>
      </div>

      {/* Bottom Row: Stage & SLA Remaining */}
      <div className="flex items-center justify-between pt-2 border-t border-surface-800/80 text-xs">
        <span className="px-2 py-0.5 rounded-md uppercase font-semibold tracking-wider bg-surface-800 text-surface-300 border border-surface-700/60 text-[10px]">
          {lead.stage || 'new'}
        </span>

        <div
          className={`flex items-center gap-1 font-medium ${
            isOverdue
              ? 'text-red-400 font-bold'
              : slaStatus === 'warning'
              ? 'text-amber-400'
              : 'text-surface-400'
          }`}
        >
          {isOverdue ? (
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <Clock className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>{slaRemainingText}</span>
        </div>
      </div>
    </div>
  );
};

export default LeadCard;
