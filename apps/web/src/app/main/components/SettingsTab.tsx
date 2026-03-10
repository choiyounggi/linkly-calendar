"use client";

import { useCallback, useEffect, useState } from "react";
import PoiSearchInput from "./PoiSearchInput";
import type { PoiResult } from "../../../hooks/usePoiSearch";
import styles from "./SettingsTab.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface UserProfile {
  id: string;
  displayName: string;
  homeAddress: string | null;
  homeLat: number | null;
  homeLng: number | null;
}

interface SettingsTabProps {
  userId: string;
}

export default function SettingsTab({ userId }: SettingsTabProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetch(`${API_URL}/v1/users/me?userId=${userId}`)
      .then((res) => res.json())
      .then((data) => setProfile(data as UserProfile))
      .catch(console.error);
  }, [userId]);

  const handleHomeSelect = useCallback(async (poi: PoiResult) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/v1/users/me?userId=${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeLat: poi.lat, homeLng: poi.lng, homeAddress: `${poi.name} (${poi.address})` }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const updated = (await res.json()) as UserProfile;
      setProfile(updated);
    } catch (error) {
      console.error("Failed to update home location:", error);
    } finally {
      setSaving(false);
    }
  }, [userId]);

  if (!profile) return <div className={styles.loading}>로딩 중...</div>;

  return (
    <div className={styles.container}>
      <h3 className={styles.heading}>내 정보</h3>
      <div className={styles.section}>
        <label className={styles.label}>이름</label>
        <p className={styles.value}>{profile.displayName}</p>
      </div>
      <div className={styles.section}>
        <label className={styles.label}>집 위치</label>
        {profile.homeAddress && <p className={styles.currentHome}>{profile.homeAddress}</p>}
        <PoiSearchInput value="" onSelect={handleHomeSelect} onClear={() => {}} placeholder="새 집 위치 검색" />
        {saving && <p className={styles.saving}>저장 중...</p>}
      </div>
    </div>
  );
}
