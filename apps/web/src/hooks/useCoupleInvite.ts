import { useCallback, useEffect, useState } from 'react';
import { authFetch } from '../lib/api';

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

export function useCoupleInvite() {
  const [sentInvite, setSentInvite] = useState<SentInvite | null>(null);
  const [receivedInvites, setReceivedInvites] = useState<ReceivedInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvites = useCallback(async () => {
    try {
      const [sentRes, receivedRes] = await Promise.all([
        authFetch('/v1/couples/invites/sent'),
        authFetch('/v1/couples/invites/received'),
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
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchInvites();
      setLoading(false);
    })();
  }, [fetchInvites]);

  const sendInvite = useCallback(async (inviteeEmail: string) => {
    const res = await authFetch('/v1/couples/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteeEmail }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message ?? 'Failed to send invite');
    }
    const data = (await res.json()) as SentInvite;
    setSentInvite(data);
    return data;
  }, []);

  const cancelInvite = useCallback(async () => {
    const res = await authFetch('/v1/couples/invites/sent', {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to cancel');
    setSentInvite(null);
  }, []);

  const acceptInvite = useCallback(async (inviteId: string) => {
    const res = await authFetch(`/v1/couples/invites/${inviteId}/accept`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to accept');
    const data = await res.json();
    return data as { coupleId: string };
  }, []);

  const declineInvite = useCallback(async (inviteId: string) => {
    const res = await authFetch(`/v1/couples/invites/${inviteId}/decline`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to decline');
    setReceivedInvites((prev) => prev.filter((i) => i.id !== inviteId));
  }, []);

  const searchUser = useCallback(async (email: string) => {
    const res = await authFetch(`/v1/users/search?email=${encodeURIComponent(email)}`);
    if (!res.ok) throw new Error('Search failed');
    return (await res.json()) as { found: boolean; user: InviteUser | null };
  }, []);

  return {
    sentInvite,
    receivedInvites,
    loading,
    sendInvite,
    cancelInvite,
    acceptInvite,
    declineInvite,
    searchUser,
    refetch: fetchInvites,
  };
}
