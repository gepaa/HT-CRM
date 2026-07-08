import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Building, MapPin, Package, Sparkles, ExternalLink, CheckCircle2, FileText, Trophy, XCircle } from 'lucide-react';
import { useLeadDetail } from '../hooks/useLeadDetail';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { LeadScoreBadge } from '../components/leads/LeadScoreBadge';
import { LeadSourceTag } from '../components/leads/LeadSourceTag';
import { LeadTimeline } from '../components/leads/LeadTimeline';
import { LeadNotes } from '../components/leads/LeadNotes';
import { LeadTasks } from '../components/leads/LeadTasks';
import type { LeadStage } from '../types/lead';
import type { TaskPriority } from '../types/crm';
import { STAGE_LABELS } from '../lib/constants';
import { formatDateTime } from '../lib/formatters';

export const LeadDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { crmUser } = useAuth();
  const { success, error } = useToast();
  const [activeTab, setActiveTab] = useState<'timeline' | 'notes' | 'tasks'>('notes');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('normal');
  const [isWonModalOpen, setIsWonModalOpen] = useState(false);
  const [wonRevenue, setWonRevenue] = useState('');
  const [isLostModalOpen, setIsLostModalOpen] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [aiEmailDraft, setAiEmailDraft] = useState<string | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  const { lead, events, notes, tasks, loading, updateLead, updateStage, addNote, createTask, updateTaskStatus,
    markLeadContacted, markQuoteSent, markLeadWon, markLeadLost } = useLeadDetail(id || '');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" className="text-brand-500" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-16">
        <h2 className="text-lg font-bold text-white mb-2">Lead Not Found</h2>
        <p className="text-sm text-surface-400 mb-6">The lead you requested does not exist or was removed.</p>
        <Button variant="secondary" onClick={() => navigate('/leads')}>
          <ArrowLeft className="w-4 h-4" /> Back to Leads
        </Button>
      </div>
    );
  }

  const handleStageChange = async (newStage: LeadStage) => {
    try {
      await updateStage(newStage);
      success(`Stage updated to ${STAGE_LABELS[newStage] || newStage}`);
    } catch {
      error('Failed to update stage.');
    }
  };

  const runAction = async (label: string, key: string, fn: () => Promise<void>) => {
    setActionLoading(key);
    try {
      await fn();
      success(label);
    } catch {
      error(`${label} failed. Please try again.`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkContacted = () =>
    runAction('Lead marked as contacted!', 'contacted', markLeadContacted);

  const handleMarkQuoteSent = () =>
    runAction('Quote sent — stage updated to Quoted.', 'quote', markQuoteSent);

  const handleMarkWon = async (e: React.FormEvent) => {
    e.preventDefault();
    const revenue = wonRevenue ? Number(wonRevenue) : undefined;
    setIsWonModalOpen(false);
    setWonRevenue('');
    await runAction('🏆 Lead marked WON!', 'won', () => markLeadWon(revenue));
  };

  const handleMarkLost = async (e: React.FormEvent) => {
    e.preventDefault();
    const reason = lostReason.trim() || undefined;
    setIsLostModalOpen(false);
    setLostReason('');
    await runAction('Lead marked as lost.', 'lost', () => markLeadLost(reason));
  };

  const handleToggleTask = async (taskId: string) => {
    try {
      // Find task and toggle in Supabase
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      await updateTaskStatus(taskId, newStatus);
      success(`Task marked as ${newStatus}`);
    } catch {
      error('Failed to update task status');
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !id) return;
    try {
      await createTask({
        title: taskTitle.trim(),
        description: taskDesc.trim() || undefined,
        priority: taskPriority,
        dueDate: new Date(Date.now() + 86400000),
        assignedTo: crmUser?.id || crmUser?.displayName || 'Unassigned',
      });
      success('Follow-up task scheduled!');
      setIsTaskModalOpen(false);
      setTaskTitle('');
      setTaskDesc('');
    } catch {
      error('Failed to schedule task');
    }
  };

  const handleGenerateAISummary = async () => {
    if (!lead) return;
    setActionLoading('aiSummary');
    try {
      const res = await fetch('/api/ai/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze_lead', lead })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await updateLead({
          aiSummary: data.aiSummary,
          aiNextAction: data.aiNextAction,
        });
        success('Gemini 1.5 Flash generated new AI summary & next action!');
      } else {
        throw new Error(data.error || 'Failed to generate summary');
      }
    } catch (err: any) {
      error(err.message || 'Error communicating with Gemini AI.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDraftAIEmail = async () => {
    if (!lead) return;
    setActionLoading('aiEmail');
    try {
      const res = await fetch('/api/ai/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'draft_email', lead })
      });
      const data = await res.json();
      if (res.ok && data.success && data.emailDraft) {
        setAiEmailDraft(data.emailDraft);
        setIsEmailModalOpen(true);
        success('Gemini 1.5 Flash drafted custom quote email!');
      } else {
        throw new Error(data.error || 'Failed to draft email');
      }
    } catch (err: any) {
      error(err.message || 'Error communicating with Gemini AI.');
    } finally {
      setActionLoading(null);
    }
  };

  const stageOptions = Object.entries(STAGE_LABELS).map(([val, lbl]) => ({ value: val, label: lbl }));
  const createdObj = lead.createdAt instanceof Date ? lead.createdAt : new Date(lead.createdAt);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Bar: Back button + Title + Stage selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-900 border border-surface-800 rounded-xl p-6 shadow-md">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => navigate('/leads')}
            className="p-2 rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-white transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white truncate">
                {lead.firstName} {lead.lastName}
              </h1>
              <LeadScoreBadge score={lead.score} tier={lead.tier} size="md" />
            </div>
            <p className="text-sm text-surface-400 font-medium truncate mt-1">
              {lead.company ? `${lead.company} • ` : ''}Added {formatDateTime(createdObj)}
            </p>
          </div>
        </div>

        {/* Stage dropdown */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-semibold text-surface-400">Pipeline Stage:</span>
          <div className="w-48">
            <Select
              options={stageOptions}
              value={lead.stage}
              onChange={(e) => handleStageChange(e.target.value as LeadStage)}
            />
          </div>
        </div>
      </div>

      {/* Main Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quote & Equipment Specs Card */}
          <div className="bg-surface-900 border border-surface-800 rounded-xl p-6 shadow-md">
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4 border-b border-surface-800 pb-3">
              <Package className="w-5 h-5 text-brand-400" />
              <span>Equipment Quote Requirements</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-surface-950/60 p-3.5 rounded-lg border border-surface-800/80">
                <span className="block text-xs text-surface-400 font-medium mb-1">Requested Category</span>
                <span className="text-base font-bold text-white">{lead.productCategory}</span>
              </div>
              <div className="bg-surface-950/60 p-3.5 rounded-lg border border-surface-800/80">
                <span className="block text-xs text-surface-400 font-medium mb-1">Quantity Needed</span>
                <span className="text-base font-bold text-white">{lead.quantity} Unit(s)</span>
              </div>
              <div className="bg-surface-950/60 p-3.5 rounded-lg border border-surface-800/80">
                <span className="block text-xs text-surface-400 font-medium mb-1">Target Budget</span>
                <span className="text-base font-bold text-emerald-400">{lead.targetBudget}</span>
              </div>
            </div>

            {lead.projectDetails && (
              <div className="bg-surface-950/40 p-4 rounded-xl border border-surface-800">
                <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Project Specs & Timeline</h4>
                <p className="text-sm text-surface-200 whitespace-pre-wrap leading-relaxed">{lead.projectDetails}</p>
              </div>
            )}
          </div>

          {/* Activity Tabs (Notes / Tasks / Timeline) */}
          <div className="bg-surface-900 border border-surface-800 rounded-xl p-6 shadow-md">
            <div className="flex overflow-x-auto snap-x hide-scrollbar items-center gap-4 border-b border-surface-800 pb-4 mb-6">
              {(['notes', 'tasks', 'timeline'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`snap-start whitespace-nowrap px-1 min-h-[48px] text-sm font-semibold capitalize pb-2 transition-colors relative active:scale-95 ${
                    activeTab === tab
                      ? 'text-brand-400 after:absolute after:bottom-[-17px] after:left-0 after:right-0 after:h-0.5 after:bg-brand-500 font-bold'
                      : 'text-surface-400 hover:text-white'
                  }`}
                >
                  {tab === 'notes' ? `Notes (${notes.length})` : tab === 'tasks' ? `Tasks (${tasks.length})` : `Timeline (${events.length})`}
                </button>
              ))}
            </div>

            {activeTab === 'notes' && <LeadNotes notes={notes} onAddNote={addNote} />}
            {activeTab === 'tasks' && (
              <LeadTasks
                tasks={tasks}
                onToggleComplete={handleToggleTask}
                onCreateTask={() => setIsTaskModalOpen(true)}
              />
            )}
            {activeTab === 'timeline' && <LeadTimeline events={events} />}
          </div>
        </div>

        {/* Right Column (1/3 width) */}
        <div className="space-y-6">

          {/* ── Quick Actions Card ───────────────────────── */}
          <div className="bg-surface-900 border border-surface-800 rounded-xl p-6 shadow-md space-y-3">
            <h3 className="text-base font-bold text-white border-b border-surface-800 pb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-brand-400" />
              Quick Actions
            </h3>

            {/* Mark Contacted */}
            <Button
              variant="primary"
              size="sm"
              className="w-full justify-center min-h-[48px] active:scale-95"
              loading={actionLoading === 'contacted'}
              disabled={!!lead.contactedAt || actionLoading !== null}
              onClick={handleMarkContacted}
              title={lead.contactedAt ? 'Already marked as contacted' : 'Mark this lead as contacted'}
            >
              <CheckCircle2 className="w-4 h-4" />
              {lead.contactedAt ? 'Contacted ✓' : 'Mark Contacted'}
            </Button>

            {/* Mark Quote Sent */}
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-center min-h-[48px] active:scale-95"
              loading={actionLoading === 'quote'}
              disabled={lead.stage === 'quoted' || lead.stage === 'won' || lead.stage === 'lost' || actionLoading !== null}
              onClick={handleMarkQuoteSent}
            >
              <FileText className="w-4 h-4" />
              Mark Quote Sent
            </Button>

            {/* Mark Won */}
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-center text-emerald-400 hover:text-emerald-300 min-h-[48px] active:scale-95"
              loading={actionLoading === 'won'}
              disabled={lead.stage === 'won' || lead.stage === 'lost' || actionLoading !== null}
              onClick={() => setIsWonModalOpen(true)}
            >
              <Trophy className="w-4 h-4" />
              Mark Won
            </Button>

            {/* Mark Lost */}
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-center text-red-400 hover:text-red-300 min-h-[48px] active:scale-95"
              loading={actionLoading === 'lost'}
              disabled={lead.stage === 'won' || lead.stage === 'lost' || actionLoading !== null}
              onClick={() => setIsLostModalOpen(true)}
            >
              <XCircle className="w-4 h-4" />
              Mark Lost
            </Button>
          </div>
          {/* Contact Details Card */}
          <div className="bg-surface-900 border border-surface-800 rounded-xl p-6 shadow-md space-y-4">
            <h3 className="text-base font-bold text-white border-b border-surface-800 pb-3">Contact Information</h3>
            <div className="space-y-3 text-sm">
              <a
                href={`mailto:${lead.email}`}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-950/60 hover:bg-surface-800 transition-colors text-white group"
              >
                <Mail className="w-4 h-4 text-brand-400 shrink-0" />
                <span className="truncate flex-1 font-medium">{lead.email}</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-surface-400" />
              </a>
              {lead.phone && (
                <a
                  href={`tel:${lead.phone}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-950/60 hover:bg-surface-800 transition-colors text-white group"
                >
                  <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="truncate flex-1 font-medium">{lead.phone}</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-surface-400" />
                </a>
              )}
              {lead.company && (
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-950/60 text-surface-300">
                  <Building className="w-4 h-4 text-purple-400 shrink-0" />
                  <span className="truncate font-medium">{lead.company}</span>
                </div>
              )}
              {lead.deliveryZip && (
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-950/60 text-surface-300">
                  <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="truncate font-medium">Delivery ZIP: {lead.deliveryZip}</span>
                </div>
              )}
            </div>
          </div>

          {/* Attribution & Marketing Source Card */}
          <div className="bg-surface-900 border border-surface-800 rounded-xl p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-surface-800 pb-3">
              <h3 className="text-base font-bold text-white">Attribution Source</h3>
              <LeadSourceTag source={lead.source} />
            </div>
            <div className="space-y-2 text-xs font-mono bg-surface-950 p-3.5 rounded-lg border border-surface-800/80">
              <p className="text-surface-300">
                <span className="text-surface-500">UTM Source:</span> {lead.source?.utm_source || 'direct'}
              </p>
              <p className="text-surface-300">
                <span className="text-surface-500">UTM Medium:</span> {lead.source?.utm_medium || 'none'}
              </p>
              {lead.source?.utm_campaign && (
                <p className="text-surface-300">
                  <span className="text-surface-500">Campaign:</span> {lead.source.utm_campaign}
                </p>
              )}
              {lead.source?.gclid && (
                <p className="text-emerald-400 font-semibold truncate" title={lead.source.gclid}>
                  <span className="text-surface-500">Google GCLID:</span> {lead.source.gclid.substring(0, 20)}...
                </p>
              )}
            </div>
          </div>

          {/* AI Assistant Card (Placeholder Buttons) */}
          <div className="bg-gradient-to-br from-surface-900 via-surface-900 to-purple-950/30 border border-purple-500/30 rounded-xl p-6 shadow-lg space-y-4 relative overflow-hidden">
            <div className="flex items-center gap-2 border-b border-purple-500/20 pb-3">
              <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
              <h3 className="text-base font-bold text-white">AI Sales Assistant</h3>
            </div>
            <p className="text-xs text-surface-300 leading-relaxed">
              {lead.aiSummary || `Analyzed high-ticket equipment intent for ${lead.quantity}x ${lead.productCategory}.`}
            </p>
            <div className="bg-purple-950/40 p-3 rounded-lg border border-purple-500/20 text-xs text-purple-200">
              <strong className="text-purple-300 block mb-0.5">Suggested Next Action:</strong>
              {lead.aiNextAction || 'Call immediately to verify electrical specifications and issue formal PO proposal.'}
            </div>
            <div className="space-y-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleGenerateAISummary}
                disabled={actionLoading === 'aiSummary'}
                className="w-full justify-center bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold"
              >
                <Sparkles className={`w-3.5 h-3.5 text-purple-400 ${actionLoading === 'aiSummary' ? 'animate-spin' : ''}`} />
                <span>{actionLoading === 'aiSummary' ? 'Analyzing with Gemini...' : 'Generate Gemini AI Summary'}</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDraftAIEmail}
                disabled={actionLoading === 'aiEmail'}
                className="w-full justify-center bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold"
              >
                <Mail className={`w-3.5 h-3.5 text-blue-400 ${actionLoading === 'aiEmail' ? 'animate-bounce' : ''}`} />
                <span>{actionLoading === 'aiEmail' ? 'Drafting Email...' : 'Draft Quote Reply Email'}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Task Modal */}
      <Modal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} title="Schedule Follow-Up Task" size="md">
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5">Task Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Call regarding voltage requirements"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              className="w-full bg-surface-800 border border-surface-700 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5">Description / Notes</label>
            <textarea
              rows={3}
              placeholder="Add optional context for the sales rep..."
              value={taskDesc}
              onChange={(e) => setTaskDesc(e.target.value)}
              className="w-full bg-surface-800 border border-surface-700 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5">Priority</label>
            <select
              value={taskPriority}
              onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
              className="w-full bg-surface-800 border border-surface-700 rounded-lg p-2.5 text-sm text-white"
            >
              <option value="urgent">Urgent (Immediate action required)</option>
              <option value="high">High (Within SLA window)</option>
              <option value="normal">Normal (Routine follow-up)</option>
              <option value="low">Low (When available)</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-surface-800">
            <Button type="button" variant="ghost" onClick={() => setIsTaskModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Schedule Task</Button>
          </div>
        </form>
      </Modal>

      {/* Mark Won Modal */}
      <Modal isOpen={isWonModalOpen} onClose={() => { setIsWonModalOpen(false); setWonRevenue(''); }} title="🏆 Mark Lead as Won" size="sm">
        <form onSubmit={handleMarkWon} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5">
              Actual Deal Revenue (Optional)
            </label>
            <input
              type="number"
              min="0"
              step="100"
              placeholder="e.g. 14500"
              value={wonRevenue}
              onChange={(e) => setWonRevenue(e.target.value)}
              className="w-full bg-surface-800 border border-surface-700 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-xs text-surface-500 mt-1">Leave blank to use the estimated deal value.</p>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-surface-800">
            <Button type="button" variant="ghost" onClick={() => { setIsWonModalOpen(false); setWonRevenue(''); }}>Cancel</Button>
            <Button type="submit" variant="primary" className="bg-emerald-600 hover:bg-emerald-500">
              <Trophy className="w-4 h-4" />
              Confirm Won
            </Button>
          </div>
        </form>
      </Modal>

      {/* Mark Lost Modal */}
      <Modal isOpen={isLostModalOpen} onClose={() => { setIsLostModalOpen(false); setLostReason(''); }} title="Mark Lead as Lost" size="sm">
        <form onSubmit={handleMarkLost} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5">
              Loss Reason (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Chose competitor, price too high, not ready to buy..."
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              className="w-full bg-surface-800 border border-surface-700 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-surface-800">
            <Button type="button" variant="ghost" onClick={() => { setIsLostModalOpen(false); setLostReason(''); }}>Cancel</Button>
            <Button type="submit" variant="secondary" className="text-red-400 hover:text-red-300">
              <XCircle className="w-4 h-4" />
              Confirm Lost
            </Button>
          </div>
        </form>
      </Modal>

      {/* Gemini AI Email Draft Modal */}
      <Modal isOpen={isEmailModalOpen} onClose={() => setIsEmailModalOpen(false)} title="Gemini 1.5 Flash — Drafted Reply" size="md">
        <div className="space-y-4">
          <div className="bg-surface-950 p-4 rounded-lg border border-surface-800 text-xs text-surface-200 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed select-all">
            {aiEmailDraft}
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-surface-800">
            <Button type="button" variant="ghost" onClick={() => setIsEmailModalOpen(false)}>Close</Button>
            <Button
              type="button"
              variant="primary"
              className="bg-brand-600 hover:bg-brand-500 text-white"
              onClick={() => {
                if (aiEmailDraft) {
                  navigator.clipboard.writeText(aiEmailDraft);
                  success('Email draft copied to clipboard!');
                  setIsEmailModalOpen(false);
                }
              }}
            >
              <FileText className="w-4 h-4" />
              Copy to Clipboard
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default LeadDetailPage;
