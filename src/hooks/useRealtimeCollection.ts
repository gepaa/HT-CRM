// ─────────────────────────────────────────────────────────────
// useSupabaseRealtime – Generic Supabase real-time table hook
// ─────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../config/supabase';

interface UseRealtimeCollectionResult<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Subscribes to a Supabase PostgreSQL table in real-time.
 *
 * @param table - The PostgreSQL table name (e.g. 'leads', 'deals'). Pass null to skip.
 * @param mapper - Optional transform applied to each database row.
 * @param orderByField - Column to sort by (default: 'created_at').
 * @param ascending - Sort direction (default: false).
 */
export function useSupabaseRealtime<T = any>(
  table: string | null,
  mapper?: (row: any, id: string) => T,
  orderByField: string = 'created_at',
  ascending: boolean = false
): UseRealtimeCollectionResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchRows = useCallback(async () => {
    if (!table) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      const { data: rows, error: queryErr } = await supabase
        .from(table)
        .select('*')
        .order(orderByField, { ascending });

      if (queryErr) throw queryErr;

      const mapped = (rows || []).map((row) => {
        if (mapper) {
          return mapper(row, row.id || row.uid);
        }
        return row as unknown as T;
      });

      setData(mapped);
      setError(null);
    } catch (err: any) {
      console.error(`useSupabaseRealtime (${table}) error:`, err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [table, mapper, orderByField, ascending]);

  useEffect(() => {
    if (!table) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchRows();

    // Subscribe to Postgres changes for this table
    const channel = supabase
      .channel(`realtime-hook-${table}-${Math.random().toString(36).substring(2, 9)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          fetchRows();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, fetchRows]);

  return { data, loading, error, refetch: fetchRows };
}

// Backward compatibility alias
export const useRealtimeCollection = useSupabaseRealtime;
