import { useCallback, useEffect, useState } from 'react';
import { authFetch } from '../lib/api';

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

export function useCouple(coupleId: string) {
  const [couple, setCouple] = useState<CoupleInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCouple = useCallback(async () => {
    if (!coupleId) return;
    setLoading(true);
    try {
      const res = await authFetch(`/v1/couples/${coupleId}`);
      if (!res.ok) throw new Error('Failed to fetch couple');
      const data = (await res.json()) as CoupleInfo;
      setCouple(data);
    } catch (error) {
      console.error('Failed to fetch couple:', error);
    } finally {
      setLoading(false);
    }
  }, [coupleId]);

  useEffect(() => {
    fetchCouple();
  }, [fetchCouple]);

  const updateCouple = useCallback(async (body: Record<string, unknown>) => {
    const res = await authFetch(`/v1/couples/${coupleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Failed to update couple');
    const updated = (await res.json()) as CoupleInfo;
    setCouple(updated);
    return updated;
  }, [coupleId]);

  const breakUp = useCallback(async () => {
    const res = await authFetch(`/v1/couples/${coupleId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to break up');
    setCouple(null);
  }, [coupleId]);

  return { couple, loading, updateCouple, breakUp, refetch: fetchCouple };
}
