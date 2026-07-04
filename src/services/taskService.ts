// ─────────────────────────────────────────────────────────────
// Task Service – Garage Auto Supplies CRM (Supabase)
// ─────────────────────────────────────────────────────────────
import { supabase } from '../config/supabase';
import type { Task, TaskStatus, TaskPriority } from '../types/crm';

const TASKS_TABLE = 'tasks';

function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function normalizeTask(raw: Record<string, any>, docId: string): Task & { dueAt: Date | null } {
  const id = docId || raw.id || 'unknown';
  const createdAt = toDate(raw.created_at || raw.createdAt) ?? new Date();
  const updatedAt = toDate(raw.updated_at || raw.updatedAt) ?? new Date();
  const dueDate = toDate(raw.due_date || raw.dueDate) ?? toDate(raw.due_at || raw.dueAt);
  const completedAt = toDate(raw.completed_at || raw.completedAt);
  const rawPriority = raw.priority || 'normal';
  const priority = rawPriority === 'medium' ? 'normal' : rawPriority;

  return {
    ...raw,
    id,
    title: raw.title || 'Untitled Task',
    description: raw.description || '',
    leadId: raw.lead_id || raw.leadId || undefined,
    assignedTo: raw.assigned_to || raw.assignedTo || 'Unassigned',
    assignedBy: raw.assigned_by || raw.assignedBy || 'system',
    status: raw.status || 'pending',
    priority,
    dueDate,
    dueAt: dueDate,
    completedAt,
    createdAt,
    updatedAt,
  } as Task & { dueAt: Date | null };
}

function toSupabaseTask(task: Record<string, any>): Record<string, any> {
  const data: Record<string, any> = {};
  if (task.id !== undefined) data.id = task.id;
  if (task.title !== undefined) data.title = task.title;
  if (task.description !== undefined) data.description = task.description;
  if (task.leadId !== undefined) data.lead_id = task.leadId;
  if (task.assignedTo !== undefined) data.assigned_to = task.assignedTo;
  if (task.assignedBy !== undefined) data.assigned_by = task.assignedBy;
  if (task.status !== undefined) data.status = task.status;
  if (task.priority !== undefined) data.priority = task.priority === 'normal' ? 'medium' : task.priority;
  if (task.dueDate !== undefined || task.dueAt !== undefined) {
    const d = task.dueDate !== undefined ? task.dueDate : task.dueAt;
    data.due_date = d instanceof Date ? d.toISOString() : d;
    data.due_at = data.due_date;
  }
  if (task.completedAt !== undefined) {
    data.completed_at = task.completedAt instanceof Date ? task.completedAt.toISOString() : task.completedAt;
  }
  return data;
}

export const taskService = {
  /**
   * Subscribe to all tasks, optionally filtered.
   */
  subscribeTasks(
    onData: (tasks: (Task & { dueAt: Date | null })[]) => void,
    onError?: (error: any) => void,
    filters?: { status?: TaskStatus; priority?: TaskPriority; assignedTo?: string; leadId?: string }
  ): () => void {
    const fetchAndNotify = async () => {
      try {
        let query = supabase.from(TASKS_TABLE).select('*').order('created_at', { ascending: false });

        if (filters?.status) query = query.eq('status', filters.status);
        if (filters?.priority) {
          const p = filters.priority === 'normal' ? 'medium' : filters.priority;
          query = query.eq('priority', p);
        }
        if (filters?.assignedTo) query = query.eq('assigned_to', filters.assignedTo);
        if (filters?.leadId) query = query.eq('lead_id', filters.leadId);

        const { data, error } = await query;
        if (error) throw error;

        const docs = (data || []).map((d) => normalizeTask(d, d.id));
        onData(docs);
      } catch (err: any) {
        if (onError) onError(err);
      }
    };

    fetchAndNotify();

    const channel = supabase
      .channel('table-tasks-all')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TASKS_TABLE },
        () => {
          fetchAndNotify();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Subscribe to tasks for a specific lead.
   */
  subscribeLeadTasks(
    leadId: string,
    onData: (tasks: (Task & { dueAt: Date | null })[]) => void,
    onError?: (error: any) => void
  ): () => void {
    if (!leadId) {
      onData([]);
      return () => {};
    }

    const fetchAndNotify = async () => {
      try {
        const { data, error } = await supabase
          .from(TASKS_TABLE)
          .select('*')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        const docs = (data || []).map((d) => normalizeTask(d, d.id));
        onData(docs);
      } catch (err: any) {
        if (onError) onError(err);
      }
    };

    fetchAndNotify();

    const channel = supabase
      .channel(`table-tasks-lead-${leadId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TASKS_TABLE, filter: `lead_id=eq.${leadId}` },
        () => {
          fetchAndNotify();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Create a new task.
   */
  async createTask(data: {
    title: string;
    description?: string;
    leadId?: string;
    assignedTo: string;
    priority: TaskPriority;
    dueDate?: Date | null;
    assignedBy?: string;
  }): Promise<string> {
    const id = `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();

    const row = toSupabaseTask({
      id,
      ...data,
      assignedBy: data.assignedBy || 'system',
      status: 'pending',
      priority: String(data.priority) === 'medium' ? 'normal' : data.priority,
      dueDate: data.dueDate ?? null,
      dueAt: data.dueDate ?? null,
      completedAt: null,
    });

    row.created_at = now;
    row.updated_at = now;

    const { error } = await supabase.from(TASKS_TABLE).insert(row);
    if (error) {
      console.error('Failed to create task:', error);
      throw error;
    }
    return id;
  },

  /**
   * Safe doc updater for tasks.
   */
  async safeUpdate(taskId: string, updates: Record<string, any>): Promise<void> {
    const row = toSupabaseTask(updates);
    row.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from(TASKS_TABLE)
      .update(row)
      .eq('id', taskId);

    if (error) {
      console.error(`safeUpdate task ${taskId} failed:`, error);
      throw error;
    }
  },

  /**
   * Update task status.
   */
  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
    const updates: Record<string, any> = { status };
    if (status === 'completed') {
      updates.completedAt = new Date();
    } else {
      updates.completedAt = null;
    }
    await this.safeUpdate(taskId, updates);
  },

  /**
   * Mark task completed.
   */
  async completeTask(taskId: string): Promise<void> {
    await this.updateTaskStatus(taskId, 'completed');
  },
};
