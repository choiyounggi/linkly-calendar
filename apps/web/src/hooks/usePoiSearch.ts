import { useCallback, useRef, useState } from 'react';

export interface PoiResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const DEBOUNCE_MS = 300;

export function usePoiSearch() {
  const [results, setResults] = useState<PoiResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback((keyword: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();

    if (!keyword.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const params = new URLSearchParams({ keyword: keyword.trim() });
        const res = await fetch(`${API_URL}/v1/transit/poi/search?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('POI search failed');
        const data = (await res.json()) as { results: PoiResult[] };
        setResults(data.results);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();
    setResults([]);
    setLoading(false);
  }, []);

  return { results, loading, search, clear };
}
