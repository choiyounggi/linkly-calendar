"use client";

import { useState } from "react";
import { useCoupleInvite } from "../../../hooks/useCoupleInvite";
import styles from "./CoupleSetup.module.css";

interface CoupleSetupProps {
  onCoupleReady: (coupleId: string) => void;
}

export default function CoupleSetup({ onCoupleReady }: CoupleSetupProps) {
  const {
    sentInvite,
    receivedInvites,
    loading,
    sendInvite,
    cancelInvite,
    acceptInvite,
    declineInvite,
    searchUser,
  } = useCoupleInvite();

  const [activeTab, setActiveTab] = useState<"received" | "send">("received");

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <p className={styles.subtitle}>로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>커플 등록</h1>
        <p className={styles.subtitle}>상대방에게 커플 신청을 보내거나, 받은 요청을 확인하세요.</p>
      </div>

      <div className={styles.card}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "received" ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab("received")}
          >
            받은 요청
            {receivedInvites.length > 0 && (
              <span className={styles.badge}>{receivedInvites.length}</span>
            )}
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "send" ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab("send")}
          >
            신청하기
          </button>
        </div>

        {activeTab === "received" && (
          <ReceivedTab
            invites={receivedInvites}
            onAccept={async (id) => {
              const result = await acceptInvite(id);
              onCoupleReady(result.coupleId);
            }}
            onDecline={declineInvite}
          />
        )}

        {activeTab === "send" && (
          <SendTab
            sentInvite={sentInvite}
            onSend={sendInvite}
            onCancel={cancelInvite}
            onSearch={searchUser}
          />
        )}
      </div>
    </div>
  );
}

/* ── Received Tab ── */

interface ReceivedTabProps {
  invites: ReturnType<typeof useCoupleInvite>["receivedInvites"];
  onAccept: (id: string) => Promise<void>;
  onDecline: (id: string) => Promise<void>;
}

function ReceivedTab({ invites, onAccept, onDecline }: ReceivedTabProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleAccept = async (id: string) => {
    setProcessingId(id);
    try {
      await onAccept(id);
    } catch (error) {
      console.error("Accept failed:", error);
      setProcessingId(null);
    }
  };

  const handleDecline = async (id: string) => {
    setProcessingId(id);
    try {
      await onDecline(id);
    } catch (error) {
      console.error("Decline failed:", error);
    } finally {
      setProcessingId(null);
    }
  };

  if (invites.length === 0) {
    return <p className={styles.emptyText}>받은 요청이 없습니다</p>;
  }

  return (
    <div className={styles.inviteList}>
      {invites.map((invite) => (
        <div key={invite.id} className={styles.inviteCard}>
          <div className={styles.inviteInfo}>
            <span className={styles.inviteName}>{invite.inviter.displayName}</span>
            <span className={styles.inviteEmail}>{invite.inviter.email}</span>
          </div>
          <div className={styles.inviteActions}>
            <button
              type="button"
              className={styles.acceptBtn}
              onClick={() => handleAccept(invite.id)}
              disabled={processingId !== null}
            >
              승인
            </button>
            <button
              type="button"
              className={styles.declineBtn}
              onClick={() => handleDecline(invite.id)}
              disabled={processingId !== null}
            >
              거절
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Send Tab ── */

interface SendTabProps {
  sentInvite: ReturnType<typeof useCoupleInvite>["sentInvite"];
  onSend: (email: string) => Promise<unknown>;
  onCancel: () => Promise<void>;
  onSearch: (email: string) => Promise<{ found: boolean; user: unknown }>;
}

function SendTab({ sentInvite, onSend, onCancel, onSearch }: SendTabProps) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const handleSend = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;

    setSending(true);
    try {
      // 먼저 사용자 존재 여부 확인
      const result = await onSearch(trimmed);
      if (!result.found) {
        setErrorModal("해당 이메일의 사용자를 찾을 수 없습니다.");
        setSending(false);
        return;
      }
      await onSend(trimmed);
      setEmail("");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "신청에 실패했습니다.";
      setErrorModal(msg);
    } finally {
      setSending(false);
    }
  };

  const handleCancel = async () => {
    setCanceling(true);
    try {
      await onCancel();
    } catch (error) {
      console.error("Cancel failed:", error);
    } finally {
      setCanceling(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !sending) {
      handleSend();
    }
  };

  return (
    <div className={styles.form}>
      {sentInvite && (
        <div className={styles.sentStatus}>
          <span className={styles.sentLabel}>신청 대기 중</span>
          <span className={styles.sentTarget}>
            {sentInvite.invitee?.displayName ?? sentInvite.inviteeEmail}
          </span>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={handleCancel}
            disabled={canceling}
          >
            {canceling ? "취소 중..." : "신청 취소"}
          </button>
        </div>
      )}

      <div className={styles.inputRow}>
        <input
          type="email"
          className={styles.emailInput}
          placeholder="상대방 이메일 주소"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
        />
        <button
          type="button"
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={sending || !email.trim()}
        >
          {sending ? "전송 중..." : "신청"}
        </button>
      </div>

      {errorModal && (
        <div
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          onClick={() => setErrorModal(null)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>알림</h3>
            <p className={styles.modalDesc}>{errorModal}</p>
            <button
              type="button"
              className={styles.modalBtn}
              onClick={() => setErrorModal(null)}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
