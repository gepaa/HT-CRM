// ─────────────────────────────────────────────────────────────
// useLeadDetail – Single lead with subcollections (composed)
// ─────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import type { Lead, LeadStage } from '../types/lead';
import type { LeadEvent, LeadNote, Task } from '../types/crm';
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
}

export function useLeadDetail(leadId: string | undefined): UseLeadDetailResult {
  const {
    lead,
    loading: leadLoading,
    error: leadError,
    updateLead,
    updateLeadStage,
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
  } = useLeadTasks(leadId);

  const loading = leadLoading || eventsLoading || notesLoading || tasksLoading;

  const addNote = async (content: string) => {
    await addNoteRaw(content);
  };

  const addEventWrapped = async (
    type: LeadEvent['type'],
    description: string,
    metadata?: Record<string, unknown>
  ) => {
    await addEvent(type, description, metadata);
  };

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
    }),
    [lead, events, notes, tasks, loading, leadError, updateLead, updateLeadStage, addNoteRaw, addEvent]
  );
}
