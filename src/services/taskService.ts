// ─────────────────────────────────────────────────────────────
// Task Service – Garage Auto Supplies CRM
// ─────────────────────────────────────────────────────────────
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  serverTimestamp,
  type Unsubscribe,
  type FirestoreError,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Task, TaskStatus, TaskPriority } from '../types/crm';

const TASKS_COLLECTION = 'tasks';

function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'object' && 'toDate' in val && typeof (val as Timestamp).toDate === 'function') {
    return (val as Timestamp).toDate();
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function normalizeTask(raw: Record<string, any>, docId: string): Task & { dueAt: Date | null } {
  const id = docId || raw.id || 'unknown';
  const createdAt = toDate(raw.createdAt) ?? new Date();
  const updatedAt = toDate(raw.updatedAt) ?? new Date();
  const dueDate = toDate(raw.dueDate) ?? toDate(raw.dueAt);
  const completedAt = toDate(raw.completedAt);
  const priority = raw.priority === 'medium' ? 'normal' : (raw.priority || 'normal');

  return {
    ...raw,
    id,
    title: raw.title || 'Untitled Task',
    description: raw.description || '',
    leadId: raw.leadId || undefined,
    assignedTo: raw.assignedTo || 'Unassigned',
    assignedBy: raw.assignedBy || 'system',
    status: raw.status || 'pending',
    priority,
    dueDate,
    dueAt: dueDate,
    completedAt,
    createdAt,
    updatedAt,
  } as Task & { dueAt: Date | null };
}

export const taskService = {
  /**
   * Subscribe to all tasks, optionally filtered.
   */
  subscribeTasks(
    onData: (tasks: (Task & { dueAt: Date | null })[]) => void,
    onError?: (error: FirestoreError) => void,
    filters?: { status?: TaskStatus; priority?: TaskPriority; assignedTo?: string; leadId?: string }
  ): Unsubscribe {
    const q = query(collection(db, TASKS_COLLECTION), orderBy('createdAt', 'desc'));

    return onSnapshot(
      q,
      (snapshot) => {
        let docs = snapshot.docs.map((d) => normalizeTask(d.data(), d.id));

        if (filters?.status) docs = docs.filter((t) => t.status === filters.status);
        if (filters?.priority) docs = docs.filter((t) => t.priority === filters.priority);
        if (filters?.assignedTo) docs = docs.filter((t) => t.assignedTo === filters.assignedTo);
        if (filters?.leadId) docs = docs.filter((t) => t.leadId === filters.leadId);

        onData(docs);
      },
      (err) => {
        if (onError) onError(err);
      }
    );
  },

  /**
   * Subscribe to tasks for a specific lead.
   */
  subscribeLeadTasks(
    leadId: string,
    onData: (tasks: (Task & { dueAt: Date | null })[]) => void,
    onError?: (error: FirestoreError) => void
  ): Unsubscribe {
    if (!leadId) {
      onData([]);
      return () => {};
    }

    const q = query(
      collection(db, TASKS_COLLECTION),
      where('leadId', '==', leadId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => normalizeTask(d.data(), d.id));
        onData(docs);
      },
      (err) => {
        if (onError) onError(err);
      }
    );
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
    const docRef = await addDoc(collection(db, TASKS_COLLECTION), {
      ...data,
      assignedBy: data.assignedBy || 'system',
      status: 'pending' as TaskStatus,
      priority: String(data.priority) === 'medium' ? 'normal' : data.priority,
      dueDate: data.dueDate ?? null,
      dueAt: data.dueDate ?? null,
      completedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  /**
   * Safe doc updater for tasks.
   */
  async safeUpdate(taskId: string, updates: Record<string, any>): Promise<void> {
    const docRef = doc(db, TASKS_COLLECTION, taskId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Update task status.
   */
  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
    const updates: Record<string, any> = { status };
    if (status === 'completed') {
      updates.completedAt = serverTimestamp();
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
