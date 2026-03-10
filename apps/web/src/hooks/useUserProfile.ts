import { useCallback, useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface UserProfile {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  birthday: string | null;
  homeLat: number | null;
  homeLng: number | null;
  homeAddress: string | null;
  homeUpdatedAt: string | null;
}

export function useUserProfile(userId: string) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/v1/users/me?userId=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch profile');
      const data = (await res.json()) as UserProfile;
      setProfile(data);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/v1/users/me?userId=${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Failed to update profile');
    const updated = (await res.json()) as UserProfile;
    setProfile(updated);
    return updated;
  }, [userId]);

  return { profile, loading, updateProfile, refetch: fetchProfile };
}
