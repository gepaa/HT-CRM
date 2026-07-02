// ─────────────────────────────────────────────────────────────
// OverdueSLAList – Red Alert War Room Overdue SLA Section
// ─────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, User, Clock, Phone, Mail, ExternalLink, CheckCircle } from 'lucide-react';
import { formatSLARemaining, getSLAStatus } from '../../lib/sla';
import { formatCurrency } from '../../lib/formatters';
import { Badge } from '../../components/ui/Badge';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import type { Lead, LeadStage } from '../../types/lead';

export interface OverdueSLAListProps {
  leads: any[];
  onMarkContacted?: (id: string) => void;
}

export const OverdueSLAList: React.FC<OverdueSLAListProps> = ({ leads = [], onMarkContacted }) => {
  const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({});

  // Filter for overdue SLA leads matching HOT or QUALIFIED and not contacted
  const overdueLeads = leads.filter((lead: Lead) => {
    const isHotOrQualified =
      lead?.tier === 'hot' ||
      lead?.tier === 'warm' ||
      lead?.stage === 'qualified' ||
      lead?.status === 'qualified' ||
      lead?.isOverdue ||
      lead?.slaStatus === 'overdue';

    const notContacted = !lead?.contactedAt && lead?.stage !== 'contacted';

    if (!isHotOrQualified || !notContacted) return false;

    const deadline = lead?.slaDeadline ? new Date(lead.slaDeadline) : null;
    const contactedAt = lead?.contactedAt ? new Date(lead.contactedAt) : null;
    const computedStatus = getSLAStatus(deadline, contactedAt);

    return lead?.isOverdue || lead?.slaStatus === 'overdue' || computedStatus === 'overdue';
  });

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
      console.error('Failed to mark overdue lead as contacted:', err);
    } finally {
      setLoadingIds((prev) => ({ ...prev, [leadId]: false }));
    }
  };

  return (
    <div className={`rounded-xl shadow-sm overflow-hidden flex flex-col transition-all border ${
      overdueLeads.length > 0
        ? 'bg-red-950/20 border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.25)]'
        : 'bg-surface-900 border-surface-800'
    }`}>
      {/* Header */}
      <div className={`px-6 py-4 border-b flex items-center justify-between ${
        overdueLeads.length > 0
          ? 'bg-red-500/15 border-red-500/30 text-red-100'
          : 'bg-surface-900/50 border-surface-800 text-surface-100'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            overdueLeads.length > 0 ? 'bg-red-500 text-white animate-bounce' : 'bg-surface-800 text-surface-400'
          }`}>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-extrabold tracking-tight flex items-center gap-2">
              Overdue SLA Alerts
              {overdueLeads.length > 0 && (
                <span className="px-2 py-0.5 text-xs font-mono font-bold rounded-full bg-red-500 text-white animate-pulse">
                  {overdueLeads.length} IMMEDIATE ACTION REQUIRED
                </span>
              )}
            </h3>
          </div>
        </div>
        <span className="text-xs font-mono uppercase font-bold text-red-400">
          War Room Priority #1
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto max-h-[500px] divide-y divide-red-500/20">
        {overdueLeads.length === 0 ? (
          <div className="p-8 flex flex-col items-center justify-center text-center my-auto">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-surface-100">All SLAs on track</h4>
            <p className="text-xs text-surface-400 mt-1 max-w-[240px]">
              Zero hot or qualified leads currently exceed their response SLA targets.
            </p>
          </div>
        ) : (
          overdueLeads.map((lead: Lead) => {
            const deadline = lead?.slaDeadline ? new Date(lead.slaDeadline) : null;
            const overdueText = formatSLARemaining(deadline);
            const val = Number(lead.estimatedDealValue || lead.productPrice || 0);

            return (
              <div
                key={lead.id}
                className="p-4 bg-red-500/15 hover:bg-red-500/25 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 border-l-red-500"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping mt-1.5 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        to={`/leads/${lead.id}`}
                        className="font-extrabold text-base text-white hover:text-red-200 transition-colors underline decoration-red-400/50 underline-offset-2 truncate"
                      >
                        {lead.firstName} {lead.lastName}
                      </Link>
                      {lead.company && (
                        <span className="text-xs font-semibold text-red-200/80 truncate">
                          ({lead.company})
                        </span>
                      )}
                      <Badge variant="danger" className="text-[10px] font-mono uppercase font-extrabold tracking-wider px-1.5 py-0.5 animate-pulse">
                        SLA BREACHED
                      </Badge>
                    </div>

                    <div className="mt-1 flex items-center gap-3 flex-wrap text-xs font-medium text-red-200/90">
                      <span className="font-bold text-white bg-red-900/60 px-2 py-0.5 rounded border border-red-500/30">
                        {lead.productCategory || 'Equipment'} • {formatCurrency(val)}
                      </span>
                      <span className="flex items-center gap-1 text-red-300">
                        <User className="w-3 h-3 text-red-400" />
                        Rep: <strong className="text-white">{lead.assignedTo || 'Unassigned'}</strong>
                      </span>
                    </div>

                    {/* Quick Telemetry Contact Bar */}
                    <div className="mt-2.5 flex items-center gap-2.5 flex-wrap">
                      {lead.phone && (
                        <a
                          href={`tel:${lead.phone}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-surface-950 font-mono text-xs font-extrabold transition-all shadow-sm hover:shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                          title="Call Lead Instantly"
                        >
                          <Phone className="w-3.5 h-3.5 fill-current" />
                          <span>Call {lead.phone}</span>
                        </a>
                      )}
                      {lead.email && (
                        <a
                          href={`mailto:${lead.email}`}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-900 hover:bg-surface-800 text-surface-200 font-mono text-xs font-medium border border-surface-700 transition-colors"
                          title="Send Email"
                        >
                          <Mail className="w-3 h-3" />
                          <span className="truncate max-w-[160px]">{lead.email}</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 border-t sm:border-t-0 border-red-500/20 pt-2 sm:pt-0">
                  <div className="flex items-center gap-1.5 text-xs font-mono font-extrabold text-red-200 bg-red-600/40 px-2.5 py-1 rounded-md border border-red-500 animate-pulse">
                    <Clock className="w-3.5 h-3.5 shrink-0 text-red-400" />
                    <span>{overdueText}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleMarkContacted(lead.id)}
                      disabled={loadingIds[lead.id]}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                      title="Mark as contacted to clear SLA breach"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Mark Contacted</span>
                    </button>
                    <Link
                      to={`/leads/${lead.id}`}
                      className="p-1.5 rounded-lg bg-surface-900 hover:bg-surface-800 text-surface-300 hover:text-white border border-surface-700 transition-colors flex items-center justify-center"
                      title="Inspect Lead Details"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default OverdueSLAList;
