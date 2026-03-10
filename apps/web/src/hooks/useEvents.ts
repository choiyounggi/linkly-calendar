import { useCallback, useEffect, useState } from 'react';
import { authFetch } from '../lib/api';

export interface CalendarEventData {
  id: string;
  coupleId: string;
  title: string;
  placeName: string | null;
  placeAddress: string | null;
  placeLat: number | null;
  placeLng: number | null;
  appointmentAt: string | null;
  detail: string | null;
  createdByUserId: string;
}

export function useEvents(coupleId: string) {
  const [events, setEvents] = useState<CalendarEventData[]>([]);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const fetchEvents = useCallback(async (month: string) => {
    if (!coupleId) return;
    try {
      const params = new URLSearchParams({ coupleId, month });
      const res = await authFetch(`/v1/events?${params}`);
      if (!res.ok) throw new Error('Failed to fetch events');
      const data = (await res.json()) as CalendarEventData[];
      setEvents(data);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    }
  }, [coupleId]);

  useEffect(() => {
    if (coupleId) fetchEvents(currentMonth);
  }, [coupleId, currentMonth, fetchEvents]);

  const createEvent = useCallback(async (body: Record<string, unknown>) => {
    const res = await authFetch('/v1/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, coupleId }),
    });
    if (!res.ok) throw new Error('Failed to create event');
    const created = (await res.json()) as CalendarEventData;
    setEvents((prev) => [...prev, created]);
    return created;
  }, [coupleId]);

  const updateEvent = useCallback(async (id: string, body: Record<string, unknown>) => {
    const res = await authFetch(`/v1/events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Failed to update event');
    const updated = (await res.json()) as CalendarEventData;
    setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)));
    return updated;
  }, []);

  const deleteEvent = useCallback(async (id: string) => {
    const res = await authFetch(`/v1/events/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete event');
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return { events, currentMonth, setCurrentMonth, createEvent, updateEvent, deleteEvent, refetch: () => fetchEvents(currentMonth) };
}
