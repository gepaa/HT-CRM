// ─────────────────────────────────────────────────────────────
// useRealtimeCollection – Generic Firestore real-time hook
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import {
  onSnapshot,
  type Query,
  type DocumentData,
  type FirestoreError,
} from 'firebase/firestore';

interface UseRealtimeCollectionResult<T> {
  data: T[];
  loading: boolean;
  error: FirestoreError | null;
}

/**
 * Subscribes to a Firestore query in real-time.
 *
 * @param query - A Firestore Query instance. Pass `null` to skip subscription.
 * @param mapper - Optional transform applied to each document snapshot.
 *                 Receives `(data, docId)` and should return `T`.
 */
export function useRealtimeCollection<T = DocumentData>(
  query: Query<DocumentData> | null,
  mapper?: (data: DocumentData, id: string) => T
): UseRealtimeCollectionResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    if (!query) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        const docs = snapshot.docs.map((docSnap) => {
          const raw = docSnap.data();
          if (mapper) {
            return mapper(raw, docSnap.id);
          }
          return { ...raw, id: docSnap.id } as unknown as T;
        });
        setData(docs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('useRealtimeCollection error:', err);
        setError(err);
        setLoading(false);
      }
    );

    return unsubscribe;
    // We serialize the query reference path to detect meaningful changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return { data, loading, error };
}
