// ─────────────────────────────────────────────────────────────
// useLeads – Real-time leads hook with filtering & mutations
// ─────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState, useCallback } from 'react';
import type { Lead, LeadTier, LeadStage } from '../types/lead';
import { leadService } from '../services/leadService';

interface LeadFilters {
  tier?: LeadTier;
  stage?: LeadStage;
  search?: string;
}

interface UseLeadsResult {
  leads: Lead[];
  loading: boolean;
  error: Error | null;
  createLead: (data: any) => Promise<string>;
  updateLeadStage: (leadId: string, newStage: LeadStage, oldStage?: string) => Promise<void>;
  markLeadContacted: (leadId: string) => Promise<void>;
  markQuoteSent: (leadId: string) => Promise<void>;
  markLeadWon: (leadId: string, wonRevenue?: number) => Promise<void>;
  markLeadLost: (leadId: string, lostReason?: string) => Promise<void>;
  updateLeadAI: (leadId: string, aiSummary: string, aiNextAction: string) => Promise<void>;
}

export function useLeads(filters?: LeadFilters): UseLeadsResult {
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = leadService.subscribeLeads(
      (docs) => {
        setAllLeads(docs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const leads = useMemo(() => {
    let docs = allLeads;
    if (filters?.tier) {
      docs = docs.filter((l) => l.tier === filters.tier);
    }
    if (filters?.stage) {
      docs = docs.filter((l) => l.stage === filters.stage);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      docs = docs.filter(
        (l) =>
          (l.firstName && l.firstName.toLowerCase().includes(q)) ||
          (l.lastName && l.lastName.toLowerCase().includes(q)) ||
          (l.email && l.email.toLowerCase().includes(q)) ||
          (l.company && l.company.toLowerCase().includes(q)) ||
          (l.productCategory && l.productCategory.toLowerCase().includes(q))
      );
    }
    return docs;
  }, [allLeads, filters?.tier, filters?.stage, filters?.search]);

  const createLead = useCallback(async (data: any) => {
    return leadService.createLead(data);
  }, []);

  const updateLeadStage = useCallback(async (leadId: string, newStage: LeadStage, oldStage?: string) => {
    return leadService.updateLeadStage(leadId, newStage, oldStage);
  }, []);

  const markLeadContacted = useCallback(async (leadId: string) => {
    return leadService.markLeadContacted(leadId);
  }, []);

  const markQuoteSent = useCallback(async (leadId: string) => {
    return leadService.markQuoteSent(leadId);
  }, []);

  const markLeadWon = useCallback(async (leadId: string, wonRevenue?: number) => {
    return leadService.markLeadWon(leadId, wonRevenue);
  }, []);

  const markLeadLost = useCallback(async (leadId: string, lostReason?: string) => {
    return leadService.markLeadLost(leadId, lostReason);
  }, []);

  const updateLeadAI = useCallback(async (leadId: string, aiSummary: string, aiNextAction: string) => {
    return leadService.updateLeadAI(leadId, aiSummary, aiNextAction);
  }, []);

  return {
    leads,
    loading,
    error,
    createLead,
    updateLeadStage,
    markLeadContacted,
    markQuoteSent,
    markLeadWon,
    markLeadLost,
    updateLeadAI,
  };
}
