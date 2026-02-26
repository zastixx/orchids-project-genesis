'use client';

import { useState, useEffect } from 'react';
import { listenToPath } from '@/lib/firebaseHelpers';

interface UseRealtimeDataReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useRealtimeData<T>(path: string): UseRealtimeDataReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) return;
    setLoading(true);
    try {
      const unsubscribe = listenToPath(path, (value) => {
        setData(value as T);
        setLoading(false);
        setError(null);
      });
      return unsubscribe;
    } catch (err) {
      setError('Failed to load data');
      setLoading(false);
    }
  }, [path]);

  return { data, loading, error };
}
