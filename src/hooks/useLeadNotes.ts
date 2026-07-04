// ─────────────────────────────────────────────────────────────
// useLeadNotes – Notes for a specific lead
// ─────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import type { LeadNote } from '../types/crm';
import { noteService } from '../services/noteService';

interface UseLeadNotesResult {
  notes: LeadNote[];
  loading: boolean;
  error: Error | null;
  addNote: (content: string) => Promise<string>;
}

export function useLeadNotes(leadId?: string): UseLeadNotesResult {
  const { user, crmUser } = useAuth();
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!leadId) {
      setNotes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = noteService.subscribeLeadNotes(
      leadId,
      (docs) => {
        setNotes(docs);
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

  const addNote = useCallback(
    async (content: string): Promise<string> => {
      if (!leadId) throw new Error('Lead ID required');
      return noteService.addLeadNote(leadId, content, {
        uid: user?.id || (user as any)?.uid || 'user',
        displayName: crmUser?.displayName || user?.email || 'Sales Rep',
        email: user?.email,
      });
    },
    [leadId, user, crmUser]
  );

  return { notes, loading, error, addNote };
}
