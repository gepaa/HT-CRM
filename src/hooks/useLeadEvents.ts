// ─────────────────────────────────────────────────────────────
// useLeadEvents – Timeline events for a lead
// ─────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import type { LeadEvent } from '../types/crm';
import { eventService } from '../services/eventService';

interface UseLeadEventsResult {
  events: LeadEvent[];
  loading: boolean;
  error: Error | null;
  addEvent: (
    type: LeadEvent['type'],
    description: string,
    metadata?: Record<string, unknown>
  ) => Promise<string>;
}

export function useLeadEvents(leadId?: string): UseLeadEventsResult {
  const { user } = useAuth();
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!leadId) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = eventService.subscribeLeadEvents(
      leadId,
      (docs) => {
        setEvents(docs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [leadId]);

  const addEvent = useCallback(
    async (
      type: LeadEvent['type'],
      description: string,
      metadata?: Record<string, unknown>
    ): Promise<string> => {
      if (!leadId) throw new Error('Lead ID required');
      return eventService.addLeadEvent(leadId, type, description, metadata, user || { uid: 'user' });
    },
    [leadId, user]
  );

  return { events, loading, error, addEvent };
}
