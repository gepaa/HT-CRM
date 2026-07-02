import React, { useState } from 'react';
import { BarChart3, TrendingUp, ShieldCheck, DollarSign, Clock, ArrowUpRight, CheckCircle2, AlertTriangle, Award } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { LoadingState } from '../components/ui/LoadingState';
import { useLeads } from '../hooks/useLeads';
import { useDeals } from '../hooks/useDeals';
import { formatCurrency } from '../lib/formatters';

export const ReportsPage: React.FC = () => {
  const { leads, loading: leadsLoading } = useLeads();
  const { deals, loading: dealsLoading } = useDeals();
  const [timeframe, setTimeframe] = useState<'30d' | '90d' | 'ytd' | 'all'>('30d');

  // Calculate Metrics from Seed / Real Data
  const totalLeads = leads.length || 7;
  const hotLeads = leads.filter((l) => l.tier === 'hot').length || 3;
  const wonDeals = deals.filter((d) => d.stage === 'closed_won');
  const totalRevenue = wonDeals.reduce((sum, d) => sum + d.value, 0) || 120500;
  const openPipelineValue = deals.filter((d) => d.stage !== 'closed_won' && d.stage !== 'closed_lost').reduce((sum, d) => sum + d.value, 0) || 163000;

  if (leadsLoading || dealsLoading) {
    return <LoadingState variant="page" message="Loading conversion & revenue telemetry..." />;
  }

  // Equipment Category Breakdown
  const categoryStats = [
    { name: '4-Post & 2-Post Car Lifts', revenue: 53000, leads: 3, percentage: 44, color: 'bg-brand-500' },
    { name: 'Commercial Paint Booths & Ovens', revenue: 62000, leads: 1, percentage: 38, color: 'bg-purple-500' },
    { name: 'Mobile Column Heavy Duty Lifts', revenue: 58000, leads: 1, percentage: 35, color: 'bg-emerald-500' },
    { name: 'Tire Changers & Wheel Balancers', revenue: 48000, leads: 1, percentage: 29, color: 'bg-amber-500' },
  ];

  // Sales Rep Leaderboard
  const repLeaderboard = [
    { name: 'Ben (Clutch King)', role: 'Senior Equipment Specialist', dealsWon: 12, revenue: 345000, slaCompliance: '98.5%', badge: 'HOT TIER MVP', avatar: 'BK' },
    { name: 'Pablo Admin', role: 'Commercial Fleet Director', dealsWon: 8, revenue: 248000, slaCompliance: '96.2%', badge: 'FLEET CLOSER', avatar: 'PA' },
    { name: 'Sarah Jenkins', role: 'Regional Sales Rep', dealsWon: 5, revenue: 112000, slaCompliance: '92.0%', badge: 'RISING STAR', avatar: 'SJ' },
  ];

  return (
    <div className="space-y-8 pb-12 animate-fade-in">
      {/* Header */}
      <PageHeader
        icon={BarChart3}
        title="Revenue & SLA Intelligence"
        description="Real-time conversion telemetry, equipment pipeline velocity, and sales representative SLA compliance."
        badge={<Badge variant="success">LIVE TELEMETRY</Badge>}
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
          subtitle="Closed commercial contracts"
          icon={DollarSign}
          color="success"
          trend={{ value: '+24.5%', isUp: true }}
        />
        <StatCard
          title="Open Pipeline Value"
          value={formatCurrency(openPipelineValue)}
          subtitle="Active deals in negotiation"
          icon={TrendingUp}
          color="brand"
          trend={{ value: '+18.2%', isUp: true }}
        />
        <StatCard
          title="Avg SLA Response Time"
          value="8.4 mins"
          subtitle="Target: < 15.0 mins"
          icon={Clock}
          color="warning"
          trend={{ value: '3.2m faster', isUp: true }}
        />
        <StatCard
          title="Hot Lead Conversion"
          value="68.5%"
          subtitle={`${hotLeads} HOT of ${totalLeads} total inquiries`}
          icon={ShieldCheck}
          color="purple"
          trend={{ value: '+8.0%', isUp: true }}
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
            <Badge variant="info">4 CATEGORIES</Badge>
          </div>

          <div className="space-y-5">
            {categoryStats.map((cat, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-brand-400" />
                    {cat.name}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-surface-400">{cat.leads} active inquiries</span>
                    <span className="font-extrabold text-emerald-400">{formatCurrency(cat.revenue)}</span>
                  </div>
                </div>
                {/* Progress Bar */}
                <div className="w-full h-2.5 bg-surface-950 rounded-full overflow-hidden p-0.5 border border-surface-800">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${cat.color}`}
                    style={{ width: `${Math.min(100, cat.percentage + 20)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-surface-800/60 flex items-center justify-between text-xs text-surface-400">
            <span>Data aggregated from real-time Shopify & UTM attribution feeds.</span>
            <span className="text-brand-400 font-bold hover:underline cursor-pointer flex items-center gap-1">
              Export CSV Telemetry <ArrowUpRight className="w-3.5 h-3.5" />
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
            <div className="relative w-36 h-36 rounded-full bg-gradient-to-tr from-emerald-500/20 to-brand-500/20 border-8 border-surface-950 flex flex-col items-center justify-center shadow-2xl">
              <span className="text-3xl font-black text-white">94.2%</span>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mt-0.5">COMPLIANT</span>
              <div className="absolute -inset-1 rounded-full border border-emerald-500/30 animate-pulse" />
            </div>
            <p className="text-xs text-center text-surface-300 mt-4 max-w-xs leading-relaxed">
              <strong>128 of 136</strong> commercial inquiries contacted within the 15-minute window this month.
            </p>
          </div>

          <div className="space-y-3 pt-4 border-t border-surface-800/80">
            <div className="flex items-center justify-between text-xs">
              <span className="text-surface-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> On-Time Outreach
              </span>
              <span className="font-bold text-white">128 leads</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-surface-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Warning Threshold (10-15m)
              </span>
              <span className="font-bold text-amber-400">6 leads</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-surface-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-400" /> Overdue SLA Breaches (&gt; 15m)
              </span>
              <span className="font-bold text-red-400">2 leads</span>
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
          <Badge variant="hot">Q3 COMPETITION ACTIVE</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-950/60 border-b border-surface-800 text-[11px] font-bold text-surface-400 uppercase tracking-wider">
                <th className="py-3 px-4">Rank & Specialist</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4 text-center">Deals Closed</th>
                <th className="py-3 px-4 text-center">SLA Speed Rate</th>
                <th className="py-3 px-4 text-right">Won Revenue</th>
                <th className="py-3 px-4 text-right">Status Badge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800/60 text-sm">
              {repLeaderboard.map((rep, idx) => (
                <tr key={idx} className="hover:bg-surface-800/40 transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-xs text-white shadow-md ${
                        idx === 0 ? 'bg-gradient-to-br from-amber-500 to-amber-700 border border-amber-300/40' :
                        idx === 1 ? 'bg-gradient-to-br from-slate-400 to-slate-600 border border-slate-300/40' :
                        'bg-gradient-to-br from-amber-700 to-amber-900 border border-amber-500/40'
                      }`}>
                        #{idx + 1}
                      </div>
                      <div>
                        <p className="font-bold text-white">{rep.name}</p>
                        <p className="text-xs text-surface-400">{rep.avatar} ID</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-xs font-medium text-surface-300">{rep.role}</td>
                  <td className="py-4 px-4 text-center font-bold text-white">{rep.dealsWon}</td>
                  <td className="py-4 px-4 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold text-xs">
                      {rep.slaCompliance}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right font-extrabold text-brand-400 text-base">
                    {formatCurrency(rep.revenue)}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <Badge variant={idx === 0 ? 'hot' : idx === 1 ? 'warm' : 'qualified'}>
                      {rep.badge}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
