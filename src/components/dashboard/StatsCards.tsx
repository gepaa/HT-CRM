// ─────────────────────────────────────────────────────────────
// StatsCards – War Room 8-KPI Telemetry Grid
// ─────────────────────────────────────────────────────────────
import { TrendingUp, Flame, AlertTriangle, CheckSquare, FileText, DollarSign, Award, Clock } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import { getSLAStatus } from '../../lib/sla';
import type { Lead } from '../../types/lead';
import type { Task } from '../../types/crm';
import type { Deal } from '../../types/deal';

export interface StatsCardsProps {
  leads: any[];
  tasks: any[];
  deals: any[];
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

function isToday(date: Date | null, todayStr: string): boolean {
  return !!date && date.toDateString() === todayStr;
}

export const StatsCards = ({ leads = [], tasks = [], deals = [] }: StatsCardsProps) => {
  const now = new Date();
  const todayStr = now.toDateString();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

  // 1. New leads today
  const newLeadsToday = leads.filter((lead: Lead) => {
    return isToday(toDate(lead?.createdAt), todayStr);
  }).length;

  // 2. Hot leads not contacted
  const hotNotContacted = leads.filter((lead: Lead) => {
    const stage = (lead?.stage || lead?.status || '').toLowerCase();
    const isOpen = !CLOSED_STAGES.has(stage);
    const isHot = lead?.tier === 'hot' || stage === 'hot';
    const notContacted = !toDate(lead?.contactedAt) && stage !== 'contacted';
    return isOpen && isHot && notContacted;
  }).length;

  // 3. Overdue SLA leads
  const overdueSLAs = leads.filter((lead: Lead) => {
    const stage = (lead?.stage || lead?.status || '').toLowerCase();
    if (CLOSED_STAGES.has(stage)) return false;
    const contacted = toDate(lead?.contactedAt);
    if (contacted || stage === 'contacted') return false;
    const deadline = toDate(lead?.slaDeadline || lead?.slaDeadlineAt);
    if (lead?.slaStatus === 'overdue' || lead?.isOverdue) return true;
    return getSLAStatus(deadline, contacted) === 'overdue';
  }).length;

  // 4. Follow-ups due today
  const followUpsToday = tasks.filter((task: Task) => {
    const st = (task?.status || '').toLowerCase();
    if (st === 'completed' || st === 'cancelled' || task?.completedAt) return false;
    const dueDate = toDate(task?.dueDate || (task as any)?.dueAt);
    const due = dueDate?.getTime() || 0;
    return due >= startOfToday && due <= endOfToday;
  }).length;

  // 5. Quote requests today
  const quoteRequestsToday = leads.filter((lead: Lead) => {
    const createdToday = isToday(toDate(lead?.createdAt), todayStr);
    const isQuote = lead?.formType === 'quote' || lead?.tags?.includes('quote') || !!lead?.productTitle?.toLowerCase().includes('quote');
    return createdToday && isQuote;
  }).length;

  // 6. Open pipeline value (exclude closed/lost/won)
  const openPipelineValue = deals.reduce((sum: number, deal: Deal) => {
    const stage = (deal?.stage || '').toLowerCase();
    if (stage === 'lost' || stage === 'closed_lost' || stage === 'won' || stage === 'closed_won') return sum;
    return sum + (Number(deal?.value) || 0);
  }, 0);

  // 7. Won revenue this month
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const wonDealsThisMonth = deals.filter((deal: Deal) => {
    const stage = (deal?.stage || '').toLowerCase();
    if (stage !== 'won' && stage !== 'closed_won') return false;
    const closeDate = toDate(deal?.expectedCloseDate || deal?.updatedAt);
    if (!closeDate) return false;
    return closeDate.getMonth() === currentMonth && closeDate.getFullYear() === currentYear;
  });

  const wonRevenueThisMonth = wonDealsThisMonth.reduce((sum: number, deal: Deal) => sum + (Number(deal?.value) || 0), 0);

  // 8. Average response time placeholder
  const avgResponseTime = '14m 22s';

  return (
    <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 sm:grid sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. New Leads Today */}
      <div className="min-w-[80vw] snap-center sm:min-w-0 bg-surface-900 border border-surface-800 rounded-xl p-4 sm:p-5 shadow-sm hover:border-surface-700 transition-all flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
            New Leads Today
          </span>
          <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-400">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl sm:text-3xl font-extrabold text-surface-100 tracking-tight font-mono">
            {newLeadsToday}
          </div>
          <p className="text-xs text-surface-400 mt-1">Inbound inquiries 24h</p>
        </div>
      </div>

      {/* 2. Hot Leads Not Contacted */}
      <div
        className={`min-w-[80vw] snap-center sm:min-w-0 bg-surface-900 rounded-xl p-4 sm:p-5 shadow-sm transition-all flex flex-col justify-between border ${
          hotNotContacted > 0
            ? 'border-red-500/80 bg-gradient-to-br from-red-500/10 to-transparent shadow-[0_0_15px_rgba(239,68,68,0.2)]'
            : 'border-surface-800 hover:border-surface-700'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
            Hot Not Contacted
            {hotNotContacted > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            )}
          </span>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${hotNotContacted > 0 ? 'bg-red-500/20 text-red-400' : 'bg-surface-800 text-surface-400'}`}>
            <Flame className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-mono ${hotNotContacted > 0 ? 'text-red-400 animate-pulse' : 'text-surface-100'}`}>
            {hotNotContacted}
          </div>
          <p className="text-xs text-red-400/90 mt-1 font-medium">Requires instant outreach</p>
        </div>
      </div>

      {/* 3. Overdue SLA Leads */}
      <div
        className={`min-w-[80vw] snap-center sm:min-w-0 bg-surface-900 rounded-xl p-4 sm:p-5 shadow-sm transition-all flex flex-col justify-between border ${
          overdueSLAs > 0
            ? 'border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.3)] bg-red-950/20'
            : 'border-surface-800 hover:border-surface-700'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
            Overdue SLA Leads
          </span>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${overdueSLAs > 0 ? 'bg-red-500 text-white animate-bounce' : 'bg-surface-800 text-surface-400'}`}>
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-mono ${overdueSLAs > 0 ? 'text-red-400' : 'text-surface-100'}`}>
            {overdueSLAs}
          </div>
          <p className="text-xs text-surface-400 mt-1 font-medium">
            {overdueSLAs > 0 ? 'SLA breach warning' : 'All SLAs within target'}
          </p>
        </div>
      </div>

      {/* 4. Follow-Ups Due Today */}
      <div className="min-w-[80vw] snap-center sm:min-w-0 bg-surface-900 border border-surface-800 rounded-xl p-4 sm:p-5 shadow-sm hover:border-surface-700 transition-all flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
            Follow-Ups Due Today
          </span>
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
            <CheckSquare className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl sm:text-3xl font-extrabold text-surface-100 tracking-tight font-mono">
            {followUpsToday}
          </div>
          <p className="text-xs text-surface-400 mt-1">Scheduled calls & actions</p>
        </div>
      </div>

      {/* 5. Quote Requests Today */}
      <div className="min-w-[80vw] snap-center sm:min-w-0 bg-surface-900 border border-surface-800 rounded-xl p-4 sm:p-5 shadow-sm hover:border-surface-700 transition-all flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
            Quote Requests Today
          </span>
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
            <FileText className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl sm:text-3xl font-extrabold text-surface-100 tracking-tight font-mono">
            {quoteRequestsToday}
          </div>
          <p className="text-xs text-surface-400 mt-1">High-ticket quote forms</p>
        </div>
      </div>

      {/* 6. Open Pipeline Value */}
      <div className="min-w-[80vw] snap-center sm:min-w-0 bg-surface-900 border border-surface-800 rounded-xl p-4 sm:p-5 shadow-sm hover:border-surface-700 transition-all flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
            Open Pipeline Value
          </span>
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-xl sm:text-2xl font-extrabold text-surface-100 tracking-tight truncate font-mono" title={formatCurrency(openPipelineValue)}>
            {formatCurrency(openPipelineValue)}
          </div>
          <p className="text-xs text-surface-400 mt-1">Active deals in negotiation</p>
        </div>
      </div>

      {/* 7. Won Revenue This Month */}
      <div className="min-w-[80vw] snap-center sm:min-w-0 bg-surface-900 border border-surface-800 rounded-xl p-4 sm:p-5 shadow-sm hover:border-surface-700 transition-all flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
            Won Revenue Month
          </span>
          <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
            <Award className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-400 tracking-tight truncate font-mono" title={formatCurrency(wonRevenueThisMonth)}>
            {formatCurrency(wonRevenueThisMonth)}
          </div>
          <p className="text-xs text-emerald-400/80 mt-1 font-medium">Closed won deals</p>
        </div>
      </div>

      {/* 8. Average Response Time */}
      <div className="min-w-[80vw] snap-center sm:min-w-0 bg-surface-900 border border-surface-800 rounded-xl p-4 sm:p-5 shadow-sm hover:border-surface-700 transition-all flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
            Avg Response Time
          </span>
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl sm:text-3xl font-extrabold text-cyan-400 tracking-tight font-mono">
            {avgResponseTime}
          </div>
          <p className="text-xs text-cyan-400/80 mt-1 font-medium">Target: &lt; 15m (SLA)</p>
        </div>
      </div>
    </div>
  );
};

export default StatsCards;
