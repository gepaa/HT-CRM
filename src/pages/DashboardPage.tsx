// ─────────────────────────────────────────────────────────────
// DashboardPage – Garage Auto Supplies Hot Lead War Room
// ─────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  Sparkles,
  Plus,
  List,
  CheckSquare,
  BarChart3,
  Flame,
  Activity,
} from 'lucide-react';
import { useLeads } from '../hooks/useLeads';
import { useTasks } from '../hooks/useTasks';
import { useDeals } from '../hooks/useDeals';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import { LeadForm } from '../components/leads/LeadForm';
import { StatsCards } from '../components/dashboard/StatsCards';
import { HotLeadsList } from '../components/dashboard/HotLeadsList';
import { OverdueSLAList } from '../components/dashboard/OverdueSLAList';
import { FollowUpsDueToday } from '../components/dashboard/FollowUpsDueToday';
import { GoogleAdsQuality } from '../components/dashboard/GoogleAdsQuality';
import { RecentActivity } from '../components/dashboard/RecentActivity';
import { Spinner } from '../components/ui/Spinner';
import { scoreLead } from '../lib/scoring';
import { calculateSLADeadline } from '../lib/sla';
import { DEFAULT_BUSINESS_HOURS, DEFAULT_SLA_CONFIG } from '../lib/constants';
import type { LeadStage, LeadFormData } from '../types/lead';

export default function DashboardPage() {
  const { leads, loading: leadsLoading, error: leadsError, createLead, markLeadContacted } = useLeads();
  const { tasks, loading: tasksLoading, completeTask } = useTasks();
  const { deals, loading: dealsLoading } = useDeals();
  const { crmUser } = useAuth();
  const { success, error: toastError } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const loading = leadsLoading || tasksLoading || dealsLoading;

  const handleCreateLead = async (formData: LeadFormData) => {
    if (formData.honeypot && formData.honeypot.trim() !== '') {
      setIsModalOpen(false);
      return;
    }

    setCreating(true);
    try {
      const { score, scoreBreakdown, tier } = scoreLead(formData);
      const now = new Date();
      const slaDeadline = calculateSLADeadline(now, tier, DEFAULT_BUSINESS_HOURS, DEFAULT_SLA_CONFIG);

      await createLead({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone?.trim() || null,
        company: formData.company?.trim() || null,
        deliveryZip: formData.deliveryZip?.trim() || null,
        productCategory: formData.productCategory,
        quantity: formData.quantity || 1,
        targetBudget: formData.targetBudget.trim(),
        projectDetails: formData.projectDetails?.trim() || null,
        source: formData.source || { utm_source: 'manual' },
        formType: formData.formType || 'quote',
        score,
        scoreBreakdown,
        tier,
        stage: 'new' as LeadStage,
        assignedTo: crmUser?.id || null,
        slaDeadline,
      });

      success(`Lead created successfully! Score: ${score} (${tier.toUpperCase()})`);
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to create lead:', err);
      toastError('Failed to create lead. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  if (loading && leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[480px] text-center p-8 bg-surface-950 rounded-2xl border border-surface-850">
        <Spinner className="w-10 h-10 text-brand-500 mb-4" />
        <h3 className="text-base font-bold text-surface-100">Initializing War Room Telemetry…</h3>
        <p className="text-xs font-mono text-surface-400 mt-1">Syncing live equipment queues & SLA monitors</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Top Banner / Header & Quick Actions */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-surface-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
              Hot Lead War Room
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-extrabold bg-brand-500/15 text-brand-400 border border-brand-500/30 shadow-[0_0_12px_rgba(249,115,22,0.2)]">
              <Sparkles className="w-3.5 h-3.5 animate-spin-slow" />
              LIVE TELEMETRY
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
              <Flame className="w-3 h-3" />
              SLA ENFORCEMENT
            </span>
          </div>
          <p className="text-sm text-surface-400 mt-1 max-w-2xl">
            Real-time high-ticket equipment lead monitoring, instant SLA enforcement, and revenue operations dashboard.
          </p>
        </div>

        {/* 7. Quick Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-surface-950 font-extrabold text-xs flex items-center gap-1.5 shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_25px_rgba(249,115,22,0.5)] transition-all shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Lead</span>
          </button>

          <Link
            to="/leads"
            className="px-3 py-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-200 hover:text-white font-semibold text-xs flex items-center gap-1.5 border border-surface-700 hover:border-surface-600 transition-all shrink-0"
          >
            <List className="w-4 h-4 text-surface-400" />
            <span>All Leads</span>
          </Link>

          <Link
            to="/tasks"
            className="px-3 py-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-200 hover:text-white font-semibold text-xs flex items-center gap-1.5 border border-surface-700 hover:border-surface-600 transition-all shrink-0"
          >
            <CheckSquare className="w-4 h-4 text-amber-400" />
            <span>Tasks</span>
          </Link>

          <Link
            to="/pipeline"
            className="px-3 py-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-200 hover:text-white font-semibold text-xs flex items-center gap-1.5 border border-surface-700 hover:border-surface-600 transition-all shrink-0"
          >
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span>Pipeline</span>
          </Link>

          {leadsError && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium shrink-0">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Sync warning</span>
            </div>
          )}
        </div>
      </div>

      {/* 1. Top KPI Stats Cards (8 cards grid) */}
      <StatsCards leads={leads} tasks={tasks} deals={deals} />

      {/* 3. Overdue SLA Alerts (Prominent Top Banner Section) */}
      <OverdueSLAList leads={leads} onMarkContacted={markLeadContacted} />

      {/* Main War Room Dense Grid: 2 Columns on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Side: 2 Columns Width */}
        <div className="lg:col-span-2 space-y-6">
          {/* 2. Hot Leads Needing Action Table */}
          <HotLeadsList leads={leads} onMarkContacted={markLeadContacted} />

          {/* 6. Recent Activity Feed */}
          <RecentActivity leads={leads} tasks={tasks} deals={deals} />
        </div>

        {/* Right Side: 1 Column Width */}
        <div className="lg:col-span-1 space-y-6">
          {/* 4. Follow-Ups Due Today */}
          <FollowUpsDueToday tasks={tasks} leads={leads} onCompleteTask={completeTask} />

          {/* 5. Google Ads Lead Quality */}
          <GoogleAdsQuality leads={leads} deals={deals} />
        </div>
      </div>

      {/* Add Lead Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Lead Inquiry"
        size="lg"
      >
        <LeadForm onSubmit={handleCreateLead} loading={creating} />
      </Modal>
    </div>
  );
}
