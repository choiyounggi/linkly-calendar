"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import styles from "./EventModal.module.css";

export interface EventFormData {
  title: string;
  location: string;
  expected: string;
  details: string;
}

interface EventModalProps {
  isOpen: boolean;
  selectedDate: string | null;
  existingEvent: EventFormData | null;
  onClose: () => void;
  onCreate: (date: string, event: EventFormData) => void;
  onUpdate: (date: string, event: EventFormData) => void;
  onDelete: (date: string) => void;
}

const emptyEvent: EventFormData = {
  title: "",
  location: "",
  expected: "",
  details: "",
};

export default function EventModal({
  isOpen,
  selectedDate,
  existingEvent,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: EventModalProps) {
  const [formData, setFormData] = useState<EventFormData>(emptyEvent);
  const [originalData, setOriginalData] = useState<EventFormData>(emptyEvent);
  const titleId = useId();
  const descriptionId = useId();
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const isActive = isOpen && Boolean(selectedDate);
  const selectedDateValue = selectedDate ?? "";

  useEffect(() => {
    if (!isActive) {
      setFormData(emptyEvent);
      setOriginalData(emptyEvent);
      return;
    }
    const base = existingEvent ?? emptyEvent;
    setFormData({ ...base });
    setOriginalData({ ...base });
  }, [isActive, existingEvent]);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    titleInputRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isActive, onClose]);

  const isTitleValid = formData.title.trim().length > 0;
  const isDirty = useMemo(() => {
    if (!existingEvent) {
      return false;
    }
    return (
      formData.title !== originalData.title ||
      formData.location !== originalData.location ||
      formData.expected !== originalData.expected ||
      formData.details !== originalData.details
    );
  }, [existingEvent, formData, originalData]);

  if (!isActive) {
    return null;
  }

  const handleChange = (key: keyof EventFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleCreate = () => {
    if (!isTitleValid) {
      return;
    }
    onCreate(selectedDateValue, { ...formData, title: formData.title.trim() });
  };

  const handleUpdate = () => {
    if (!isTitleValid || !isDirty) {
      return;
    }
    onUpdate(selectedDateValue, { ...formData, title: formData.title.trim() });
  };

  const handleDelete = () => {
    onDelete(selectedDateValue);
  };

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClick={handleOverlayClick}
    >
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <header className={styles.header}>
          <h3 className={styles.title} id={titleId}>
            선택한 날짜
          </h3>
          <p className={styles.date} id={descriptionId}>
            {selectedDateValue}
          </p>
        </header>
        <div className={styles.body}>
          <label className={styles.field}>
            제목
            <input
              ref={titleInputRef}
              type="text"
              placeholder="일정 제목"
              value={formData.title}
              onChange={(event) => handleChange("title", event.target.value)}
            />
            <span className={styles.helper}>필수 입력</span>
          </label>
          <label className={styles.field}>
            장소
            <input
              type="text"
              placeholder="장소"
              value={formData.location}
              onChange={(event) => handleChange("location", event.target.value)}
            />
            <span className={styles.helper}>온라인/오프라인 장소</span>
          </label>
          <label className={styles.field}>
            예상 일정(시간/기간)
            <input
              type="text"
              placeholder="예: 14:00~16:00 또는 2시간"
              value={formData.expected}
              onChange={(event) => handleChange("expected", event.target.value)}
            />
            <span className={styles.helper}>시간 범위나 소요 시간</span>
          </label>
          <label className={styles.field}>
            일정 상세
            <textarea
              rows={4}
              placeholder="상세 내용"
              value={formData.details}
              onChange={(event) => handleChange("details", event.target.value)}
            />
            <span className={styles.helper}>추가 메모</span>
          </label>
        </div>
        <footer className={styles.footer}>
          {existingEvent ? (
            <>
              <button
                type="button"
                className={styles.dangerButton}
                onClick={handleDelete}
              >
                삭제
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleUpdate}
                disabled={!isTitleValid || !isDirty}
              >
                수정
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleCreate}
              disabled={!isTitleValid}
            >
              등록
            </button>
          )}
          <button type="button" className={styles.closeButton} onClick={onClose}>
            닫기
          </button>
        </footer>
      </div>
    </div>
  );
}
