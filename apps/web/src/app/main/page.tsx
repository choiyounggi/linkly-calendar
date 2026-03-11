"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Image as ImageIcon, MessageCircle, Settings } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { authFetch } from "../../lib/api";
import CalendarTab from "./components/CalendarTab";
import ChatTab from "./components/ChatTab";
import PhotosTab from "./components/PhotosTab";
import SettingsTab from "./components/SettingsTab";
import CoupleSetup from "./components/CoupleSetup";
import styles from "./page.module.css";

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
  const { token, user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("calendar");
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // 미인증 시 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (!authLoading && !token) {
      router.replace("/");
    }
  }, [authLoading, token, router]);

  const fetchStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await authFetch("/v1/users/me/status");
      if (!res.ok) {
        if (res.status === 401) {
          logout();
          return;
        }
        throw new Error("Failed to fetch status");
      }
      const data = (await res.json()) as UserStatus;
      setStatus(data);
    } catch (error) {
      console.error("Failed to fetch user status:", error);
    } finally {
      setStatusLoading(false);
    }
  }, [token, logout]);

  useEffect(() => {
    if (token) {
      fetchStatus();
    }
  }, [token, fetchStatus]);

  const handleCoupleReady = useCallback((coupleId: string) => {
    setStatus((prev) => prev ? { ...prev, hasCouple: true, coupleId } : prev);
  }, []);

  if (authLoading || statusLoading) {
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

  if (!user) return null;

  // 커플이 없으면 커플 등록 화면
  if (!status?.hasCouple) {
    return (
      <div className={styles.container}>
        <main className={styles.content}>
          <CoupleSetup onCoupleReady={handleCoupleReady} />
        </main>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <main className={styles.content}>
        <div style={{ display: activeTab === "calendar" ? "contents" : "none" }}>
          <CalendarTab coupleId={status.coupleId!} />
        </div>
        <div style={{ display: activeTab === "chat" ? "contents" : "none" }}>
          <ChatTab coupleId={status.coupleId!} visible={activeTab === "chat"} />
        </div>
        {activeTab === "photos" && <PhotosTab coupleId={status.coupleId!} />}
        {activeTab === "settings" && (
          <SettingsTab coupleId={status.coupleId!} onBreakUp={() => fetchStatus()} />
        )}
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
