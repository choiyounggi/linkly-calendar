"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendar, Image as ImageIcon, MessageCircle, Settings } from "lucide-react";
import CalendarTab from "./components/CalendarTab";
import ChatTab from "./components/ChatTab";
import PhotosTab from "./components/PhotosTab";
import SettingsTab from "./components/SettingsTab";
import CoupleSetup from "./components/CoupleSetup";
import styles from "./page.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// TODO: Replace with actual auth context
const USER_ID = "seed_user_1_id";

const tabs = [
  { key: "calendar", label: "Calendar", icon: Calendar },
  { key: "chat", label: "Chat", icon: MessageCircle },
  { key: "photos", label: "Photos", icon: ImageIcon },
  { key: "settings", label: "Settings", icon: Settings },
];

interface UserStatus {
  userId: string;
  hasCouple: boolean;
  coupleId: string | null;
  hasHomeAddress: boolean;
}

export default function MainPage() {
  const [activeTab, setActiveTab] = useState("calendar");
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/v1/users/me/status?userId=${USER_ID}`);
      if (!res.ok) throw new Error("Failed to fetch status");
      const data = (await res.json()) as UserStatus;
      setStatus(data);
    } catch (error) {
      console.error("Failed to fetch user status:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleCoupleReady = useCallback((coupleId: string) => {
    setStatus((prev) => prev ? { ...prev, hasCouple: true, coupleId } : prev);
  }, []);

  if (loading) {
    return (
      <div className={styles.container}>
        <main className={styles.content}>
          <div className={styles.viewContent}>
            <p>로딩 중...</p>
          </div>
        </main>
      </div>
    );
  }

  // 커플이 없으면 커플 등록 화면
  if (!status?.hasCouple) {
    return (
      <div className={styles.container}>
        <main className={styles.content}>
          <CoupleSetup userId={USER_ID} onCoupleReady={handleCoupleReady} />
        </main>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <main className={styles.content}>
        <div style={{ display: activeTab === "calendar" ? "contents" : "none" }}>
          <CalendarTab />
        </div>
        <div style={{ display: activeTab === "chat" ? "contents" : "none" }}>
          <ChatTab />
        </div>
        {activeTab === "photos" && <PhotosTab />}
        {activeTab === "settings" && <SettingsTab />}
      </main>
      <footer className={styles.footer}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
            >
              <Icon className={styles.tabIcon} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </footer>
    </div>
  );
}
