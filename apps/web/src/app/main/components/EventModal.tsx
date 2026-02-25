"use client";

import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    if (!isOpen || !selectedDate) {
      return;
    }
    const base = existingEvent ?? emptyEvent;
    setFormData({ ...base });
    setOriginalData({ ...base });
  }, [isOpen, selectedDate, existingEvent]);

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

  if (!isOpen || !selectedDate) {
    return null;
  }

  const handleChange = (key: keyof EventFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleCreate = () => {
    if (!isTitleValid) {
      return;
    }
    onCreate(selectedDate, { ...formData, title: formData.title.trim() });
  };

  const handleUpdate = () => {
    if (!isTitleValid || !isDirty) {
      return;
    }
    onUpdate(selectedDate, { ...formData, title: formData.title.trim() });
  };

  const handleDelete = () => {
    onDelete(selectedDate);
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <header className={styles.header}>
          <h3 className={styles.title}>선택한 날짜</h3>
          <p className={styles.date}>{selectedDate}</p>
        </header>
        <div className={styles.body}>
          <label className={styles.field}>
            제목
            <input
              type="text"
              placeholder="일정 제목"
              value={formData.title}
              onChange={(event) => handleChange("title", event.target.value)}
            />
          </label>
          <label className={styles.field}>
            장소
            <input
              type="text"
              placeholder="장소"
              value={formData.location}
              onChange={(event) => handleChange("location", event.target.value)}
            />
          </label>
          <label className={styles.field}>
            예상 일정(시간/기간)
            <input
              type="text"
              placeholder="예: 14:00~16:00"
              value={formData.expected}
              onChange={(event) => handleChange("expected", event.target.value)}
            />
          </label>
          <label className={styles.field}>
            일정 상세
            <textarea
              rows={4}
              placeholder="상세 내용"
              value={formData.details}
              onChange={(event) => handleChange("details", event.target.value)}
            />
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
