// ─────────────────────────────────────────────────────────────
// useDeals – Real-time deals hook with mutations
// ─────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import type { Deal, DealStage } from '../types/crm';
import { dealService } from '../services/dealService';

interface UseDealsResult {
  deals: Deal[];
  loading: boolean;
  error: Error | null;
  createDeal: (data: {
    title: string;
    leadId: string;
    contactName: string;
    value: number;
    stage?: DealStage;
    expectedCloseDate?: Date | null;
    notes?: string;
  }) => Promise<string>;
  updateDeal: (dealId: string, data: Partial<Deal>) => Promise<void>;
  moveDeal: (dealId: string, newStage: DealStage) => Promise<void>;
  updateDealStage: (dealId: string, newStage: DealStage) => Promise<void>;
}

export function useDeals(): UseDealsResult {
  const { user } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);

    const unsubscribe = dealService.subscribeDeals(
      (docs) => {
        setDeals(docs);
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

  const createDeal = useCallback(
    async (data: {
      title: string;
      leadId: string;
      contactName: string;
      value: number;
      stage?: DealStage;
      expectedCloseDate?: Date | null;
      notes?: string;
    }): Promise<string> => {
      if (!user) throw new Error('Must be authenticated');
      return dealService.createDeal({
        ...data,
        assignedTo: user.uid,
      });
    },
    [user]
  );

  const updateDeal = useCallback(
    async (dealId: string, data: Partial<Deal>) => {
      await dealService.updateDeal(dealId, data);
    },
    []
  );

  const moveDeal = useCallback(
    async (dealId: string, newStage: DealStage) => {
      await dealService.updateDealStage(dealId, newStage);
    },
    []
  );

  const updateDealStage = useCallback(
    async (dealId: string, newStage: DealStage) => {
      await dealService.updateDealStage(dealId, newStage);
    },
    []
  );

  return { deals, loading, error, createDeal, updateDeal, moveDeal, updateDealStage };
}
