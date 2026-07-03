// ─────────────────────────────────────────────────────────────
// FollowUpsDueToday – War Room Open Tasks Due Today Component
// ─────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, Phone, Clock, AlertCircle, Check, User, ExternalLink } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate } from '../../lib/formatters';
import type { Task, TaskPriority } from '../../types/crm';
import type { Lead } from '../../types/lead';

export interface FollowUpsDueTodayProps {
  tasks: any[];
  leads: any[];
  onCompleteTask?: (taskId: string) => Promise<void> | void;
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; variant: 'danger' | 'warning' | 'info' | 'default'; bgClass: string; textClass: string }> = {
  urgent: { label: 'Urgent', variant: 'danger', bgClass: 'bg-red-500/20 border-red-500/40', textClass: 'text-red-400 animate-pulse' },
  high: { label: 'High', variant: 'warning', bgClass: 'bg-amber-500/20 border-amber-500/40', textClass: 'text-amber-400' },
  normal: { label: 'Normal', variant: 'info', bgClass: 'bg-blue-500/20 border-blue-500/40', textClass: 'text-blue-400' },
  low: { label: 'Low', variant: 'default', bgClass: 'bg-surface-800 border-surface-700', textClass: 'text-surface-400' },
};

function formatTimeOnly(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const maybeTimestamp = value as { toDate?: () => Date };
  if (typeof maybeTimestamp.toDate === 'function') return maybeTimestamp.toDate();
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export const FollowUpsDueToday = ({ tasks = [], leads = [], onCompleteTask }: FollowUpsDueTodayProps) => {
  const [completingIds, setCompletingIds] = useState<Record<string, boolean>>({});

  // Map leads by id for quick lookup
  const leadsMap = useMemo(() => {
    const map: Record<string, Lead> = {};
    leads.forEach((l) => {
      if (l?.id) map[l.id] = l;
    });
    return map;
  }, [leads]);

  // Filter for open tasks due today, then sort by priority and due time.
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

  const dueTodayTasks = tasks.filter((task: Task) => {
    const st = (task?.status || '').toLowerCase();
    if (st === 'completed' || st === 'cancelled' || task.completedAt) return false;
    const due = toDate(task?.dueDate || (task as any)?.dueAt)?.getTime() || 0;
    return due >= startOfToday && due <= endOfToday;
  });

  const sortedTasks = [...dueTodayTasks].sort((a: Task, b: Task) => {
    const priorityWeight: Record<string, number> = { urgent: 4, high: 3, normal: 2, medium: 2, low: 1 };
    const pA = priorityWeight[(a?.priority || 'normal') as string] || 2;
    const pB = priorityWeight[(b?.priority || 'normal') as string] || 2;
    if (pA !== pB) return pB - pA;

    const timeA = toDate(a?.dueDate || (a as any)?.dueAt)?.getTime() || Infinity;
    const timeB = toDate(b?.dueDate || (b as any)?.dueAt)?.getTime() || Infinity;
    return timeA - timeB;
  });

  const displayedTasks = sortedTasks.slice(0, 8);

  const handleComplete = async (taskId: string) => {
    if (!onCompleteTask) return;
    try {
      setCompletingIds((prev) => ({ ...prev, [taskId]: true }));
      await onCompleteTask(taskId);
    } catch (err) {
      console.error('Failed to complete task:', err);
    } finally {
      setCompletingIds((prev) => ({ ...prev, [taskId]: false }));
    }
  };

  return (
    <div className="bg-surface-900 border border-surface-800 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-surface-800 flex items-center justify-between bg-surface-900/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
            <CheckSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-surface-100 tracking-tight flex items-center gap-2">
              Follow-Ups Due Today
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-500/20 text-amber-400">
                {dueTodayTasks.length}
              </span>
            </h3>
          </div>
        </div>
        <Link
          to="/tasks"
          className="text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1"
        >
          View All Tasks
        </Link>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto max-h-[520px] divide-y divide-surface-800">
        {displayedTasks.length === 0 ? (
          <div className="p-8 my-auto">
            <EmptyState
              icon={CheckSquare}
              title="No open follow-ups due"
              description="All scheduled calls and tasks for today have been completed or none are scheduled."
            />
          </div>
        ) : (
          displayedTasks.map((task: Task) => {
            const dueDate = toDate(task?.dueDate || (task as any)?.dueAt);
            const isOverdue = dueDate && dueDate.getTime() < now.getTime() - 60_000;
            const isToday = dueDate && dueDate.toDateString() === now.toDateString();
            const pConfig = PRIORITY_CONFIG[(task?.priority || 'normal') as TaskPriority] || PRIORITY_CONFIG.normal;
            
            const lead = task?.leadId ? leadsMap[task.leadId] : null;

            return (
              <div
                key={task.id}
                className={`p-4 transition-colors flex items-start justify-between gap-3 ${
                  isOverdue ? 'bg-amber-500/5 hover:bg-amber-500/10 border-l-4 border-l-amber-500' : 'hover:bg-surface-850/50 border-l-4 border-l-transparent'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => handleComplete(task.id)}
                    disabled={completingIds[task.id] || !onCompleteTask}
                    className="mt-1 w-5 h-5 rounded border border-surface-600 hover:border-emerald-500 bg-surface-950 hover:bg-emerald-500/10 text-transparent hover:text-emerald-400 flex items-center justify-center transition-all shrink-0 disabled:opacity-50"
                    title="Mark task completed"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-surface-100 tracking-tight">
                        {task.title}
                      </span>
                      <span className={`px-1.5 py-0.5 text-[10px] uppercase font-bold rounded border ${pConfig.bgClass} ${pConfig.textClass}`}>
                        {pConfig.label}
                      </span>
                    </div>

                    {task.description && (
                      <p className="text-xs text-surface-400 mt-1 line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    {lead && (
                      <div className="mt-2.5 flex items-center gap-3 flex-wrap bg-surface-950/60 p-2 rounded-lg border border-surface-800/80">
                        <Link
                          to={`/leads/${lead.id}`}
                          className="text-xs font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1"
                        >
                          <User className="w-3 h-3" />
                          <span>{lead.firstName} {lead.lastName}</span>
                        </Link>
                        {lead.phone && (
                          <a
                            href={`tel:${lead.phone}`}
                            className="text-xs font-mono font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20"
                            title="Call Lead"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{lead.phone}</span>
                          </a>
                        )}
                        {lead.company && (
                          <span className="text-xs text-surface-400 font-medium truncate">
                            {lead.company}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mt-2 flex items-center gap-3 text-[11px] text-surface-500">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        Rep: {task.assignedTo || 'Unassigned'}
                      </span>
                      {dueDate && (
                        <span className={`flex items-center gap-1 font-medium ${isOverdue ? 'text-red-400' : isToday ? 'text-amber-400' : 'text-surface-400'}`}>
                          {isOverdue ? <AlertCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {isToday ? `Today at ${formatTimeOnly(dueDate)}` : formatDate(dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleComplete(task.id)}
                    disabled={completingIds[task.id] || !onCompleteTask}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Done</span>
                  </button>
                  {lead && (
                    <Link
                      to={`/leads/${lead.id}`}
                      className="text-[11px] text-surface-400 hover:text-white flex items-center gap-1 transition-colors"
                    >
                      <span>View Lead</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default FollowUpsDueToday;
