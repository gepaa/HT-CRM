// ─────────────────────────────────────────────────────────────
// useLead – Single lead real-time hook
// ─────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react';
import type { Lead, LeadStage } from '../types/lead';
import { leadService } from '../services/leadService';

interface UseLeadResult {
  lead: Lead | null;
  loading: boolean;
  error: Error | null;
  updateLeadStage: (newStage: LeadStage) => Promise<void>;
  markLeadContacted: () => Promise<void>;
  markQuoteSent: () => Promise<void>;
  markLeadWon: (wonRevenue?: number) => Promise<void>;
  markLeadLost: (lostReason?: string) => Promise<void>;
  updateLead: (updates: Partial<Lead>) => Promise<void>;
}

export function useLead(leadId?: string): UseLeadResult {
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!leadId) {
      setLead(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = leadService.subscribeLead(
      leadId,
      (doc) => {
        setLead(doc);
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

  const updateLeadStage = useCallback(
    async (newStage: LeadStage) => {
      if (!leadId || !lead) return;
      await leadService.updateLeadStage(leadId, newStage, lead.stage);
    },
    [leadId, lead]
  );

  const markLeadContacted = useCallback(async () => {
    if (!leadId) return;
    await leadService.markLeadContacted(leadId);
  }, [leadId]);

  const markQuoteSent = useCallback(async () => {
    if (!leadId) return;
    await leadService.markQuoteSent(leadId);
  }, [leadId]);

  const markLeadWon = useCallback(
    async (wonRevenue?: number) => {
      if (!leadId) return;
      await leadService.markLeadWon(leadId, wonRevenue);
    },
    [leadId]
  );

  const markLeadLost = useCallback(
    async (lostReason?: string) => {
      if (!leadId) return;
      await leadService.markLeadLost(leadId, lostReason);
    },
    [leadId]
  );

  const updateLead = useCallback(
    async (updates: Partial<Lead>) => {
      if (!leadId) return;
      await leadService.safeUpdate(leadId, updates);
    },
    [leadId]
  );

  return {
    lead,
    loading,
    error,
    updateLeadStage,
    markLeadContacted,
    markQuoteSent,
    markLeadWon,
    markLeadLost,
    updateLead,
  };
}
