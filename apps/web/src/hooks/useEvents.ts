import { useCallback, useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

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

export function useEvents(coupleId: string, userId: string) {
  const [events, setEvents] = useState<CalendarEventData[]>([]);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const fetchEvents = useCallback(async (month: string) => {
    if (!coupleId || !userId) return;
    try {
      const params = new URLSearchParams({ coupleId, userId, month });
      const res = await fetch(`${API_URL}/v1/events?${params}`);
      if (!res.ok) throw new Error('Failed to fetch events');
      const data = (await res.json()) as CalendarEventData[];
      setEvents(data);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    }
  }, [coupleId, userId]);

  useEffect(() => {
    if (coupleId && userId) fetchEvents(currentMonth);
  }, [coupleId, userId, currentMonth, fetchEvents]);

  const createEvent = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/v1/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, coupleId, createdByUserId: userId }),
    });
    if (!res.ok) throw new Error('Failed to create event');
    const created = (await res.json()) as CalendarEventData;
    setEvents((prev) => [...prev, created]);
    return created;
  }, [coupleId, userId]);

  const updateEvent = useCallback(async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/v1/events/${id}?userId=${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Failed to update event');
    const updated = (await res.json()) as CalendarEventData;
    setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)));
    return updated;
  }, [userId]);

  const deleteEvent = useCallback(async (id: string) => {
    const res = await fetch(`${API_URL}/v1/events/${id}?userId=${userId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete event');
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, [userId]);

  return { events, currentMonth, setCurrentMonth, createEvent, updateEvent, deleteEvent, refetch: () => fetchEvents(currentMonth) };
}
