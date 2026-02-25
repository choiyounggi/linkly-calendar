"use client";

import styles from "./EventModal.module.css";

interface EventModalProps {
  isOpen: boolean;
  selectedDate: string | null;
  onClose: () => void;
}

export default function EventModal({
  isOpen,
  selectedDate,
  onClose,
}: EventModalProps) {
  if (!isOpen || !selectedDate) {
    return null;
  }

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
            <input type="text" placeholder="일정 제목" />
          </label>
          <label className={styles.field}>
            장소
            <input type="text" placeholder="장소" />
          </label>
          <label className={styles.field}>
            예상 일정(시간/기간)
            <input type="text" placeholder="예: 14:00~16:00" />
          </label>
          <label className={styles.field}>
            일정 상세
            <textarea rows={4} placeholder="상세 내용" />
          </label>
        </div>
        <footer className={styles.footer}>
          <button type="button" className={styles.closeButton} onClick={onClose}>
            닫기
          </button>
        </footer>
      </div>
    </div>
  );
}
