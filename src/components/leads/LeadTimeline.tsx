import React from 'react';
import {
  UserPlus,
  ArrowRightCircle,
  FileText,
  CheckSquare,
  Mail,
  PhoneCall,
  AlertTriangle,
  Zap,
  DollarSign,
  ShoppingBag,
  Activity,
} from 'lucide-react';
import { formatRelativeTime } from '../../lib/formatters';
import type { LeadEvent, EventType } from '../../types/event';

export interface LeadTimelineProps {
  events: LeadEvent[] | any[];
  className?: string;
}

export const LeadTimeline: React.FC<LeadTimelineProps> = ({ events = [], className = '' }) => {
  if (!events || events.length === 0) {
    return (
      <div className="text-center py-8 px-4 rounded-xl border border-dashed border-surface-800 bg-surface-900/30">
        <Activity className="w-8 h-8 text-surface-500 mx-auto mb-2 opacity-60" />
        <p className="text-sm text-surface-400">No activity timeline recorded yet.</p>
      </div>
    );
  }

  const getEventIcon = (type: EventType | string) => {
    switch (type) {
      case 'created':
        return <UserPlus className="w-3.5 h-3.5 text-brand-400" />;
      case 'stage_changed':
        return <ArrowRightCircle className="w-3.5 h-3.5 text-blue-400" />;
      case 'note_added':
        return <FileText className="w-3.5 h-3.5 text-amber-400" />;
      case 'task_created':
        return <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />;
      case 'email_sent':
        return <Mail className="w-3.5 h-3.5 text-purple-400" />;
      case 'call_logged':
        return <PhoneCall className="w-3.5 h-3.5 text-teal-400" />;
      case 'sla_overdue':
        return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
      case 'score_updated':
        return <Zap className="w-3.5 h-3.5 text-yellow-400" />;
      case 'deal_created':
        return <DollarSign className="w-3.5 h-3.5 text-emerald-400" />;
      case 'shopify_synced':
        return <ShoppingBag className="w-3.5 h-3.5 text-green-400" />;
      default:
        return <Activity className="w-3.5 h-3.5 text-surface-400" />;
    }
  };

  const getBadgeBg = (type: EventType | string) => {
    switch (type) {
      case 'sla_overdue':
        return 'bg-red-500/10 border-red-500/30';
      case 'created':
      case 'deal_created':
        return 'bg-brand-500/10 border-brand-500/30';
      default:
        return 'bg-surface-800 border-surface-700';
    }
  };

  return (
    <div className={`relative border-l-2 border-surface-800 ml-4 my-2 space-y-6 ${className}`}>
      {events.map((event, idx) => (
        <div key={event.id || idx} className="relative pl-6 group">
          {/* Timeline Dot with Icon */}
          <div
            className={`absolute -left-[15px] top-1 w-7 h-7 rounded-full border flex items-center justify-center shadow-sm transition-transform group-hover:scale-110 ${getBadgeBg(
              event.type
            )}`}
          >
            {getEventIcon(event.type)}
          </div>

          {/* Event Card */}
          <div className="bg-surface-900/80 hover:bg-surface-900 p-3.5 rounded-xl border border-surface-800/80 transition-colors shadow-sm">
            <p className="text-sm text-surface-200 font-medium leading-relaxed">
              {event.description}
            </p>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-surface-800/50 text-xs text-surface-400">
              <span className="font-medium text-surface-300">
                {event.createdBy ? `By ${event.createdBy}` : 'System Action'}
              </span>
              <time
                dateTime={
                  event.createdAt instanceof Date
                    ? event.createdAt.toISOString()
                    : String(event.createdAt)
                }
              >
                {formatRelativeTime(event.createdAt || new Date())}
              </time>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default LeadTimeline;
