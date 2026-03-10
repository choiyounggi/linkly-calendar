import { useCallback, useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface CoupleMemberInfo {
  memberId: string;
  userId: string;
  nickname: string;
  displayName: string;
  birthday: string | null;
  homeAddress: string | null;
  role: string;
  isMe: boolean;
}

export interface CoupleInfo {
  id: string;
  status: string;
  anniversaryDate: string | null;
  createdAt: string;
  members: CoupleMemberInfo[];
}

export function useCouple(coupleId: string, userId: string) {
  const [couple, setCouple] = useState<CoupleInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCouple = useCallback(async () => {
    if (!coupleId || !userId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/v1/couples/${coupleId}?userId=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch couple');
      const data = (await res.json()) as CoupleInfo;
      setCouple(data);
    } catch (error) {
      console.error('Failed to fetch couple:', error);
    } finally {
      setLoading(false);
    }
  }, [coupleId, userId]);

  useEffect(() => {
    fetchCouple();
  }, [fetchCouple]);

  const updateCouple = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/v1/couples/${coupleId}?userId=${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Failed to update couple');
    const updated = (await res.json()) as CoupleInfo;
    setCouple(updated);
    return updated;
  }, [coupleId, userId]);

  const breakUp = useCallback(async () => {
    const res = await fetch(`${API_URL}/v1/couples/${coupleId}?userId=${userId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to break up');
    setCouple(null);
  }, [coupleId, userId]);

  return { couple, loading, updateCouple, breakUp, refetch: fetchCouple };
}
