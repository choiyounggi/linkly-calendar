import { useCallback, useEffect, useState } from 'react';
import { authFetch } from '../lib/api';

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

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/v1/users/me');
      if (!res.ok) throw new Error('Failed to fetch profile');
      const data = (await res.json()) as UserProfile;
      setProfile(data);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = useCallback(async (body: Record<string, unknown>) => {
    const res = await authFetch('/v1/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Failed to update profile');
    const updated = (await res.json()) as UserProfile;
    setProfile(updated);
    return updated;
  }, []);

  return { profile, loading, updateProfile, refetch: fetchProfile };
}
