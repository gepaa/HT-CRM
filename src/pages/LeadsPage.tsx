import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Search, Filter, Package } from 'lucide-react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useLeads } from '../hooks/useLeads';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { LeadScoreBadge } from '../components/leads/LeadScoreBadge';
import { LeadSourceTag } from '../components/leads/LeadSourceTag';
import { LeadForm } from '../components/leads/LeadForm';
import { scoreLead } from '../lib/scoring';
import { calculateSLADeadline, formatSLARemaining } from '../lib/sla';
import { STAGE_LABELS, DEFAULT_BUSINESS_HOURS, DEFAULT_SLA_CONFIG } from '../lib/constants';
import type { LeadTier, LeadStage, LeadFormData } from '../types/lead';
import { formatDateTime } from '../lib/formatters';

export const LeadsPage: React.FC = () => {
  const navigate = useNavigate();
  const { crmUser } = useAuth();
  const { success, error } = useToast();
  const [tierFilter, setTierFilter] = useState<'all' | LeadTier>('all');
  const [stageFilter, setStageFilter] = useState<'all' | LeadStage>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const { leads, loading } = useLeads();

  // Filter and search leads
  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    return leads.filter((lead) => {
      const matchesTier = tierFilter === 'all' || lead.tier === tierFilter;
      const matchesStage = stageFilter === 'all' || lead.stage === stageFilter;
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        `${lead.firstName} ${lead.lastName}`.toLowerCase().includes(term) ||
        (lead.company && lead.company.toLowerCase().includes(term)) ||
        lead.email.toLowerCase().includes(term) ||
        lead.productCategory.toLowerCase().includes(term);

      return matchesTier && matchesStage && matchesSearch;
    });
  }, [leads, tierFilter, stageFilter, searchTerm]);

  // Handle manual lead creation
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

      const leadData = {
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
        slaDeadline: Timestamp.fromDate(slaDeadline),
        slaStatus: 'ok',
        contactedAt: null,
        shopifyCustomerId: null,
        aiSummary: null,
        aiNextAction: null,
        tags: [formData.productCategory.toLowerCase().replace(/\s+/g, '-'), tier],
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      };

      const docRef = await addDoc(collection(db, 'leads'), leadData);

      // Add created event
      await addDoc(collection(docRef, 'events'), {
        type: 'created',
        description: `Manually created lead for ${formData.firstName} ${formData.lastName}`,
        metadata: { score, tier, category: formData.productCategory },
        createdBy: crmUser?.displayName || 'Team Member',
        createdAt: Timestamp.fromDate(now),
      });

      success(`Lead created successfully! Score: ${score} (${tier.toUpperCase()})`);
      setIsModalOpen(false);
      navigate(`/leads/${docRef.id}`);
    } catch (err) {
      console.error('Error creating lead:', err);
      error('Failed to create lead. Please check permissions or console.');
    } finally {
      setCreating(false);
    }
  };

  const stageOptions = [
    { value: 'all', label: 'All Stages' },
    ...Object.entries(STAGE_LABELS).map(([value, label]) => ({ value, label })),
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-400" />
            <span>Lead Directory</span>
          </h1>
          <p className="text-sm text-surface-400 mt-0.5">
            Manage, filter, and score high-ticket equipment inquiries. Total: {filteredLeads.length} leads
          </p>
        </div>
        <Button variant="primary" onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>Add New Lead</span>
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-surface-900 border border-surface-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Tier Pills */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          <span className="text-xs font-semibold text-surface-400 flex items-center gap-1.5 mr-1">
            <Filter className="w-3.5 h-3.5" /> Tier:
          </span>
          {(['all', 'hot', 'warm', 'cold'] as const).map((tier) => (
            <button
              key={tier}
              onClick={() => setTierFilter(tier)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all shrink-0 ${
                tierFilter === tier
                  ? tier === 'hot'
                    ? 'bg-red-500 text-white shadow-md shadow-red-500/30'
                    : tier === 'warm'
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                    : tier === 'cold'
                    ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                    : 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                  : 'bg-surface-800 text-surface-300 hover:text-white hover:bg-surface-700'
              }`}
            >
              {tier === 'all' ? 'All Tiers' : tier}
            </button>
          ))}
        </div>

        {/* Stage Dropdown + Search Input */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-44 shrink-0">
            <Select
              options={stageOptions}
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value as any)}
            />
          </div>
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input
              type="text"
              placeholder="Search leads, company, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-surface-800 border border-surface-700 rounded-lg text-xs text-white placeholder:text-surface-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-surface-900 border border-surface-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-950/80 border-b border-surface-800 text-xs font-semibold text-surface-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Lead & Company</th>
                <th className="py-3.5 px-4">Equipment & Budget</th>
                <th className="py-3.5 px-4">Score & Tier</th>
                <th className="py-3.5 px-4">Stage</th>
                <th className="py-3.5 px-4">SLA Urgency</th>
                <th className="py-3.5 px-4">Source</th>
                <th className="py-3.5 px-4 text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800/60 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-surface-400">
                    Loading leads directory...
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-surface-400">
                    No leads found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const isOverdue = lead.slaStatus === 'overdue' && !lead.contactedAt;
                  const isHot = lead.tier === 'hot';
                  const createdObj = lead.createdAt instanceof Timestamp ? lead.createdAt.toDate() : new Date(lead.createdAt);

                  return (
                    <tr
                      key={lead.id}
                      onClick={() => navigate(`/leads/${lead.id}`)}
                      className={`hover:bg-surface-800/50 transition-colors cursor-pointer group ${
                        isOverdue ? 'bg-red-950/15' : ''
                      } ${isHot ? 'border-l-4 border-l-red-500' : ''}`}
                    >
                      {/* Name & Company */}
                      <td className="py-3.5 px-4 max-w-[220px]">
                        <div className="font-semibold text-white group-hover:text-brand-400 truncate">
                          {lead.firstName} {lead.lastName}
                        </div>
                        <div className="text-xs text-surface-400 truncate">
                          {lead.company || lead.email}
                        </div>
                      </td>

                      {/* Category & Budget */}
                      <td className="py-3.5 px-4 max-w-[200px]">
                        <div className="flex items-center gap-1.5 font-medium text-white text-xs truncate">
                          <Package className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                          <span>{lead.quantity}x {lead.productCategory}</span>
                        </div>
                        <div className="text-xs text-emerald-400 font-semibold mt-0.5">
                          {lead.targetBudget}
                        </div>
                      </td>

                      {/* Score Badge */}
                      <td className="py-3.5 px-4">
                        <LeadScoreBadge score={lead.score} tier={lead.tier} size="sm" />
                      </td>

                      {/* Stage */}
                      <td className="py-3.5 px-4">
                        <span className="text-xs font-medium px-2 py-1 rounded bg-surface-800 text-surface-300 border border-surface-700">
                          {STAGE_LABELS[lead.stage] || lead.stage}
                        </span>
                      </td>

                      {/* SLA */}
                      <td className="py-3.5 px-4">
                        {lead.contactedAt ? (
                          <span className="text-xs text-emerald-400 font-medium">✅ Contacted</span>
                        ) : lead.slaDeadline ? (
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded ${
                              isOverdue
                                ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                                : 'text-amber-400'
                            }`}
                          >
                            {isOverdue ? '⚠️ ' : '⏱️ '}
                            {formatSLARemaining(lead.slaDeadline)}
                          </span>
                        ) : (
                          <span className="text-xs text-surface-500">—</span>
                        )}
                      </td>

                      {/* Source */}
                      <td className="py-3.5 px-4">
                        <LeadSourceTag source={lead.source} />
                      </td>

                      {/* Created */}
                      <td className="py-3.5 px-4 text-right text-xs text-surface-400 font-mono">
                        {formatDateTime(createdObj).split(' ')[0]}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Lead Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Lead Inquiry" size="lg">
        <LeadForm onSubmit={handleCreateLead} loading={creating} />
      </Modal>
    </div>
  );
};

export default LeadsPage;
