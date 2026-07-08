// ─────────────────────────────────────────────────────────────
// PipelinePage – Deal Kanban Pipeline Management
// ─────────────────────────────────────────────────────────────
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  DollarSign,
  TrendingUp,
  Award,
  Plus,
  Briefcase,
  Clock,
  User,
  Package,
  ExternalLink,
} from 'lucide-react';
import { useDeals } from '../hooks/useDeals';
import { useLeads } from '../hooks/useLeads';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';
import { formatCurrency } from '../lib/formatters';
import type { Lead } from '../types/lead';

const KANBAN_COLUMNS = [
  { id: 'new', title: 'New', color: 'border-blue-500/50 bg-blue-500/10 text-blue-400' },
  { id: 'quoted', title: 'Quoted', color: 'border-purple-500/50 bg-purple-500/10 text-purple-400' },
  { id: 'negotiation', title: 'Negotiation', color: 'border-amber-500/50 bg-amber-500/10 text-amber-400' },
  { id: 'won', title: 'Won', color: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' },
  { id: 'lost', title: 'Lost', color: 'border-red-500/50 bg-red-500/10 text-red-400' },
] as const;

export default function PipelinePage() {
  const { deals, loading, createDeal, moveDeal } = useDeals();
  const { leads } = useLeads();

  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeMobileStage, setActiveMobileStage] = useState<string>('new');

  // New Deal Modal State
  const [title, setTitle] = useState('');
  const [leadId, setLeadId] = useState('');
  const [contactName, setContactName] = useState('');
  const [value, setValue] = useState('');
  const [stage, setStage] = useState<string>('new');
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Map lead info for cards
  const leadMap = useMemo(() => {
    const map: Record<string, { name: string; category: string }> = {};
    leads.forEach((l: Lead) => {
      map[l.id] = {
        name: `${l.firstName} ${l.lastName}`,
        category: l.productCategory || 'Equipment',
      };
    });
    return map;
  }, [leads]);

  // Handle lead select in form to autofill contactName and default title
  const handleLeadSelect = (id: string) => {
    setLeadId(id);
    const l = leads.find((x: Lead) => x.id === id);
    if (l) {
      const name = `${l.firstName} ${l.lastName}`;
      setContactName(name);
      if (!title) {
        setTitle(`${l.company || name} - ${l.productCategory || 'Equipment Deal'}`);
      }
    }
  };

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !contactName.trim()) return;
    try {
      setSubmitting(true);
      await createDeal({
        title: title.trim(),
        leadId: leadId || 'unassigned',
        contactName: contactName.trim(),
        value: Number(value) || 0,
        stage: stage as any,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
        notes: notes.trim() || undefined,
      });
      // Reset
      setTitle('');
      setLeadId('');
      setContactName('');
      setValue('');
      setStage('new');
      setExpectedCloseDate('');
      setNotes('');
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to create deal:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // KPI calculations
  const { totalPipelineValue, avgDealValue, winRate } = useMemo(() => {
    let totalVal = 0;
    let activeCount = 0;
    let wonCount = 0;
    let lostCount = 0;

    deals.forEach((d) => {
      const st = (d.stage || '').toLowerCase();
      const val = Number(d.value) || 0;
      if (st === 'won' || st === 'closed_won') {
        wonCount++;
      } else if (st === 'lost' || st === 'closed_lost') {
        lostCount++;
      } else {
        totalVal += val;
        activeCount++;
      }
    });

    const avg = activeCount > 0 ? totalVal / activeCount : 0;
    const closedTotal = wonCount + lostCount;
    const winRatePct = closedTotal > 0 ? (wonCount / closedTotal) * 100 : 0;

    return {
      totalPipelineValue: totalVal,
      avgDealValue: avg,
      winRate: winRatePct,
    };
  }, [deals]);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedDealId(id);
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggedDealId;
    if (id) {
      try {
        await moveDeal(id, targetStage as any);
      } catch (err) {
        console.error('Failed to move deal:', err);
      }
    }
    setDraggedDealId(null);
  };

  return (
    <div className="space-y-6 pb-16 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Briefcase className="w-7 h-7 text-emerald-400" />
            <span>Commercial Deal Pipeline</span>
          </h1>
          <p className="text-sm text-surface-400 mt-1">
            Drag and drop high-ticket equipment quotes through the commercial sales stages.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-lg shadow-lg shadow-brand-600/20 transition-all flex items-center justify-center gap-2 text-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Deal</span>
        </button>
      </div>

      {/* Top Banner KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-900 border border-surface-800 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
              Active Pipeline Value
            </span>
            <div className="text-2xl font-bold text-emerald-400 mt-2 tracking-tight">
              {formatCurrency(totalPipelineValue)}
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-surface-900 border border-surface-800 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
              Average Active Deal Size
            </span>
            <div className="text-2xl font-bold text-surface-100 mt-2 tracking-tight">
              {formatCurrency(avgDealValue)}
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-surface-900 border border-surface-800 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
              Historical Win Rate
            </span>
            <div className="text-2xl font-bold text-brand-400 mt-2 tracking-tight">
              {winRate.toFixed(1)}%
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-400">
            <Award className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Kanban Board Grid */}
      {loading && deals.length === 0 ? (
        <div className="p-16 flex flex-col items-center justify-center text-center bg-surface-900 border border-surface-800 rounded-xl">
          <Spinner className="w-8 h-8 text-brand-500 mb-3" />
          <p className="text-sm text-surface-400">Loading pipeline deals…</p>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          {/* Mobile Tab Selector */}
          <div className="md:hidden flex overflow-x-auto snap-x gap-2 mb-4 pb-2 border-b border-surface-800 hide-scrollbar">
            {KANBAN_COLUMNS.map((col) => (
              <button
                key={col.id}
                onClick={() => setActiveMobileStage(col.id)}
                className={`flex-shrink-0 snap-start px-4 py-2.5 rounded-lg text-sm font-bold transition-all min-h-[48px] active:scale-95 ${
                  activeMobileStage === col.id
                    ? col.color
                    : 'bg-surface-800 text-surface-400 border border-surface-700'
                }`}
              >
                {col.title}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start pb-4">
            {KANBAN_COLUMNS.map((col) => {
              // Filter deals belonging to this column (support both simple and extended stage names)
              const colDeals = deals.filter((d) => {
                const st = (d.stage || 'new').toLowerCase();
                if (col.id === 'new') return st === 'new' || st === 'qualification' || st === 'contacted' || st === 'qualified';
                if (col.id === 'quoted') return st === 'quoted' || st === 'proposal';
                if (col.id === 'negotiation') return st === 'negotiation' || st === 'contract';
                if (col.id === 'won') return st === 'won' || st === 'closed_won';
                if (col.id === 'lost') return st === 'lost' || st === 'closed_lost';
                return false;
              });

              const colValueSum = colDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
              const isHiddenOnMobile = activeMobileStage !== col.id;

              return (
                <div
                  key={col.id}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, col.id)}
                  className={`bg-surface-900/80 border border-surface-800 rounded-xl flex flex-col h-full md:min-h-[520px] shadow-sm overflow-hidden ${isHiddenOnMobile ? 'hidden md:flex' : 'flex'}`}
                >
                {/* Column Header */}
                <div className={`p-4 border-b border-surface-800/80 flex flex-col gap-1.5 ${col.color.split(' ')[1]}`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-bold text-sm tracking-tight ${col.color.split(' ')[2]}`}>
                      {col.title}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-surface-950/60 text-surface-200">
                      {colDeals.length}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-surface-300">
                    {formatCurrency(colValueSum)}
                  </div>
                </div>

                {/* Column Cards */}
                <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[640px]">
                  {colDeals.length === 0 ? (
                    <div className="h-32 flex items-center justify-center border-2 border-dashed border-surface-800/60 rounded-lg text-xs text-surface-500 font-medium">
                      Drop deals here
                    </div>
                  ) : (
                    colDeals.map((deal) => {
                      const leadInfo = deal.leadId ? leadMap[deal.leadId] : null;
                      const displayLeadName = leadInfo?.name || deal.contactName || 'Unknown Lead';
                      const displayCategory = leadInfo?.category || 'Equipment';
                      const createdDate = deal.createdAt ? new Date(deal.createdAt) : new Date();
                      const daysInStage = Math.max(0, Math.floor((Date.now() - createdDate.getTime()) / (1000 * 3600 * 24)));

                      return (
                        <div
                          key={deal.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, deal.id)}
                          className="p-4 bg-surface-950 border border-surface-800 hover:border-brand-500/50 rounded-xl shadow-sm transition-all cursor-move group space-y-3 relative"
                        >
                          {/* Title & Value */}
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-bold text-sm text-white group-hover:text-brand-400 transition-colors line-clamp-2">
                                {deal.title}
                              </h4>
                              <span className="font-extrabold text-sm text-emerald-400 shrink-0">
                                {formatCurrency(deal.value)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 text-xs text-surface-400">
                              <User className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                              <span className="truncate">{displayLeadName}</span>
                            </div>
                          </div>

                          {/* Category Pill & Days in Stage */}
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-surface-850 text-xs">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-surface-900 text-surface-300 border border-surface-800 truncate max-w-[120px]">
                              <Package className="w-3 h-3 text-surface-500 shrink-0" />
                              <span className="truncate">{displayCategory}</span>
                            </span>
                            <span className="flex items-center gap-1 text-surface-500 font-medium shrink-0">
                              <Clock className="w-3 h-3" />
                              <span>{daysInStage}d in stage</span>
                            </span>
                          </div>

                          {/* Stage Quick Selector & Lead Link */}
                          <div className="flex items-center justify-between gap-2 pt-1">
                            {deal.leadId && deal.leadId !== 'unassigned' && (
                              <Link
                                to={`/leads/${deal.leadId}`}
                                className="text-[11px] font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-0.5"
                                title="Inspect Lead"
                              >
                                <span>Lead</span>
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            )}

                            <select
                              value={col.id}
                              onChange={(e) => moveDeal(deal.id, e.target.value as any)}
                              className="ml-auto px-2 py-1 bg-surface-900 border border-surface-750 rounded text-[11px] font-medium text-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
                              title="Move Stage"
                            >
                              {KANBAN_COLUMNS.map((c) => (
                                <option key={c.id} value={c.id}>
                                  → {c.title}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Deal Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Create New Pipeline Deal"
        >
          <form onSubmit={handleCreateDeal} className="p-2 space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-1.5">
                Associate with Lead
              </label>
              <select
                value={leadId}
                onChange={(e) => handleLeadSelect(e.target.value)}
                className="w-full px-3 py-2 bg-surface-950 border border-surface-700 rounded-lg text-sm text-surface-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">-- Select Existing Lead --</option>
                {leads.map((l: Lead) => (
                  <option key={l.id} value={l.id}>
                    {l.firstName} {l.lastName} {l.company ? `(${l.company})` : ''} - {l.productCategory}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-1.5">
                Deal Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Acme Corp - 4-Post Lift Commercial Package"
                className="w-full px-3 py-2 bg-surface-950 border border-surface-700 rounded-lg text-sm text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-1.5">
                  Primary Contact Name *
                </label>
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 bg-surface-950 border border-surface-700 rounded-lg text-sm text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-1.5">
                  Deal Value ($ USD) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="100"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="e.g. 12500"
                  className="w-full px-3 py-2 bg-surface-950 border border-surface-700 rounded-lg text-sm text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-1.5">
                  Initial Stage
                </label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-950 border border-surface-700 rounded-lg text-sm text-surface-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="new">New</option>
                  <option value="quoted">Quoted</option>
                  <option value="negotiation">Negotiation</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-1.5">
                  Expected Close Date
                </label>
                <input
                  type="date"
                  value={expectedCloseDate}
                  onChange={(e) => setExpectedCloseDate(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-950 border border-surface-700 rounded-lg text-sm text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-1.5">
                Notes / Terms
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Include shipping requirements, installation notes, or discounts…"
                className="w-full px-3 py-2 bg-surface-950 border border-surface-700 rounded-lg text-sm text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-300 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                {submitting ? 'Creating…' : 'Create Deal'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
