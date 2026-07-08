import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarClock,
  CheckCircle2,
  ClipboardPlus,
  ExternalLink,
  Filter,
  Mail,
  Phone,
  Plus,
  RotateCcw,
  Search,
  UserCheck,
  Users,
} from 'lucide-react';
import { endOfDay, isToday, startOfDay } from 'date-fns';
import { useLeads } from '../hooks/useLeads';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { LeadScoreBadge } from '../components/leads/LeadScoreBadge';
import { LeadSourceTag } from '../components/leads/LeadSourceTag';
import { LeadForm } from '../components/leads/LeadForm';
import { formatSLARemaining, getSLAStatus } from '../lib/sla';
import { LEAD_STAGES, PRODUCT_CATEGORIES, STAGE_LABELS } from '../lib/constants';
import { formatCurrency, formatDateTime, formatPhone } from '../lib/formatters';
import { getSourceLabel } from '../lib/attribution';
import { leadService } from '../services/leadService';
import { taskService } from '../services/taskService';
import type { Lead, LeadFormData, LeadStage } from '../types/lead';

type StatusFilter = 'all' | 'HOT' | 'QUALIFIED' | 'WARM' | 'COLD' | 'BAD_FIT';
type SortKey = 'score' | 'newest' | 'oldest' | 'value' | 'sla' | 'followUp';

interface LeadFilters {
  search: string;
  status: StatusFilter;
  stage: 'all' | LeadStage;
  source: string;
  category: string;
  hasPhone: boolean;
  googleAdsOnly: boolean;
  overdueOnly: boolean;
  scoreMin: string;
  scoreMax: string;
  createdToday: boolean;
  followUpToday: boolean;
}

const DEFAULT_FILTERS: LeadFilters = {
  search: '',
  status: 'all',
  stage: 'all',
  source: 'all',
  category: 'all',
  hasPhone: false,
  googleAdsOnly: false,
  overdueOnly: false,
  scoreMin: '',
  scoreMax: '',
  createdToday: false,
  followUpToday: false,
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'HOT', label: 'HOT' },
  { value: 'QUALIFIED', label: 'QUALIFIED' },
  { value: 'WARM', label: 'WARM' },
  { value: 'COLD', label: 'COLD' },
  { value: 'BAD_FIT', label: 'BAD_FIT' },
];

const SORT_OPTIONS = [
  { value: 'score', label: 'Highest score' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'value', label: 'Estimated value' },
  { value: 'sla', label: 'SLA urgency' },
  { value: 'followUp', label: 'Next follow-up' },
];

function dateValue(date: Date | null | undefined): number {
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

function getLeadName(lead: Lead): string {
  return `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unknown Lead';
}

function getDealValue(lead: Lead): number {
  if (typeof lead.estimatedDealValue === 'number') return lead.estimatedDealValue;
  if (typeof lead.productPrice === 'number') return lead.productPrice * (lead.quantity || 1);
  const price = Number(String(lead.productPrice || lead.targetBudget || '').replace(/[^\d.]/g, ''));
  return Number.isFinite(price) ? price * (lead.quantity || 1) : 0;
}

function getStatusLabel(lead: Lead): StatusFilter {
  const rawStatus = String(lead.status || '').toLowerCase();
  if (rawStatus === 'bad_fit') return 'BAD_FIT';
  if (lead.stage === 'qualified') return 'QUALIFIED';
  if (lead.tier === 'hot') return 'HOT';
  if (lead.tier === 'warm') return 'WARM';
  return 'COLD';
}

function isGoogleAdsLead(lead: Lead): boolean {
  const source = lead.source || {};
  return Boolean(
    lead.gclid ||
      source.gclid ||
      (source.utm_source || '').toLowerCase() === 'google' && (source.utm_medium || '').toLowerCase() === 'cpc' ||
      getSourceLabel(source).toLowerCase().includes('google ads')
  );
}

function isLeadOverdue(lead: Lead): boolean {
  const status = getSLAStatus(lead.slaDeadline || lead.slaDeadlineAt || null, lead.contactedAt || lead.lastContactedAt || null);
  return !lead.contactedAt && (lead.isOverdue || lead.slaStatus === 'overdue' || status === 'overdue');
}

function getSlaUrgency(lead: Lead): number {
  if (lead.contactedAt) return 0;
  if (isLeadOverdue(lead)) return 4;
  const status = getSLAStatus(lead.slaDeadline || lead.slaDeadlineAt || null, lead.contactedAt || null);
  if (status === 'warning') return 3;
  if (lead.tier === 'hot') return 2;
  return 1;
}

function getFollowUpDate(lead: Lead): Date | null {
  return lead.nextFollowUpAt || null;
}

function stopRowClick(event: React.MouseEvent) {
  event.stopPropagation();
}

export const LeadsPage: React.FC = () => {
  const navigate = useNavigate();
  const { crmUser } = useAuth();
  const { success, error } = useToast();
  const { leads, loading, createLead, markLeadContacted, updateLeadStage } = useLeads();
  const [filters, setFilters] = useState<LeadFilters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const stageOptions = useMemo(
    () => [
      { value: 'all', label: 'All Stages' },
      ...LEAD_STAGES.map((stage) => ({ value: stage, label: STAGE_LABELS[stage] })),
    ],
    []
  );

  const sourceOptions = useMemo(() => {
    const labels = Array.from(new Set(leads.map((lead) => getSourceLabel(lead.source || {})))).sort();
    return [{ value: 'all', label: 'All Sources' }, ...labels.map((label) => ({ value: label, label }))];
  }, [leads]);

  const categoryOptions = useMemo(
    () => [
      { value: 'all', label: 'All Categories' },
      ...Array.from(new Set([...PRODUCT_CATEGORIES, ...leads.map((lead) => lead.productCategory).filter(Boolean)])).map((category) => ({
        value: category,
        label: category,
      })),
    ],
    [leads]
  );

  const filteredLeads = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    const minScore = filters.scoreMin === '' ? null : Number(filters.scoreMin);
    const maxScore = filters.scoreMax === '' ? null : Number(filters.scoreMax);
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const matches = leads.filter((lead) => {
      const sourceLabel = getSourceLabel(lead.source || {});
      const followUp = getFollowUpDate(lead);
      const searchable = [
        getLeadName(lead),
        lead.email,
        lead.phone,
        lead.company,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (term && !searchable.includes(term)) return false;
      if (filters.status !== 'all' && getStatusLabel(lead) !== filters.status) return false;
      if (filters.stage !== 'all' && lead.stage !== filters.stage) return false;
      if (filters.source !== 'all' && sourceLabel !== filters.source) return false;
      if (filters.category !== 'all' && lead.productCategory !== filters.category && lead.category !== filters.category) return false;
      if (filters.hasPhone && !lead.phone) return false;
      if (filters.googleAdsOnly && !isGoogleAdsLead(lead)) return false;
      if (filters.overdueOnly && !isLeadOverdue(lead)) return false;
      if (minScore !== null && lead.score < minScore) return false;
      if (maxScore !== null && lead.score > maxScore) return false;
      if (filters.createdToday && !(lead.createdAt >= todayStart && lead.createdAt <= todayEnd)) return false;
      if (filters.followUpToday && !(followUp && isToday(followUp))) return false;

      return true;
    });

    return [...matches].sort((a, b) => {
      switch (sortKey) {
        case 'newest':
          return dateValue(b.createdAt) - dateValue(a.createdAt);
        case 'oldest':
          return dateValue(a.createdAt) - dateValue(b.createdAt);
        case 'value':
          return getDealValue(b) - getDealValue(a);
        case 'sla':
          return getSlaUrgency(b) - getSlaUrgency(a) || dateValue(a.slaDeadline) - dateValue(b.slaDeadline);
        case 'followUp':
          return (dateValue(getFollowUpDate(a)) || Number.MAX_SAFE_INTEGER) - (dateValue(getFollowUpDate(b)) || Number.MAX_SAFE_INTEGER);
        case 'score':
        default:
          return b.score - a.score;
      }
    });
  }, [filters, leads, sortKey]);

  const selectedLeads = useMemo(
    () => leads.filter((lead) => selectedIds.includes(lead.id)),
    [leads, selectedIds]
  );

  const updateFilter = <K extends keyof LeadFilters>(key: K, value: LeadFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSortKey('score');
    setSelectedIds([]);
  };

  const handleCreateLead = async (formData: LeadFormData) => {
    if (formData.honeypot && formData.honeypot.trim() !== '') {
      setIsModalOpen(false);
      return;
    }

    setCreating(true);
    try {
      const leadId = await createLead({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone?.trim() || undefined,
        company: formData.company?.trim() || undefined,
        deliveryZip: formData.deliveryZip?.trim() || undefined,
        productCategory: formData.productCategory,
        category: formData.productCategory,
        productTitle: formData.productTitle?.trim() || undefined,
        productPrice: formData.productPrice,
        quantity: Number(formData.quantity) || 1,
        targetBudget: formData.targetBudget.trim(),
        timeline: formData.timeline?.trim() || undefined,
        projectDetails: formData.projectDetails?.trim() || undefined,
        source: formData.source || { utm_source: 'manual' },
        formType: formData.formType || 'quote',
        assignedTo: crmUser?.displayName || crmUser?.id || null,
      });

      success('Lead created successfully.');
      setIsModalOpen(false);
      navigate(`/leads/${leadId}`);
    } catch (err) {
      console.error('Error creating lead:', err);
      error('Failed to create lead. Please check permissions or console.');
    } finally {
      setCreating(false);
    }
  };

  const runLeadAction = async (label: string, leadIds: string[], action: (lead: Lead) => Promise<void>) => {
    setActionLoading(label);
    try {
      const targets = leads.filter((lead) => leadIds.includes(lead.id));
      await Promise.all(targets.map(action));
      success(`${label} applied to ${targets.length} lead${targets.length === 1 ? '' : 's'}.`);
      setSelectedIds([]);
    } catch (err) {
      console.error(`${label} failed:`, err);
      error(`${label} failed. Please try again.`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkContacted = (leadIds: string[]) => {
    void runLeadAction('Mark contacted', leadIds, (lead) => markLeadContacted(lead.id));
  };

  const handleAssignRep = (leadIds: string[]) => {
    const assignee = crmUser?.displayName || crmUser?.email || 'Sales rep placeholder';
    void runLeadAction('Assign rep', leadIds, (lead) => leadService.safeUpdate(lead.id, { assignedTo: assignee }));
  };

  const handleMoveStage = (leadIds: string[], stage: LeadStage) => {
    void runLeadAction('Move stage', leadIds, (lead) => updateLeadStage(lead.id, stage, lead.stage));
  };

  const handleCreateTask = (leadIds: string[]) => {
    void runLeadAction('Create task', leadIds, (lead) =>
      taskService.createTask({
        title: `Follow up with ${getLeadName(lead)}`,
        description: `Review ${lead.productTitle || lead.productCategory} inquiry and contact the lead.`,
        leadId: lead.id,
        assignedTo: lead.assignedTo || crmUser?.displayName || 'Unassigned',
        assignedBy: crmUser?.id || crmUser?.uid || 'user',
        priority: lead.tier === 'hot' || isLeadOverdue(lead) ? 'urgent' : 'high',
        dueDate: new Date(),
      }).then(() => undefined)
    );
  };

  const toggleSelected = (leadId: string) => {
    setSelectedIds((prev) => (prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]));
  };

  const toggleAllVisible = () => {
    const visibleIds = filteredLeads.map((lead) => lead.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? selectedIds.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...selectedIds, ...visibleIds])));
  };

  const renderSlaStatus = (lead: Lead) => {
    if (lead.contactedAt) return <span className="text-xs font-semibold text-emerald-400">Contacted</span>;
    const overdue = isLeadOverdue(lead);
    const deadline = lead.slaDeadline || lead.slaDeadlineAt || null;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${overdue ? 'bg-red-500/15 text-red-300 border border-red-500/30' : 'bg-surface-800 text-surface-300 border border-surface-700'}`}>
        <CalendarClock className="h-3.5 w-3.5" />
        {deadline ? formatSLARemaining(deadline) : lead.slaStatus}
      </span>
    );
  };

  const renderActions = (lead: Lead) => (
    <div className="flex items-center justify-end gap-1.5" onClick={stopRowClick}>
      <Button size="sm" variant="ghost" title="Mark contacted" onClick={() => handleMarkContacted([lead.id])}>
        <CheckCircle2 className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="ghost" title="Assign rep placeholder" onClick={() => handleAssignRep([lead.id])}>
        <UserCheck className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="ghost" title="Create task" onClick={() => handleCreateTask([lead.id])}>
        <ClipboardPlus className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="ghost" title="Open lead detail" onClick={() => navigate(`/leads/${lead.id}`)}>
        <ExternalLink className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Users className="h-6 w-6 text-brand-400" />
            <span>Lead Management</span>
          </h1>
          <p className="mt-1 text-sm text-surface-400">
            {filteredLeads.length} of {leads.length} leads visible
          </p>
        </div>
        <Button variant="primary" onClick={() => setIsModalOpen(true)}>
          <Plus className="h-4 w-4" />
          <span>Add Lead</span>
        </Button>
      </div>

      <div className="rounded-lg border border-surface-800 bg-surface-900 p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(220px,1.3fr)_repeat(4,minmax(150px,1fr))]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Search name, email, phone, company"
              className="h-10 w-full rounded-lg border border-surface-700 bg-surface-800 pl-9 pr-3 text-sm text-white placeholder:text-surface-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <Select options={STATUS_OPTIONS} value={filters.status} onChange={(event) => updateFilter('status', event.target.value as StatusFilter)} />
          <Select options={stageOptions} value={filters.stage} onChange={(event) => updateFilter('stage', event.target.value as LeadFilters['stage'])} />
          <Select options={sourceOptions} value={filters.source} onChange={(event) => updateFilter('source', event.target.value)} />
          <Select options={categoryOptions} value={filters.category} onChange={(event) => updateFilter('category', event.target.value)} />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[repeat(2,minmax(96px,120px))_minmax(180px,1fr)_auto] md:items-center">
          <input
            type="number"
            min={0}
            max={100}
            value={filters.scoreMin}
            onChange={(event) => updateFilter('scoreMin', event.target.value)}
            placeholder="Min score"
            className="h-10 rounded-lg border border-surface-700 bg-surface-800 px-3 text-sm text-white placeholder:text-surface-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            type="number"
            min={0}
            max={100}
            value={filters.scoreMax}
            onChange={(event) => updateFilter('scoreMax', event.target.value)}
            placeholder="Max score"
            className="h-10 rounded-lg border border-surface-700 bg-surface-800 px-3 text-sm text-white placeholder:text-surface-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <div className="flex flex-wrap items-center gap-2">
            {[
              ['hasPhone', 'Has phone'],
              ['googleAdsOnly', 'Google Ads only'],
              ['overdueOnly', 'Overdue only'],
              ['createdToday', 'Created today'],
              ['followUpToday', 'Follow-up today'],
            ].map(([key, label]) => (
              <label key={key} className="inline-flex h-9 items-center gap-2 rounded-lg border border-surface-700 bg-surface-800 px-3 text-xs font-semibold text-surface-200">
                <input
                  type="checkbox"
                  checked={Boolean(filters[key as keyof LeadFilters])}
                  onChange={(event) => updateFilter(key as keyof LeadFilters, event.target.checked as never)}
                  className="h-4 w-4 rounded border-surface-600 bg-surface-900 text-brand-500"
                />
                {label}
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="min-w-[190px]">
              <Select options={SORT_OPTIONS} value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} />
            </div>
            <Button variant="secondary" onClick={resetFilters} title="Reset filters">
              <RotateCcw className="h-4 w-4" />
              <span>Reset</span>
            </Button>
          </div>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-brand-500/30 bg-brand-500/10 p-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm font-semibold text-white">
            {selectedLeads.length} selected
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" loading={actionLoading === 'Mark contacted'} onClick={() => handleMarkContacted(selectedIds)}>
              <CheckCircle2 className="h-4 w-4" />
              <span>Mark contacted</span>
            </Button>
            <Button size="sm" variant="secondary" loading={actionLoading === 'Assign rep'} onClick={() => handleAssignRep(selectedIds)}>
              <UserCheck className="h-4 w-4" />
              <span>Assign rep</span>
            </Button>
            <Button size="sm" variant="secondary" loading={actionLoading === 'Create task'} onClick={() => handleCreateTask(selectedIds)}>
              <ClipboardPlus className="h-4 w-4" />
              <span>Create task</span>
            </Button>
            <div className="w-40">
              <Select options={LEAD_STAGES.map((stage) => ({ value: stage, label: STAGE_LABELS[stage] }))} value="" onChange={(event) => handleMoveStage(selectedIds, event.target.value as LeadStage)} placeholder="Move stage" />
            </div>
          </div>
        </div>
      )}

      <div className="hidden overflow-hidden rounded-lg border border-surface-800 bg-surface-900 shadow-xl xl:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-surface-800 bg-surface-950/80 text-xs font-semibold uppercase tracking-wide text-surface-400">
                <th className="w-10 px-3 py-3">
                  <input type="checkbox" checked={filteredLeads.length > 0 && filteredLeads.every((lead) => selectedIds.includes(lead.id))} onChange={toggleAllVisible} className="h-4 w-4 rounded border-surface-600 bg-surface-900" />
                </th>
                <th className="px-3 py-3">Lead name</th>
                <th className="px-3 py-3">Status badge</th>
                <th className="px-3 py-3">Score</th>
                <th className="px-3 py-3">Stage</th>
                <th className="px-3 py-3">Product/category</th>
                <th className="px-3 py-3">Estimated deal value</th>
                <th className="px-3 py-3">Phone</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Source</th>
                <th className="px-3 py-3">Created date/time</th>
                <th className="px-3 py-3">SLA status</th>
                <th className="px-3 py-3">Next follow-up</th>
                <th className="px-3 py-3">Assigned rep</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800/70 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={15} className="px-4 py-14 text-center text-surface-400">Loading leads...</td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-4 py-14 text-center">
                    <div className="mx-auto max-w-md space-y-3">
                      <Filter className="mx-auto h-8 w-8 text-surface-500" />
                      <p className="font-semibold text-white">No leads match the current filters.</p>
                      <p className="text-sm text-surface-400">Broaden the search, clear a status, or reset everything to return to the full lead list.</p>
                      <Button variant="secondary" onClick={resetFilters}>
                        <RotateCcw className="h-4 w-4" />
                        <span>Reset filters</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const overdue = isLeadOverdue(lead);
                  const hot = lead.tier === 'hot';
                  const followUp = getFollowUpDate(lead);
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => navigate(`/leads/${lead.id}`)}
                      className={`cursor-pointer transition-colors hover:bg-surface-800/60 ${overdue ? 'bg-red-950/20' : ''} ${hot ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-transparent'}`}
                    >
                      <td className="px-3 py-3" onClick={stopRowClick}>
                        <input type="checkbox" checked={selectedIds.includes(lead.id)} onChange={() => toggleSelected(lead.id)} className="h-4 w-4 rounded border-surface-600 bg-surface-900" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-white">{getLeadName(lead)}</div>
                        <div className="max-w-[170px] truncate text-xs text-surface-400">{lead.company || 'Individual inquiry'}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${hot ? 'bg-red-500/20 text-red-300' : lead.tier === 'warm' ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'}`}>
                          {getStatusLabel(lead)}
                        </span>
                      </td>
                      <td className="px-3 py-3"><LeadScoreBadge score={lead.score} tier={lead.tier} size="sm" /></td>
                      <td className="px-3 py-3">
                        <div onClick={stopRowClick}>
                          <Select options={LEAD_STAGES.map((stage) => ({ value: stage, label: STAGE_LABELS[stage] }))} value={lead.stage} onChange={(event) => handleMoveStage([lead.id], event.target.value as LeadStage)} className="min-w-[140px] text-xs" />
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="max-w-[180px] truncate font-medium text-white">{lead.productTitle || lead.productCategory}</div>
                        <div className="text-xs text-surface-400">{lead.quantity || 1} x {lead.productCategory}</div>
                      </td>
                      <td className="px-3 py-3 font-semibold text-emerald-300">{getDealValue(lead) ? formatCurrency(getDealValue(lead)) : lead.targetBudget}</td>
                      <td className="px-3 py-3" onClick={stopRowClick}>
                        {lead.phone ? <a className="inline-flex items-center gap-1.5 text-surface-200 hover:text-brand-300" href={`tel:${lead.phone}`}><Phone className="h-3.5 w-3.5" />{formatPhone(lead.phone)}</a> : <span className="text-surface-500">No phone</span>}
                      </td>
                      <td className="px-3 py-3" onClick={stopRowClick}>
                        <a className="inline-flex max-w-[190px] items-center gap-1.5 truncate text-surface-200 hover:text-brand-300" href={`mailto:${lead.email}`}><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{lead.email}</span></a>
                      </td>
                      <td className="px-3 py-3"><LeadSourceTag source={lead.source} /></td>
                      <td className="px-3 py-3 text-xs text-surface-300">{formatDateTime(lead.createdAt)}</td>
                      <td className="px-3 py-3">{renderSlaStatus(lead)}</td>
                      <td className="px-3 py-3 text-xs text-surface-300">{followUp ? formatDateTime(followUp) : <span className="text-surface-500">Not scheduled</span>}</td>
                      <td className="px-3 py-3 text-sm text-surface-300">{lead.assignedTo || 'Unassigned'}</td>
                      <td className="px-3 py-3">{renderActions(lead)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 xl:hidden">
        {loading ? (
          <div className="rounded-lg border border-surface-800 bg-surface-900 p-8 text-center text-surface-400">Loading leads...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="rounded-lg border border-surface-800 bg-surface-900 p-8 text-center">
            <Filter className="mx-auto h-8 w-8 text-surface-500" />
            <p className="mt-3 font-semibold text-white">No leads match the current filters.</p>
            <p className="mt-1 text-sm text-surface-400">Reset filters to see the full lead list.</p>
            <Button className="mt-4" variant="secondary" onClick={resetFilters}>
              <RotateCcw className="h-4 w-4" />
              <span>Reset filters</span>
            </Button>
          </div>
        ) : (
          filteredLeads.map((lead) => {
            const overdue = isLeadOverdue(lead);
            const followUp = getFollowUpDate(lead);
            return (
              <div
                key={lead.id}
                onClick={() => navigate(`/leads/${lead.id}`)}
                className={`rounded-lg border p-4 shadow-lg ${overdue ? 'border-red-500/30 bg-red-950/20' : lead.tier === 'hot' ? 'border-red-500/35 bg-surface-900' : 'border-surface-800 bg-surface-900'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <input onClick={stopRowClick} type="checkbox" checked={selectedIds.includes(lead.id)} onChange={() => toggleSelected(lead.id)} className="h-4 w-4 rounded border-surface-600 bg-surface-900" />
                      <h2 className="truncate text-base font-bold text-white">{getLeadName(lead)}</h2>
                    </div>
                    <p className="mt-1 truncate text-sm text-surface-400">{lead.company || lead.productTitle || lead.productCategory}</p>
                  </div>
                  <LeadScoreBadge score={lead.score} tier={lead.tier} size="sm" />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-surface-500">Status</p>
                    <p className="font-semibold text-white">{getStatusLabel(lead)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-surface-500">Stage</p>
                    <p className="font-semibold text-white">{STAGE_LABELS[lead.stage] || lead.stage}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-surface-500">Value</p>
                    <p className="font-semibold text-emerald-300">{getDealValue(lead) ? formatCurrency(getDealValue(lead)) : lead.targetBudget}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-surface-500">SLA</p>
                    {renderSlaStatus(lead)}
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm text-surface-300">
                  {lead.phone && <a onClick={stopRowClick} className="flex items-center gap-2 hover:text-brand-300" href={`tel:${lead.phone}`}><Phone className="h-4 w-4" />{formatPhone(lead.phone)}</a>}
                  <a onClick={stopRowClick} className="flex items-center gap-2 hover:text-brand-300" href={`mailto:${lead.email}`}><Mail className="h-4 w-4" />{lead.email}</a>
                  <div className="flex items-center justify-between gap-2">
                    <LeadSourceTag source={lead.source} />
                    <span className="text-xs text-surface-400">{formatDateTime(lead.createdAt)}</span>
                  </div>
                  <div className="text-xs text-surface-400">Follow-up: {followUp ? formatDateTime(followUp) : 'Not scheduled'} · Rep: {lead.assignedTo || 'Unassigned'}</div>
                </div>

                <div className="mt-4 flex flex-col gap-2 border-t border-surface-800 pt-3" onClick={stopRowClick}>
                  <div className="grid grid-cols-2 gap-2">
                    {lead.phone ? (
                      <a href={`tel:${lead.phone}`} className="flex items-center justify-center gap-2 w-full min-h-[48px] rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-200 font-semibold text-sm transition-colors active:scale-95">
                        <Phone className="h-4 w-4" />
                        <span>Call</span>
                      </a>
                    ) : (
                      <a href={`mailto:${lead.email}`} className="flex items-center justify-center gap-2 w-full min-h-[48px] rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-200 font-semibold text-sm transition-colors active:scale-95">
                        <Mail className="h-4 w-4" />
                        <span>Email</span>
                      </a>
                    )}
                    <button onClick={() => navigate(`/leads/${lead.id}`)} className="flex items-center justify-center gap-2 w-full min-h-[48px] rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition-colors active:scale-95">
                      <span>Open Lead</span>
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Manual Lead" size="lg">
        <LeadForm onSubmit={handleCreateLead} loading={creating} />
      </Modal>
    </div>
  );
};

export default LeadsPage;
