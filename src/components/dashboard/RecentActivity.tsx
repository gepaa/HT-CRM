// ─────────────────────────────────────────────────────────────
// RecentActivity – War Room Unified Activity Feed
// ─────────────────────────────────────────────────────────────
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  UserPlus,
  RefreshCw,
  CheckSquare,
  Send,
  Award,
  XCircle,
  ArrowRight,
  MessageSquare,
} from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatRelativeTime, formatCurrency } from '../../lib/formatters';
import { STAGE_LABELS, TIER_CONFIG } from '../../lib/constants';
import { SEED_EVENTS, SEED_NOTES } from '../../lib/seedData';
import type { Lead, LeadStage, LeadTier } from '../../types/lead';
import type { Task, Deal, LeadEvent, LeadNote } from '../../types/crm';

export interface RecentActivityProps {
  leads: any[];
  tasks?: any[];
  deals?: any[];
}

export type ActivityType =
  | 'lead_created'
  | 'stage_changed'
  | 'note_added'
  | 'task_completed'
  | 'quote_sent'
  | 'won'
  | 'lost';

interface TimelineItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: Date;
  leadId?: string;
  leadName?: string;
  company?: string | null;
  tier?: string;
}

export const RecentActivity: React.FC<RecentActivityProps> = ({ leads = [], tasks = [], deals = [] }) => {
  const leadsMap = useMemo(() => {
    const map: Record<string, Lead> = {};
    leads.forEach((l: Lead) => {
      if (l?.id) map[l.id] = l;
    });
    return map;
  }, [leads]);

  const activityStream = useMemo(() => {
    const items: TimelineItem[] = [];

    // 1. Leads: created, stage changed, quote sent
    leads.forEach((lead: Lead) => {
      const created = lead?.createdAt ? new Date(lead.createdAt) : new Date();
      const updated = lead?.updatedAt ? new Date(lead.updatedAt) : created;
      const name = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Lead';

      // Lead created
      items.push({
        id: `created-${lead.id}`,
        type: 'lead_created',
        title: name,
        description: `New inbound inquiry (${lead.productCategory || 'Equipment'})`,
        timestamp: created,
        leadId: lead.id,
        leadName: name,
        company: lead.company,
        tier: lead.tier,
      });

      // Quote sent check
      if (lead.stage === 'quoted' || lead.formType === 'quote' || (lead.tags && lead.tags.includes('quote'))) {
        items.push({
          id: `quote-${lead.id}-${updated.getTime()}`,
          type: 'quote_sent',
          title: `Quote Sent: ${name}`,
          description: `Estimated Value: ${formatCurrency(lead.estimatedDealValue || lead.productPrice || 0)}`,
          timestamp: new Date(updated.getTime() - 10_000), // Slightly after create
          leadId: lead.id,
          leadName: name,
          company: lead.company,
          tier: lead.tier,
        });
      }

      // Stage changed check
      if (lead.stage !== 'new' && lead.stage !== 'quoted' && Math.abs(updated.getTime() - created.getTime()) > 30_000) {
        items.push({
          id: `stage-${lead.id}-${updated.getTime()}`,
          type: 'stage_changed',
          title: `${name} moved to ${STAGE_LABELS[lead.stage as LeadStage] || lead.stage}`,
          description: `Stage update • ${lead.productCategory || 'Equipment'}`,
          timestamp: updated,
          leadId: lead.id,
          leadName: name,
          company: lead.company,
          tier: lead.tier,
        });
      }

      // Check SEED_EVENTS for rich telemetry
      const seedEvts = SEED_EVENTS[lead.id] || [];
      seedEvts.forEach((evt: LeadEvent) => {
        const evtTime = evt?.createdAt ? new Date(evt.createdAt) : updated;
        if (evt.type === 'note_added') {
          items.push({
            id: `seed-evt-${evt.id}`,
            type: 'note_added',
            title: `Note: ${name}`,
            description: evt.description || 'New note appended to file',
            timestamp: evtTime,
            leadId: lead.id,
            leadName: name,
            company: lead.company,
          });
        } else if (evt.type === 'score_updated') {
          const sVal = Number(evt.metadata?.score || 90);
          items.push({
            id: `seed-score-${evt.id}`,
            type: 'stage_changed',
            title: `Score Updated: ${name}`,
            description: evt.description || `AI scored lead as ${sVal}`,
            timestamp: evtTime,
            leadId: lead.id,
            leadName: name,
            company: lead.company,
          });
        }
      });

      // Check SEED_NOTES
      const seedNts = SEED_NOTES[lead.id] || [];
      seedNts.forEach((nt: LeadNote) => {
        const ntTime = nt?.createdAt ? new Date(nt.createdAt) : updated;
        const author = (nt as any).createdByName || (nt as any).createdBy || 'Sales Rep';
        items.push({
          id: `seed-nt-${nt.id}`,
          type: 'note_added',
          title: `Note Added by ${author}`,
          description: nt.content,
          timestamp: ntTime,
          leadId: lead.id,
          leadName: name,
          company: lead.company,
        });
      });
    });

    // 2. Tasks: completed tasks
    tasks.forEach((task: Task) => {
      if ((task.status === 'completed' || task.completedAt) && task.completedAt) {
        const time = new Date(task.completedAt);
        const lead = task.leadId ? leadsMap[task.leadId] : null;
        const name = lead ? `${lead.firstName} ${lead.lastName}` : 'General CRM Task';
        items.push({
          id: `task-comp-${task.id}`,
          type: 'task_completed',
          title: `Task Completed: ${task.title}`,
          description: `Assigned to ${task.assignedTo || 'Rep'} • Lead: ${name}`,
          timestamp: time,
          leadId: task.leadId,
          leadName: name,
          company: lead?.company,
        });
      }
    });

    // 3. Deals: won / lost deals
    deals.forEach((deal: Deal) => {
      const stage = (deal.stage || '').toLowerCase();
      const time = deal.updatedAt ? new Date(deal.updatedAt) : (deal.createdAt ? new Date(deal.createdAt) : new Date());
      const lead = deal.leadId ? leadsMap[deal.leadId] : null;
      const name = lead ? `${lead.firstName} ${lead.lastName}` : deal.contactName || deal.title;

      if (stage === 'won' || stage === 'closed_won') {
        items.push({
          id: `deal-won-${deal.id}`,
          type: 'won',
          title: `🎉 Deal Closed Won: ${deal.title}`,
          description: `Revenue: ${formatCurrency(deal.value)} • Closed by ${deal.assignedTo}`,
          timestamp: time,
          leadId: deal.leadId,
          leadName: name,
          company: lead?.company,
        });
      } else if (stage === 'lost' || stage === 'closed_lost') {
        items.push({
          id: `deal-lost-${deal.id}`,
          type: 'lost',
          title: `Deal Closed Lost: ${deal.title}`,
          description: `Rep: ${deal.assignedTo} • Reason: ${deal.notes || 'No reason documented'}`,
          timestamp: time,
          leadId: deal.leadId,
          leadName: name,
          company: lead?.company,
        });
      }
    });

    // Sort descending
    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Deduplicate by identical title + approximate timestamp
    const seen = new Set<string>();
    return items.filter((it) => {
      const key = `${it.type}-${it.title}-${Math.floor(it.timestamp.getTime() / 60000)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 15);
  }, [leads, tasks, deals, leadsMap]);

  const getConfig = (type: ActivityType) => {
    switch (type) {
      case 'lead_created':
        return {
          icon: UserPlus,
          bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
          badgeText: 'New Lead',
          badgeBg: 'bg-blue-500/20 text-blue-300',
        };
      case 'stage_changed':
        return {
          icon: RefreshCw,
          bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
          badgeText: 'Stage Change',
          badgeBg: 'bg-indigo-500/20 text-indigo-300',
        };
      case 'note_added':
        return {
          icon: MessageSquare,
          bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
          badgeText: 'Note Added',
          badgeBg: 'bg-purple-500/20 text-purple-300',
        };
      case 'task_completed':
        return {
          icon: CheckSquare,
          bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          badgeText: 'Task Done',
          badgeBg: 'bg-amber-500/20 text-amber-300',
        };
      case 'quote_sent':
        return {
          icon: Send,
          bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
          badgeText: 'Quote Sent',
          badgeBg: 'bg-cyan-500/20 text-cyan-300',
        };
      case 'won':
        return {
          icon: Award,
          bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          badgeText: 'Closed Won',
          badgeBg: 'bg-emerald-500/20 text-emerald-300',
        };
      case 'lost':
        return {
          icon: XCircle,
          bg: 'bg-red-500/10 text-red-400 border-red-500/20',
          badgeText: 'Closed Lost',
          badgeBg: 'bg-red-500/20 text-red-300',
        };
    }
  };

  return (
    <div className="bg-surface-900 border border-surface-800 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-surface-800 flex items-center justify-between bg-surface-900/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-400">
            <Activity className="w-4 h-4" />
          </div>
          <h3 className="text-base font-semibold text-surface-100 tracking-tight">
            Recent Activity Feed
          </h3>
        </div>
        <span className="text-xs font-mono font-medium text-surface-500">Live Stream</span>
      </div>

      {/* Activity List */}
      <div className="flex-1 overflow-y-auto max-h-[520px] divide-y divide-surface-800/80">
        {activityStream.length === 0 ? (
          <div className="p-8 my-auto">
            <EmptyState
              icon={Activity}
              title="No recent activity"
              description="Activity from new lead inquiries and updates will appear here in real time."
            />
          </div>
        ) : (
          activityStream.map((item: TimelineItem) => {
            const config = getConfig(item.type);
            const IconComponent = config.icon;
            const timeStr = formatRelativeTime(item.timestamp);
            const tierConfig = TIER_CONFIG[(item.tier as LeadTier) || 'cold'];

            return (
              <div
                key={item.id}
                className="p-4 hover:bg-surface-850/40 transition-colors flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border mt-0.5 ${config.bg}`}
                  >
                    <IconComponent className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded ${config.badgeBg}`}>
                        {config.badgeText}
                      </span>
                      {item.leadId ? (
                        <Link
                          to={`/leads/${item.leadId}`}
                          className="font-bold text-sm text-surface-100 hover:text-brand-400 transition-colors truncate"
                        >
                          {item.title}
                        </Link>
                      ) : (
                        <span className="font-bold text-sm text-surface-100 truncate">
                          {item.title}
                        </span>
                      )}
                      {item.company && (
                        <span className="text-xs text-surface-500 font-normal truncate">
                          ({item.company})
                        </span>
                      )}
                      {tierConfig && item.tier && (
                        <span
                          className={`px-1.5 py-0.2 text-[9px] uppercase font-bold rounded-full ${tierConfig.bgColor} ${tierConfig.color}`}
                        >
                          {tierConfig.label}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-surface-300 mt-1 line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-mono text-surface-500 font-medium whitespace-nowrap">
                    {timeStr}
                  </span>
                  {item.leadId && (
                    <Link
                      to={`/leads/${item.leadId}`}
                      className="p-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-400 hover:text-white transition-colors border border-surface-700"
                      title="Inspect Lead"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default RecentActivity;
