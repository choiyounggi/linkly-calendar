"use client";

import { useCallback, useState } from "react";
import { useCouple } from "../../../hooks/useCouple";
import { useUserProfile } from "../../../hooks/useUserProfile";
import PoiSearchInput from "./PoiSearchInput";
import type { PoiResult } from "../../../hooks/usePoiSearch";
import styles from "./SettingsTab.module.css";

interface SettingsTabProps {
  coupleId: string;
  onBreakUp?: () => void;
}

export default function SettingsTab({ coupleId, onBreakUp }: SettingsTabProps) {
  const { couple, loading: coupleLoading, updateCouple, breakUp } = useCouple(coupleId);
  const { profile, loading: profileLoading, updateProfile } = useUserProfile();

  const [showBreakUpConfirm, setShowBreakUpConfirm] = useState(false);
  const [breakingUp, setBreakingUp] = useState(false);

  if (coupleLoading || profileLoading) {
    return <div className={styles.loading}>로딩 중...</div>;
  }

  if (!couple || !profile) {
    return <div className={styles.loading}>정보를 불러올 수 없습니다</div>;
  }

  const me = couple.members.find((m) => m.isMe);
  const partner = couple.members.find((m) => !m.isMe);

  const handleBreakUp = async () => {
    setBreakingUp(true);
    try {
      await breakUp();
      onBreakUp?.();
    } catch (error) {
      console.error("Break up failed:", error);
      setBreakingUp(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* 커플 정보 */}
      <CoupleInfoCard
        couple={couple}
        me={me}
        partner={partner}
        onUpdate={updateCouple}
      />

      {/* 내 정보 */}
      <MyInfoCard profile={profile} onUpdate={updateProfile} />

      {/* 커플 끊기 */}
      <div className={styles.card}>
        <div className={styles.dangerZone}>
          <button
            type="button"
            className={styles.breakUpBtn}
            onClick={() => setShowBreakUpConfirm(true)}
          >
            커플 끊기
          </button>
        </div>
      </div>

      {/* Break up confirmation */}
      {showBreakUpConfirm && (
        <div
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          onClick={() => !breakingUp && setShowBreakUpConfirm(false)}
        >
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.confirmTitle}>커플 끊기</h3>
            <p className={styles.confirmDesc}>
              커플 관계를 끊으면 일정, 사진, 채팅 등<br />
              모든 데이터가 영구적으로 삭제됩니다.<br />
              정말 진행하시겠습니까?
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.confirmCancel}
                onClick={() => setShowBreakUpConfirm(false)}
                disabled={breakingUp}
              >
                취소
              </button>
              <button
                type="button"
                className={styles.confirmDanger}
                onClick={handleBreakUp}
                disabled={breakingUp}
              >
                {breakingUp ? "처리 중..." : "끊기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Couple Info Card ── */

interface CoupleInfoCardProps {
  couple: NonNullable<ReturnType<typeof useCouple>["couple"]>;
  me: { nickname: string; displayName: string; birthday: string | null; homeAddress: string | null } | undefined;
  partner: { nickname: string; displayName: string; birthday: string | null; homeAddress: string | null } | undefined;
  onUpdate: (body: Record<string, unknown>) => Promise<unknown>;
}

function CoupleInfoCard({ couple, me, partner, onUpdate }: CoupleInfoCardProps) {
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>커플 정보</h3>

      {/* Members */}
      <div className={styles.memberPair}>
        {me && (
          <div className={styles.memberBlock}>
            <span className={styles.memberTag}>나</span>
            <EditableField
              label="이름"
              value={me.nickname}
              onSave={(val) => onUpdate({ myNickname: val })}
            />
            <div className={styles.field}>
              <span className={styles.fieldLabel}>생일</span>
              <p className={styles.fieldValue}>
                {me.birthday ? formatDate(me.birthday) : <span className={styles.fieldValueMuted}>미등록</span>}
              </p>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>집 주소</span>
              <p className={me.homeAddress ? styles.fieldValue : styles.fieldValueMuted}>
                {me.homeAddress ?? "미등록"}
              </p>
            </div>
          </div>
        )}
        {partner && (
          <div className={styles.memberBlock}>
            <span className={styles.memberTag}>상대방</span>
            <EditableField
              label="이름"
              value={partner.nickname}
              onSave={(val) => onUpdate({ partnerNickname: val })}
            />
            <div className={styles.field}>
              <span className={styles.fieldLabel}>생일</span>
              <p className={styles.fieldValue}>
                {partner.birthday ? formatDate(partner.birthday) : <span className={styles.fieldValueMuted}>미등록</span>}
              </p>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>집 주소</span>
              <p className={partner.homeAddress ? styles.fieldValue : styles.fieldValueMuted}>
                {partner.homeAddress ?? "미등록"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Anniversary */}
      <EditableField
        label="만난 날짜"
        value={couple.anniversaryDate ? couple.anniversaryDate.split("T")[0] : ""}
        type="date"
        placeholder="날짜 선택"
        onSave={(val) => onUpdate({ anniversaryDate: val || null })}
      />
    </div>
  );
}

/* ── My Info Card ── */

interface MyInfoCardProps {
  profile: NonNullable<ReturnType<typeof useUserProfile>["profile"]>;
  onUpdate: (body: Record<string, unknown>) => Promise<unknown>;
}

function MyInfoCard({ profile, onUpdate }: MyInfoCardProps) {
  const [saving, setSaving] = useState(false);

  const handleHomeSelect = useCallback(
    async (poi: PoiResult) => {
      setSaving(true);
      try {
        await onUpdate({
          homeLat: poi.lat,
          homeLng: poi.lng,
          homeAddress: `${poi.name} (${poi.address})`,
        });
      } catch (error) {
        console.error("Failed to update home:", error);
      } finally {
        setSaving(false);
      }
    },
    [onUpdate],
  );

  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>내 정보</h3>

      <EditableField
        label="이름"
        value={profile.displayName}
        onSave={(val) => onUpdate({ displayName: val })}
      />

      <EditableField
        label="생일"
        value={profile.birthday ? profile.birthday.split("T")[0] : ""}
        type="date"
        placeholder="날짜 선택"
        onSave={(val) => onUpdate({ birthday: val || null })}
      />

      <div className={styles.field}>
        <span className={styles.fieldLabel}>집 주소</span>
        {profile.homeAddress && (
          <p className={styles.fieldValue}>{profile.homeAddress}</p>
        )}
        <PoiSearchInput
          value=""
          onSelect={handleHomeSelect}
          onClear={() => {}}
          placeholder="새 집 위치 검색"
        />
        {saving && <span className={styles.saveIndicator}>저장 중...</span>}
      </div>
    </div>
  );
}

/* ── Editable Field ── */

interface EditableFieldProps {
  label: string;
  value: string;
  type?: "text" | "date";
  placeholder?: string;
  onSave: (value: string) => Promise<unknown>;
}

function EditableField({ label, value, type = "text", placeholder, onSave }: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const handleEdit = () => {
    setDraft(value);
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setDraft(value);
  };

  const handleSave = async () => {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className={styles.field}>
        <span className={styles.fieldLabel}>{label}</span>
        <div className={styles.editRow}>
          {type === "date" ? (
            <p className={value ? styles.fieldValue : styles.fieldValueMuted}>
              {value ? formatDate(value) : (placeholder ?? "미등록")}
            </p>
          ) : (
            <p className={value ? styles.fieldValue : styles.fieldValueMuted}>
              {value || (placeholder ?? "미등록")}
            </p>
          )}
          <button type="button" className={styles.editBtn} onClick={handleEdit}>
            수정
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.editRow}>
        <input
          type={type}
          className={styles.fieldInput}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          autoFocus
        />
        <button
          type="button"
          className={styles.editBtn}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "저장 중" : "저장"}
        </button>
        <button
          type="button"
          className={styles.editBtn}
          onClick={handleCancel}
          disabled={saving}
        >
          취소
        </button>
      </div>
    </div>
  );
}

/* ── Helpers ── */

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}
