// ─────────────────────────────────────────────────────────────
// TasksPage – Action Item & SLA Follow-Up Task Management
// ─────────────────────────────────────────────────────────────
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckSquare,
  Plus,
  Filter,
  Calendar,
  User,
  Bot,
  ExternalLink,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { useTasks } from '../hooks/useTasks';
import { useLeads } from '../hooks/useLeads';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { formatDate } from '../lib/formatters';
import type { TaskStatus, TaskPriority } from '../types/crm';
import type { Lead } from '../types/lead';

export default function TasksPage() {
  const { tasks, loading, createTask, completeTask } = useTasks();
  const { leads } = useLeads();

  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Task Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [leadId, setLeadId] = useState('');
  const [assignedTo, setAssignedTo] = useState('Sales Rep');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDateStr, setDueDateStr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Map lead IDs to names for display
  const leadMap = useMemo(() => {
    const map: Record<string, string> = {};
    leads.forEach((l: Lead) => {
      map[l.id] = `${l.firstName} ${l.lastName}`;
    });
    return map;
  }, [leads]);

  // Filter and group tasks: Overdue at top
  const displayedTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        if (statusFilter !== 'all' && t.status !== statusFilter) return false;
        if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const now = Date.now();
        const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        const aOverdue = aDue < now && a.status !== 'completed' && a.status !== 'cancelled';
        const bOverdue = bDue < now && b.status !== 'completed' && b.status !== 'cancelled';

        // Group overdue first
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;

        // Then by due date ascending
        return aDue - bDue;
      });
  }, [tasks, statusFilter, priorityFilter]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      setSubmitting(true);
      await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        leadId: leadId || undefined,
        assignedTo: assignedTo.trim() || 'Unassigned',
        priority,
        dueDate: dueDateStr ? new Date(dueDateStr) : null,
      });
      // Reset & close
      setTitle('');
      setDescription('');
      setLeadId('');
      setDueDateStr('');
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const getPriorityBadge = (prio: TaskPriority) => {
    switch (prio) {
      case 'urgent':
        return <Badge variant="danger">Urgent</Badge>;
      case 'high':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">High</span>;
      case 'medium':
      case 'normal' as any:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase">Medium</span>;
      case 'low':
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-800 text-surface-400 uppercase">Low</span>;
    }
  };

  return (
    <div className="space-y-6 pb-16 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <CheckSquare className="w-7 h-7 text-brand-400" />
            <span>Task & SLA Management</span>
          </h1>
          <p className="text-sm text-surface-400 mt-1">
            Track follow-ups, quotes, and automated SLA reminders. Overdue tasks appear at the top.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-lg shadow-lg shadow-brand-600/20 transition-all flex items-center justify-center gap-2 text-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create Task</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-surface-900 border border-surface-800 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-surface-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            Status:
          </span>
          {(['all', 'pending', 'in_progress', 'completed'] as const).map((st) => {
            const isActive = statusFilter === st;
            const label = st === 'all' ? 'All Statuses' : st.replace('_', ' ');
            return (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-surface-800 text-surface-400 hover:text-surface-200 hover:bg-surface-750'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Priority Dropdown */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-surface-400 shrink-0">Priority:</span>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as any)}
            className="w-full sm:w-40 px-3 py-1.5 bg-surface-950 border border-surface-700 rounded-lg text-xs text-surface-200 focus:outline-none focus:ring-2 focus:ring-brand-500 capitalize"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Task List */}
      <div className="bg-surface-900 border border-surface-800 rounded-xl shadow-sm overflow-hidden">
        {loading && displayedTasks.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <Spinner className="w-8 h-8 text-brand-500 mb-3" />
            <p className="text-sm text-surface-400">Loading your tasks…</p>
          </div>
        ) : displayedTasks.length === 0 ? (
          <div className="p-12">
            <EmptyState
              icon={CheckSquare}
              title="No tasks found"
              description="No action items match your current status and priority filters."
            />
          </div>
        ) : (
          <div className="divide-y divide-surface-800">
            {displayedTasks.map((task) => {
              const isCompleted = task.status === 'completed';
              const dueDate = task.dueDate ? new Date(task.dueDate) : null;
              const isOverdue = dueDate && dueDate.getTime() < Date.now() && !isCompleted && task.status !== 'cancelled';
              const leadName = task.leadId ? leadMap[task.leadId] : null;

              return (
                <div
                  key={task.id}
                  className={`p-4 sm:p-5 transition-colors flex items-start sm:items-center justify-between gap-4 ${
                    isOverdue
                      ? 'bg-red-500/10 hover:bg-red-500/15 border-l-4 border-l-red-500'
                      : isCompleted
                      ? 'bg-surface-900/40 opacity-70 hover:opacity-100 border-l-4 border-l-emerald-500/50'
                      : 'hover:bg-surface-850/50 border-l-4 border-l-transparent'
                  }`}
                >
                  {/* Left: Checkbox + Title + Meta */}
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => !isCompleted && completeTask(task.id)}
                      disabled={isCompleted}
                      className={`mt-0.5 sm:mt-0 p-1 rounded-md transition-colors shrink-0 ${
                        isCompleted
                          ? 'text-emerald-400 cursor-default'
                          : 'text-surface-500 hover:text-brand-400 hover:bg-surface-800'
                      }`}
                      title={isCompleted ? 'Completed' : 'Mark as Completed'}
                    >
                      {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span
                          className={`font-semibold text-sm ${
                            isCompleted ? 'text-surface-400 line-through' : 'text-surface-100'
                          }`}
                        >
                          {task.title}
                        </span>

                        {getPriorityBadge(task.priority)}

                        {(task as any).isAutoGenerated ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            <Bot className="w-3 h-3" />
                            <span>System / SLA</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-surface-800 text-surface-400">
                            Manual
                          </span>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-xs text-surface-400 mt-1 truncate max-w-xl">
                          {task.description}
                        </p>
                      )}

                      {/* Lead link & assignment info */}
                      <div className="flex items-center gap-4 mt-2 text-xs text-surface-400 flex-wrap">
                        {task.leadId && (
                          <Link
                            to={`/leads/${task.leadId}`}
                            className="flex items-center gap-1 text-brand-400 hover:text-brand-300 font-medium transition-colors"
                          >
                            <span>Lead: {leadName || `ID ${task.leadId}`}</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                        <span className="flex items-center gap-1 text-surface-300">
                          <User className="w-3 h-3 text-surface-500" />
                          {task.assignedTo || 'Unassigned'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Due date & status */}
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 shrink-0">
                    {dueDate ? (
                      <div
                        className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                          isOverdue
                            ? 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse'
                            : 'bg-surface-950 text-surface-300 border-surface-800'
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        <span>{isOverdue ? `Overdue: ${formatDate(dueDate)}` : `Due: ${formatDate(dueDate)}`}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-surface-500 italic">No deadline</span>
                    )}

                    {isOverdue && (
                      <span className="text-[10px] font-extrabold uppercase bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                        Overdue
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Create New Action Task"
        >
          <form onSubmit={handleCreateTask} className="p-2 space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-1.5">
                Task Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Call lead about 4-Post Lift specifications"
                className="w-full px-3 py-2 bg-surface-950 border border-surface-700 rounded-lg text-sm text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-1.5">
                Description / Notes
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add any context, phone numbers, or questions to address…"
                className="w-full px-3 py-2 bg-surface-950 border border-surface-700 rounded-lg text-sm text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-1.5">
                  Associated Lead (Optional)
                </label>
                <select
                  value={leadId}
                  onChange={(e) => setLeadId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-950 border border-surface-700 rounded-lg text-sm text-surface-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">-- None / General Task --</option>
                  {leads.map((l: Lead) => (
                    <option key={l.id} value={l.id}>
                      {l.firstName} {l.lastName} {l.company ? `(${l.company})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-1.5">
                  Priority Level
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-3 py-2 bg-surface-950 border border-surface-700 rounded-lg text-sm text-surface-200 focus:outline-none focus:ring-2 focus:ring-brand-500 capitalize"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-1.5">
                  Assigned To
                </label>
                <input
                  type="text"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  placeholder="e.g. Sales Rep / Admin"
                  className="w-full px-3 py-2 bg-surface-950 border border-surface-700 rounded-lg text-sm text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-1.5">
                  Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={dueDateStr}
                  onChange={(e) => setDueDateStr(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-950 border border-surface-700 rounded-lg text-sm text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
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
                {submitting ? 'Creating…' : 'Create Task'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
