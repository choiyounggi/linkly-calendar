"use client";

import { useState, type ReactNode } from "react";
import { Calendar, Image as ImageIcon, MessageCircle, Settings } from "lucide-react";
import CalendarTab from "./components/CalendarTab";
import styles from "./page.module.css";

const tabs = [
  { key: "calendar", label: "Calendar", icon: Calendar },
  { key: "chat", label: "Chat", icon: MessageCircle },
  { key: "photos", label: "Photos", icon: ImageIcon },
  { key: "settings", label: "Settings", icon: Settings },
];

function ChatView() {
  return (
    <div className={styles.viewContent}>
      <MessageCircle className={styles.viewIcon} />
      <h2>Chat</h2>
    </div>
  );
}

function PhotoView() {
  return (
    <div className={styles.viewContent}>
      <ImageIcon className={styles.viewIcon} />
      <h2>Photos</h2>
    </div>
  );
}

function SettingsView() {
  return (
    <div className={styles.viewContent}>
      <Settings className={styles.viewIcon} />
      <h2>Settings</h2>
    </div>
  );
}

const views: Record<string, ReactNode> = {
  calendar: <CalendarTab />,
  chat: <ChatView />,
  photos: <PhotoView />,
  settings: <SettingsView />,
};

export default function MainPage() {
  const [activeTab, setActiveTab] = useState("calendar");

  return (
    <div className={styles.container}>
      <main className={styles.content}>{views[activeTab]}</main>
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
