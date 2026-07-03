// ─────────────────────────────────────────────────────────────
// useLeadDetail – Single lead with subcollections (composed)
// ─────────────────────────────────────────────────────────────
import { useCallback, useMemo } from 'react';
import type { Lead, LeadStage } from '../types/lead';
import type { LeadEvent, LeadNote, Task, TaskPriority, TaskStatus } from '../types/crm';
import { useLead } from './useLead';
import { useLeadEvents } from './useLeadEvents';
import { useLeadNotes } from './useLeadNotes';
import { useLeadTasks } from './useLeadTasks';

interface UseLeadDetailResult {
  lead: Lead | null;
  events: LeadEvent[];
  notes: LeadNote[];
  tasks: Task[];
  loading: boolean;
  error: Error | null;
  updateLead: (data: Partial<Lead>) => Promise<void>;
  addNote: (content: string) => Promise<void>;
  addEvent: (
    type: LeadEvent['type'],
    description: string,
    metadata?: Record<string, unknown>
  ) => Promise<void>;
  updateStage: (newStage: LeadStage) => Promise<void>;
  markLeadContacted: () => Promise<void>;
  markQuoteSent: () => Promise<void>;
  markLeadWon: (wonRevenue?: number) => Promise<void>;
  markLeadLost: (lostReason?: string) => Promise<void>;
  createTask: (data: {
    title: string;
    description?: string;
    assignedTo: string;
    priority: TaskPriority;
    dueDate?: Date | null;
  }) => Promise<string>;
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;
}

export function useLeadDetail(leadId: string | undefined): UseLeadDetailResult {
  const {
    lead,
    loading: leadLoading,
    error: leadError,
    updateLead,
    updateLeadStage,
    markLeadContacted,
    markQuoteSent,
    markLeadWon,
    markLeadLost,
  } = useLead(leadId);

  const {
    events,
    loading: eventsLoading,
    addEvent,
  } = useLeadEvents(leadId);

  const {
    notes,
    loading: notesLoading,
    addNote: addNoteRaw,
  } = useLeadNotes(leadId);

  const {
    tasks,
    loading: tasksLoading,
    createTask,
    updateTaskStatus,
  } = useLeadTasks(leadId);

  const loading = leadLoading || eventsLoading || notesLoading || tasksLoading;

  const addNote = useCallback(async (content: string) => {
    await addNoteRaw(content);
  }, [addNoteRaw]);

  const addEventWrapped = useCallback(async (
    type: LeadEvent['type'],
    description: string,
    metadata?: Record<string, unknown>
  ) => {
    await addEvent(type, description, metadata);
  }, [addEvent]);

  return useMemo(
    () => ({
      lead,
      events,
      notes,
      tasks,
      loading,
      error: leadError,
      updateLead,
      addNote,
      addEvent: addEventWrapped,
      updateStage: updateLeadStage,
      markLeadContacted,
      markQuoteSent,
      markLeadWon,
      markLeadLost,
      createTask,
      updateTaskStatus,
    }),
    [lead, events, notes, tasks, loading, leadError, updateLead, updateLeadStage, markLeadContacted, markQuoteSent, markLeadWon, markLeadLost, addNote, addEventWrapped, createTask, updateTaskStatus]
  );
}
