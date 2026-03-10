import { useCallback, useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface InviteUser {
  id: string;
  displayName: string;
  email: string | null;
}

export interface SentInvite {
  id: string;
  inviteeEmail: string | null;
  invitee: InviteUser | null;
  status: string;
  createdAt: string;
}

export interface ReceivedInvite {
  id: string;
  inviter: InviteUser;
  status: string;
  createdAt: string;
}

export interface UserStatus {
  userId: string;
  hasCouple: boolean;
  coupleId: string | null;
  hasHomeAddress: boolean;
}

export function useCoupleInvite(userId: string) {
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [sentInvite, setSentInvite] = useState<SentInvite | null>(null);
  const [receivedInvites, setReceivedInvites] = useState<ReceivedInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_URL}/v1/users/me/status?userId=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch status');
      const data = (await res.json()) as UserStatus;
      setStatus(data);
      return data;
    } catch (error) {
      console.error('Failed to fetch status:', error);
      return null;
    }
  }, [userId]);

  const fetchInvites = useCallback(async () => {
    if (!userId) return;
    try {
      const [sentRes, receivedRes] = await Promise.all([
        fetch(`${API_URL}/v1/couples/invites/sent?userId=${userId}`),
        fetch(`${API_URL}/v1/couples/invites/received?userId=${userId}`),
      ]);
      if (sentRes.ok) {
        const data = await sentRes.json();
        setSentInvite(data as SentInvite | null);
      }
      if (receivedRes.ok) {
        const data = await receivedRes.json();
        setReceivedInvites(data as ReceivedInvite[]);
      }
    } catch (error) {
      console.error('Failed to fetch invites:', error);
    }
  }, [userId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchStatus();
      await fetchInvites();
      setLoading(false);
    })();
  }, [fetchStatus, fetchInvites]);

  const sendInvite = useCallback(async (inviteeEmail: string) => {
    const res = await fetch(`${API_URL}/v1/couples/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, inviteeEmail }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message ?? 'Failed to send invite');
    }
    const data = (await res.json()) as SentInvite;
    setSentInvite(data);
    return data;
  }, [userId]);

  const cancelInvite = useCallback(async () => {
    const res = await fetch(`${API_URL}/v1/couples/invites/sent?userId=${userId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to cancel');
    setSentInvite(null);
  }, [userId]);

  const acceptInvite = useCallback(async (inviteId: string) => {
    const res = await fetch(`${API_URL}/v1/couples/invites/${inviteId}/accept?userId=${userId}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to accept');
    const data = await res.json();
    await fetchStatus();
    return data as { coupleId: string };
  }, [userId, fetchStatus]);

  const declineInvite = useCallback(async (inviteId: string) => {
    const res = await fetch(`${API_URL}/v1/couples/invites/${inviteId}/decline?userId=${userId}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to decline');
    setReceivedInvites((prev) => prev.filter((i) => i.id !== inviteId));
  }, [userId]);

  const searchUser = useCallback(async (email: string) => {
    const res = await fetch(`${API_URL}/v1/users/search?email=${encodeURIComponent(email)}`);
    if (!res.ok) throw new Error('Search failed');
    return (await res.json()) as { found: boolean; user: InviteUser | null };
  }, []);

  const refetch = useCallback(async () => {
    await fetchStatus();
    await fetchInvites();
  }, [fetchStatus, fetchInvites]);

  return {
    status,
    sentInvite,
    receivedInvites,
    loading,
    sendInvite,
    cancelInvite,
    acceptInvite,
    declineInvite,
    searchUser,
    refetch,
  };
}
