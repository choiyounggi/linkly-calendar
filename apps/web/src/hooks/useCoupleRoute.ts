import { useCallback, useEffect, useState } from 'react';
import { authFetch } from '../lib/api';

export interface CoupleRouteData {
  type: 'meetup' | 'individual';
  meetupStation?: { name: string; lat: number; lng: number };
  myRoute: {
    departureTime: string;
    totalTime: number;
    transferCount: number;
    legs: unknown[];
  };
  partnerDepartureTime?: string;
  noOverlapReason?: string;
  cachedAt: string;
}

export function useCoupleRoute(eventId: string | null) {
  const [route, setRoute] = useState<CoupleRouteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRoute = useCallback(async (forceRefresh = false) => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { eventId };
      if (forceRefresh) body.forceRefresh = true;
      const res = await authFetch('/v1/transit/couple-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(errData.message ?? 'Route analysis failed');
      }
      const data = (await res.json()) as CoupleRouteData;
      setRoute(data);
    } catch (err) {
      setError((err as Error).message);
      setRoute(null);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) fetchRoute();
  }, [eventId, fetchRoute]);

  return { route, loading, error, refresh: () => fetchRoute(true) };
}
