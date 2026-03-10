"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import styles from "./EventModal.module.css";
import PoiSearchInput from "./PoiSearchInput";
import type { PoiResult } from "../../../hooks/usePoiSearch";

export interface EventFormData {
  title: string;
  appointmentAt: string;       // ISO datetime-local string (YYYY-MM-DDTHH:mm)
  placeName: string;
  placeAddress: string;
  placeLat: number | null;
  placeLng: number | null;
  detail: string;
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
  appointmentAt: "",
  placeName: "",
  placeAddress: "",
  placeLat: null,
  placeLng: null,
  detail: "",
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
  const isActive = isOpen && Boolean(selectedDate);
  const selectedDateValue = selectedDate ?? "";

  if (!isActive) {
    return null;
  }

  const contentKey = JSON.stringify({
    selectedDateValue,
    existingEvent,
  });

  return (
    <EventModalContent
      key={contentKey}
      selectedDateValue={selectedDateValue}
      existingEvent={existingEvent}
      onClose={onClose}
      onCreate={onCreate}
      onUpdate={onUpdate}
      onDelete={onDelete}
    />
  );
}

interface EventModalContentProps {
  selectedDateValue: string;
  existingEvent: EventFormData | null;
  onClose: () => void;
  onCreate: (date: string, event: EventFormData) => void;
  onUpdate: (date: string, event: EventFormData) => void;
  onDelete: (date: string) => void;
}

function EventModalContent({
  selectedDateValue,
  existingEvent,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: EventModalContentProps) {
  const baseEvent = existingEvent ?? emptyEvent;
  const [formData, setFormData] = useState<EventFormData>(() => ({ ...baseEvent }));
  const [originalData] = useState<EventFormData>(() => ({ ...baseEvent }));
  const titleId = useId();
  const descriptionId = useId();
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    titleInputRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'input, textarea, button, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const isTitleValid = formData.title.trim().length > 0;
  const isDirty = useMemo(() => {
    if (!existingEvent) {
      return false;
    }
    return (
      formData.title !== originalData.title ||
      formData.appointmentAt !== originalData.appointmentAt ||
      formData.placeName !== originalData.placeName ||
      formData.placeAddress !== originalData.placeAddress ||
      formData.placeLat !== originalData.placeLat ||
      formData.placeLng !== originalData.placeLng ||
      formData.detail !== originalData.detail
    );
  }, [existingEvent, formData, originalData]);

  const handleChange = (key: keyof EventFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handlePoiSelect = (poi: PoiResult) => {
    setFormData((prev) => ({
      ...prev,
      placeName: poi.name,
      placeAddress: poi.address,
      placeLat: poi.lat,
      placeLng: poi.lng,
    }));
  };

  const handlePoiClear = () => {
    setFormData((prev) => ({
      ...prev,
      placeName: "",
      placeAddress: "",
      placeLat: null,
      placeLng: null,
    }));
  };

  const isFormValid = isTitleValid && formData.appointmentAt !== "";

  const handleCreate = () => {
    if (!isFormValid) {
      return;
    }
    onCreate(selectedDateValue, { ...formData, title: formData.title.trim() });
  };

  const handleUpdate = () => {
    if (!isFormValid || !isDirty) {
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
      <div className={styles.modal} ref={modalRef} onClick={(event) => event.stopPropagation()}>
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
              onChange={(e) => handleChange("title", e.target.value)}
            />
            <span className={styles.helper}>필수 입력</span>
          </label>
          <label className={styles.field}>
            약속 시간
            <input
              type="datetime-local"
              value={formData.appointmentAt}
              onChange={(e) => handleChange("appointmentAt", e.target.value)}
            />
            <span className={styles.helper}>필수 입력</span>
          </label>
          <div className={styles.field}>
            <span>장소</span>
            <PoiSearchInput
              value={formData.placeName}
              onSelect={handlePoiSelect}
              onClear={handlePoiClear}
              placeholder="장소 검색"
            />
            {formData.placeAddress && (
              <span className={styles.helper}>{formData.placeAddress}</span>
            )}
          </div>
          <label className={styles.field}>
            메모
            <textarea
              rows={4}
              placeholder="상세 내용"
              value={formData.detail}
              onChange={(e) => handleChange("detail", e.target.value)}
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
                disabled={!isFormValid || !isDirty}
              >
                수정
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleCreate}
              disabled={!isFormValid}
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
