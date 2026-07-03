// ─────────────────────────────────────────────────────────────
// HotLeadsList – War Room Hot Leads Needing Action
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, CheckCircle, ExternalLink, Clock, Phone, Mail, User, Sparkles } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { LeadScoreBadge } from '../../components/leads/LeadScoreBadge';
import { formatSLARemaining, getSLAStatus } from '../../lib/sla';
import { formatCurrency, formatRelativeTime } from '../../lib/formatters';
import type { Lead, LeadStage } from '../../types/lead';

export interface HotLeadsListProps {
  leads: any[];
  onMarkContacted?: (id: string) => void;
}

const CLOSED_STAGES = new Set(['won', 'lost', 'closed_won', 'closed_lost']);

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const maybeTimestamp = value as { toDate?: () => Date };
  if (typeof maybeTimestamp.toDate === 'function') return maybeTimestamp.toDate();
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export const HotLeadsList = ({ leads = [], onMarkContacted }: HotLeadsListProps) => {
  const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({});

  // Filter for hot leads and sort by urgency:
  // 1. Uncontacted overdue SLA first
  // 2. Uncontacted leads before contacted leads
  // 3. Closest SLA deadline
  // 4. Highest lead score
  const hotLeads = leads
    .filter((lead: Lead) => {
      const stage = (lead?.stage || lead?.status || '').toLowerCase();
      return (lead?.tier === 'hot' || stage === 'hot') && !CLOSED_STAGES.has(stage);
    })
    .sort((a: Lead, b: Lead) => {
      const aDeadline = toDate(a?.slaDeadline || a?.slaDeadlineAt)?.getTime() || Infinity;
      const bDeadline = toDate(b?.slaDeadline || b?.slaDeadlineAt)?.getTime() || Infinity;
      const now = Date.now();
      const aContacted = !!toDate(a?.contactedAt) || a?.stage === 'contacted';
      const bContacted = !!toDate(b?.contactedAt) || b?.stage === 'contacted';
      const aOverdue = !aContacted && (aDeadline < now || a?.isOverdue || a?.slaStatus === 'overdue');
      const bOverdue = !bContacted && (bDeadline < now || b?.isOverdue || b?.slaStatus === 'overdue');

      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      if (!aContacted && bContacted) return -1;
      if (aContacted && !bContacted) return 1;
      if (aDeadline !== bDeadline) return aDeadline - bDeadline;
      return (Number(b?.score) || 0) - (Number(a?.score) || 0);
    });

  const displayedLeads = hotLeads.slice(0, 15);

  const handleMarkContacted = async (leadId: string) => {
    if (onMarkContacted) {
      onMarkContacted(leadId);
      return;
    }
    try {
      setLoadingIds((prev) => ({ ...prev, [leadId]: true }));
      const leadRef = doc(db, 'leads', leadId);
      await updateDoc(leadRef, {
        contactedAt: serverTimestamp(),
        lastContactedAt: serverTimestamp(),
        slaStatus: 'ok',
        isOverdue: false,
        stage: 'contacted' as LeadStage,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to mark lead as contacted:', err);
    } finally {
      setLoadingIds((prev) => ({ ...prev, [leadId]: false }));
    }
  };

  return (
    <div className="bg-surface-900 border border-surface-800 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-surface-800 flex items-center justify-between bg-gradient-to-r from-red-500/10 via-surface-900/50 to-transparent">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center text-red-400">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-surface-100 tracking-tight flex items-center gap-2">
              Hot Leads Needing Action
              <span className="px-2 py-0.5 text-xs font-mono font-bold rounded-full bg-red-500/20 text-red-400">
                {hotLeads.length}
              </span>
            </h3>
          </div>
        </div>
        <Link
          to="/leads?tier=hot"
          className="text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1"
        >
          View All ({hotLeads.length})
        </Link>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-x-auto">
        {displayedLeads.length === 0 ? (
          <div className="p-8 my-auto">
            <EmptyState
              icon={Flame}
              title="No hot leads right now"
              description="All high-priority leads have been handled or none are currently in the queue."
            />
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-surface-800 font-semibold text-surface-400 uppercase tracking-wider bg-surface-950/80">
                <th className="py-3 px-4">Lead / Contact</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Product / Value</th>
                <th className="py-3 px-4 text-center">Score</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4">SLA Deadline</th>
                <th className="py-3 px-4">Rep</th>
                <th className="py-3 px-4 text-right">Next Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800 text-sm">
              {displayedLeads.map((lead: Lead) => {
                const deadline = toDate(lead?.slaDeadline || lead?.slaDeadlineAt);
                const contactedAt = toDate(lead?.contactedAt);
                const slaStatus = getSLAStatus(deadline, contactedAt);
                const isContacted = lead?.stage === 'contacted' || !!contactedAt;
                const isOverdue = !isContacted && (slaStatus === 'overdue' || lead?.slaStatus === 'overdue' || lead?.isOverdue);
                const val = Number(lead.estimatedDealValue || lead.productPrice || 0);
                const sourceStr = lead.source?.utm_source || lead.source?.referrer || 'Direct';
                const createdDate = toDate(lead?.createdAt) || new Date();

                return (
                  <tr
                    key={lead.id}
                    className={`transition-colors ${
                      isOverdue
                        ? 'bg-red-500/10 hover:bg-red-500/15 border-l-4 border-l-red-500 font-medium'
                        : 'hover:bg-surface-850/50 border-l-4 border-l-transparent'
                    }`}
                  >
                    {/* Lead Name & Email */}
                    <td className="py-3.5 px-4 max-w-[200px]">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/leads/${lead.id}`}
                          className="font-bold text-surface-100 hover:text-brand-400 transition-colors truncate block text-sm"
                        >
                          {lead.firstName} {lead.lastName}
                        </Link>
                        {isOverdue && (
                          <Badge variant="danger" className="text-[9px] uppercase font-bold tracking-wider px-1 py-0.2 shrink-0 animate-pulse">
                            OVERDUE
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-surface-400 truncate">
                        <span className="truncate">{lead.company || 'Individual Inquiry'}</span>
                        {lead.email && (
                          <a
                            href={`mailto:${lead.email}`}
                            title={`Send email to ${lead.email}`}
                            className="text-surface-400 hover:text-white shrink-0"
                          >
                            <Mail className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {lead.phone ? (
                        <a
                          href={`tel:${lead.phone}`}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-surface-800 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 font-mono text-xs font-semibold transition-all border border-surface-700 hover:border-emerald-500/40"
                          title="Click to call"
                        >
                          <Phone className="w-3 h-3 shrink-0" />
                          <span>{lead.phone}</span>
                        </a>
                      ) : (
                        <span className="text-surface-500 text-xs">No Phone</span>
                      )}
                    </td>

                    {/* Product / Value */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-semibold text-surface-200 text-xs truncate max-w-[150px]" title={lead.productCategory || 'Equipment'}>
                        {lead.productCategory || 'Equipment'}
                      </div>
                      <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                        {formatCurrency(val)}
                      </div>
                    </td>

                    {/* Score */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <LeadScoreBadge score={lead.score || 0} tier={lead.tier} />
                    </td>

                    {/* Source */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-surface-800 text-surface-300 capitalize">
                        {sourceStr}
                      </span>
                    </td>

                    {/* Time Since Created */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-xs text-surface-400 font-mono">
                      {formatRelativeTime(createdDate)}
                    </td>

                    {/* SLA Deadline */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isOverdue ? 'text-red-400 animate-pulse' : 'text-surface-400'
                          }`}
                        />
                        <span
                          className={`text-xs font-mono font-bold ${
                            isOverdue ? 'text-red-400' : 'text-surface-300'
                          }`}
                        >
                          {formatSLARemaining(deadline)}
                        </span>
                      </div>
                    </td>

                    {/* Assigned Rep */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-xs text-surface-300 font-medium">
                        <User className="w-3 h-3 text-surface-500 shrink-0" />
                        <span className="truncate max-w-[100px]">{lead.assignedTo || 'Unassigned'}</span>
                      </div>
                    </td>

                    {/* Next Action Button */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {!isContacted ? (
                          <button
                            type="button"
                            onClick={() => handleMarkContacted(lead.id)}
                            disabled={loadingIds[lead.id]}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/40 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm hover:shadow-[0_0_12px_rgba(16,185,129,0.3)] disabled:opacity-50"
                            title={lead.aiNextAction || 'Mark Contacted to fulfill SLA'}
                          >
                            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Contact</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                            <CheckCircle className="w-3 h-3" />
                            <span>Contacted</span>
                          </span>
                        )}

                        <Link
                          to={`/leads/${lead.id}`}
                          className="p-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-white transition-colors flex items-center justify-center border border-surface-700"
                          title={lead.aiNextAction ? `AI Recommendation: ${lead.aiNextAction}` : 'Inspect Lead'}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </div>
                      {lead.aiNextAction && (
                        <div className="text-[10px] text-surface-400 truncate max-w-[160px] text-right mt-1 ml-auto font-medium" title={lead.aiNextAction}>
                          <Sparkles className="w-2.5 h-2.5 inline text-amber-400 mr-1" />
                          {lead.aiNextAction}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default HotLeadsList;
