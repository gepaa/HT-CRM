import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  ShieldCheck,
  DollarSign,
  Clock,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  Award,
  Users,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { LoadingState } from '../components/ui/LoadingState';
import { useLeads } from '../hooks/useLeads';
import { useDeals } from '../hooks/useDeals';
import { formatCurrency } from '../lib/formatters';

// ── Types ──────────────────────────────────────────────────────
interface CategoryStat {
  name: string;
  budgetSum: number;
  leads: number;
  percentage: number;
  color: string;
}

interface RepStat {
  name: string;
  assignedTo: string;
  dealsWon: number;
  revenue: number;
  slaOnTime: number;
  slaTotal: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  'car-lifts': 'bg-brand-500',
  'paint-booths': 'bg-purple-500',
  'heavy-duty-lifts': 'bg-emerald-500',
  'tire-equipment': 'bg-amber-500',
  default: 'bg-surface-500',
};

function getCategoryColor(name: string): string {
  const key = name.toLowerCase().replace(/[\s&,]+/g, '-');
  for (const [k, color] of Object.entries(CATEGORY_COLORS)) {
    if (key.includes(k)) return color;
  }
  return CATEGORY_COLORS.default;
}

function parseBudget(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
}

// ── Component ──────────────────────────────────────────────────
export const ReportsPage: React.FC = () => {
  const { leads, loading: leadsLoading } = useLeads();
  const { deals, loading: dealsLoading } = useDeals();
  const [timeframe, setTimeframe] = useState<'30d' | '90d' | 'ytd' | 'all'>('30d');

  // ── Derived live metrics ─────────────────────────────────────
  const metrics = useMemo(() => {
    const now = new Date();

    // Timeframe cutoff
    let cutoff: Date | null = null;
    if (timeframe === '30d') {
      cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (timeframe === '90d') {
      cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (timeframe === 'ytd') {
      cutoff = new Date(now.getFullYear(), 0, 1);
    }

    const filteredLeads = cutoff
      ? leads.filter((l) => l.createdAt && new Date(l.createdAt) >= cutoff!)
      : leads;

    const filteredDeals = cutoff
      ? deals.filter((d) => d.createdAt && new Date(d.createdAt) >= cutoff!)
      : deals;

    // KPIs
    const totalLeads = filteredLeads.length;
    const hotLeads = filteredLeads.filter((l) => l.tier === 'hot').length;

    const wonDeals = filteredDeals.filter(
      (d) => d.stage === 'closed_won'
    );
    const openDeals = filteredDeals.filter(
      (d) => d.stage !== 'closed_won' && d.stage !== 'closed_lost'
    );

    const totalRevenue = wonDeals.reduce((sum, d) => sum + (d.value ?? 0), 0);
    const openPipelineValue = openDeals.reduce((sum, d) => sum + (d.value ?? 0), 0);

    // Hot lead conversion rate
    const hotWon = wonDeals.filter((d) => {
      const lead = filteredLeads.find((l) => l.id === d.leadId);
      return lead?.tier === 'hot';
    }).length;
    const hotConversionRate = hotLeads > 0 ? Math.round((hotWon / hotLeads) * 100) : 0;

    // SLA compliance
    const contactedLeads = filteredLeads.filter((l) => l.contactedAt != null);
    const slaBreaches = filteredLeads.filter((l) => l.slaStatus === 'overdue' || l.isOverdue);
    const slaWarnings = filteredLeads.filter((l) => l.slaStatus === 'warning');
    const slaOnTime = filteredLeads.filter(
      (l) => l.contactedAt != null && l.slaStatus !== 'overdue'
    );
    const slaCompliancePct =
      filteredLeads.length > 0
        ? Math.round((slaOnTime.length / filteredLeads.length) * 100)
        : 100;

    // Category breakdown from leads
    const categoryMap = new Map<string, { budgetSum: number; count: number }>();
    for (const lead of filteredLeads) {
      const cat = lead.productCategory || lead.category || 'Other';
      const budget = parseBudget(lead.targetBudget);
      const existing = categoryMap.get(cat) ?? { budgetSum: 0, count: 0 };
      categoryMap.set(cat, { budgetSum: existing.budgetSum + budget, count: existing.count + 1 });
    }

    const maxBudget = Math.max(...Array.from(categoryMap.values()).map((v) => v.budgetSum), 1);
    const categoryStats: CategoryStat[] = Array.from(categoryMap.entries())
      .sort(([, a], [, b]) => b.budgetSum - a.budgetSum)
      .slice(0, 6)
      .map(([name, { budgetSum, count }]) => ({
        name,
        budgetSum,
        leads: count,
        percentage: Math.round((budgetSum / maxBudget) * 100),
        color: getCategoryColor(name),
      }));

    // Sales rep leaderboard from deals
    const repMap = new Map<string, RepStat>();
    for (const deal of filteredDeals) {
      const rep = deal.assignedTo || 'Unassigned';
      const existing = repMap.get(rep) ?? {
        name: rep,
        assignedTo: rep,
        dealsWon: 0,
        revenue: 0,
        slaOnTime: 0,
        slaTotal: 0,
      };
      if (deal.stage === 'closed_won') {
        existing.dealsWon += 1;
        existing.revenue += deal.value ?? 0;
      }
      repMap.set(rep, existing);
    }

    // Annotate SLA stats per rep from leads
    for (const lead of filteredLeads) {
      const rep = lead.assignedTo || 'Unassigned';
      if (!repMap.has(rep)) {
        repMap.set(rep, { name: rep, assignedTo: rep, dealsWon: 0, revenue: 0, slaOnTime: 0, slaTotal: 0 });
      }
      const r = repMap.get(rep)!;
      r.slaTotal += 1;
      if (lead.slaStatus !== 'overdue' && lead.contactedAt != null) r.slaOnTime += 1;
    }

    const repLeaderboard = Array.from(repMap.values())
      .filter((r) => r.name !== 'Unassigned' && r.name !== 'system')
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      totalLeads,
      hotLeads,
      totalRevenue,
      openPipelineValue,
      hotConversionRate,
      slaCompliancePct,
      slaOnTimeCount: slaOnTime.length,
      slaWarningCount: slaWarnings.length,
      slaBreachCount: slaBreaches.length,
      contactedCount: contactedLeads.length,
      categoryStats,
      repLeaderboard,
      wonDealsCount: wonDeals.length,
    };
  }, [leads, deals, timeframe]);

  if (leadsLoading || dealsLoading) {
    return <LoadingState variant="page" message="Loading revenue & SLA telemetry..." />;
  }

  const {
    totalLeads,
    hotLeads,
    totalRevenue,
    openPipelineValue,
    hotConversionRate,
    slaCompliancePct,
    slaOnTimeCount,
    slaWarningCount,
    slaBreachCount,
    categoryStats,
    repLeaderboard,
    wonDealsCount,
  } = metrics;

  return (
    <div className="space-y-8 pb-12 animate-fade-in">
      {/* Header */}
      <PageHeader
        icon={BarChart3}
        title="Revenue & SLA Intelligence"
        description="Real-time conversion telemetry, equipment pipeline velocity, and sales representative SLA compliance."
        badge={<Badge variant="success">LIVE DATA</Badge>}
        actions={
          <div className="flex items-center gap-1.5 bg-surface-900 border border-surface-800 rounded-xl p-1 shadow-inner">
            {(['30d', '90d', 'ytd', 'all'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all uppercase ${
                  timeframe === t
                    ? 'bg-brand-600 text-white shadow-md'
                    : 'text-surface-400 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        }
      />

      {/* Top Level KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Won Equipment Revenue"
          value={formatCurrency(totalRevenue)}
          subtitle={`${wonDealsCount} closed contract${wonDealsCount !== 1 ? 's' : ''}`}
          icon={DollarSign}
          color="success"
          trend={totalRevenue > 0 ? { value: 'LIVE', isUp: true } : undefined}
        />
        <StatCard
          title="Open Pipeline Value"
          value={formatCurrency(openPipelineValue)}
          subtitle="Active deals in negotiation"
          icon={TrendingUp}
          color="brand"
          trend={openPipelineValue > 0 ? { value: 'LIVE', isUp: true } : undefined}
        />
        <StatCard
          title="SLA Compliance"
          value={`${slaCompliancePct}%`}
          subtitle={`${slaOnTimeCount} of ${totalLeads} on-time`}
          icon={Clock}
          color={slaCompliancePct >= 90 ? 'success' : slaCompliancePct >= 70 ? 'warning' : 'danger'}
        />
        <StatCard
          title="Hot Lead Conversion"
          value={`${hotConversionRate}%`}
          subtitle={`${hotLeads} HOT of ${totalLeads} total inquiries`}
          icon={ShieldCheck}
          color="purple"
        />
      </div>

      {/* Grid: Category Breakdown & SLA Compliance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Revenue Breakdown (2 cols) */}
        <div className="lg:col-span-2 glass-card p-6 flex flex-col justify-between space-y-6">
          <div className="flex items-center justify-between border-b border-surface-800 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Equipment Category Pipeline Velocity</span>
              </h3>
              <p className="text-xs text-surface-400 mt-1">
                Distribution of quote requests and target budgets across commercial equipment tiers.
              </p>
            </div>
            <Badge variant="info">{categoryStats.length} CATEGORIES</Badge>
          </div>

          {categoryStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-surface-500">
              <BarChart3 className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">No lead data in this timeframe.</p>
              <p className="text-xs mt-1">Create leads or adjust the timeframe filter.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {categoryStats.map((cat, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-white flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${cat.color}`} />
                      {cat.name}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-surface-400">{cat.leads} {cat.leads === 1 ? 'inquiry' : 'inquiries'}</span>
                      <span className="font-extrabold text-emerald-400">{formatCurrency(cat.budgetSum)}</span>
                    </div>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full h-2.5 bg-surface-950 rounded-full overflow-hidden p-0.5 border border-surface-800">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${cat.color}`}
                      style={{ width: `${Math.max(4, cat.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 border-t border-surface-800/60 flex items-center justify-between text-xs text-surface-400">
            <span>Aggregated from live Firestore lead data.</span>
            <span className="text-brand-400 font-bold hover:underline cursor-pointer flex items-center gap-1">
              Export CSV <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* SLA Health Widget (1 col) */}
        <div className="glass-card p-6 flex flex-col justify-between space-y-6">
          <div className="border-b border-surface-800 pb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>SLA Compliance Health</span>
            </h3>
            <p className="text-xs text-surface-400 mt-1">
              Response time compliance against the 15-minute War Room guarantee.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center py-4">
            <div
              className={`relative w-36 h-36 rounded-full border-8 border-surface-950 flex flex-col items-center justify-center shadow-2xl ${
                slaCompliancePct >= 90
                  ? 'bg-gradient-to-tr from-emerald-500/20 to-brand-500/20'
                  : slaCompliancePct >= 70
                  ? 'bg-gradient-to-tr from-amber-500/20 to-orange-500/20'
                  : 'bg-gradient-to-tr from-red-500/20 to-rose-500/20'
              }`}
            >
              <span className="text-3xl font-black text-white">{slaCompliancePct}%</span>
              <span
                className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${
                  slaCompliancePct >= 90
                    ? 'text-emerald-400'
                    : slaCompliancePct >= 70
                    ? 'text-amber-400'
                    : 'text-red-400'
                }`}
              >
                {slaCompliancePct >= 90 ? 'COMPLIANT' : slaCompliancePct >= 70 ? 'WARNING' : 'CRITICAL'}
              </span>
              <div
                className={`absolute -inset-1 rounded-full border animate-pulse ${
                  slaCompliancePct >= 90 ? 'border-emerald-500/30' : 'border-red-500/30'
                }`}
              />
            </div>
            <p className="text-xs text-center text-surface-300 mt-4 max-w-xs leading-relaxed">
              <strong>{slaOnTimeCount} of {totalLeads}</strong> commercial inquiries contacted within the 15-minute window.
            </p>
          </div>

          <div className="space-y-3 pt-4 border-t border-surface-800/80">
            <div className="flex items-center justify-between text-xs">
              <span className="text-surface-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> On-Time Outreach
              </span>
              <span className="font-bold text-white">{slaOnTimeCount} leads</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-surface-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Warning Threshold (10–15m)
              </span>
              <span className="font-bold text-amber-400">{slaWarningCount} leads</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-surface-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-400" /> SLA Breaches (&gt; 15m)
              </span>
              <span className="font-bold text-red-400">{slaBreachCount} leads</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sales Rep Leaderboard */}
      <div className="glass-card p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              <span>War Room Sales Leaderboard</span>
            </h3>
            <p className="text-xs text-surface-400 mt-1">
              Top performing equipment specialists ranked by closed revenue and SLA speed.
            </p>
          </div>
          <Badge variant="hot">LIVE RANKINGS</Badge>
        </div>

        {repLeaderboard.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-surface-500">
            <Users className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">No rep data yet for this timeframe.</p>
            <p className="text-xs mt-1">Assign leads and close deals to see rankings.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-950/60 border-b border-surface-800 text-[11px] font-bold text-surface-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Rank & Specialist</th>
                  <th className="py-3 px-4 text-center">Deals Closed</th>
                  <th className="py-3 px-4 text-center">SLA Rate</th>
                  <th className="py-3 px-4 text-right">Won Revenue</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800/60 text-sm">
                {repLeaderboard.map((rep, idx) => {
                  const slaRate =
                    rep.slaTotal > 0
                      ? Math.round((rep.slaOnTime / rep.slaTotal) * 100)
                      : null;

                  return (
                    <tr key={rep.assignedTo} className="hover:bg-surface-800/40 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-xs text-white shadow-md ${
                              idx === 0
                                ? 'bg-gradient-to-br from-amber-500 to-amber-700 border border-amber-300/40'
                                : idx === 1
                                ? 'bg-gradient-to-br from-slate-400 to-slate-600 border border-slate-300/40'
                                : 'bg-gradient-to-br from-amber-700 to-amber-900 border border-amber-500/40'
                            }`}
                          >
                            #{idx + 1}
                          </div>
                          <div>
                            <p className="font-bold text-white">{rep.name}</p>
                            <p className="text-xs text-surface-400">{rep.dealsWon} deal{rep.dealsWon !== 1 ? 's' : ''} closed</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center font-bold text-white">{rep.dealsWon}</td>
                      <td className="py-4 px-4 text-center">
                        {slaRate !== null ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-xs ${
                              slaRate >= 90
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : slaRate >= 70
                                ? 'bg-amber-500/15 text-amber-400'
                                : 'bg-red-500/15 text-red-400'
                            }`}
                          >
                            {slaRate}%
                          </span>
                        ) : (
                          <span className="text-surface-500 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right font-extrabold text-brand-400 text-base">
                        {formatCurrency(rep.revenue)}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <Badge variant={idx === 0 ? 'hot' : idx === 1 ? 'warm' : 'qualified'}>
                          {idx === 0 ? 'TOP CLOSER' : idx === 1 ? 'STRONG' : 'ACTIVE'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
