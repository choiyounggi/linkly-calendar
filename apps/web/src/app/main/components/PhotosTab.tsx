"use client";

import { ArrowLeft, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { usePhotos, type PhotoData } from "../../../hooks/usePhotos";
import styles from "./PhotosTab.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// TODO: Replace with actual auth context
const COUPLE_ID = "seed_couple_1_id";
const USER_ID = "seed_user_1_id";

export default function PhotosTab() {
  const { photos, loading, hasMore, loadMore, uploadPhotos, deletePhotos } =
    usePhotos(COUPLE_ID, USER_ID);

  const [activePhoto, setActivePhoto] = useState<PhotoData | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const hasSelection = selectedIds.size > 0;

  // Infinite scroll via IntersectionObserver
  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = galleryRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMoreRef.current();
        }
      },
      { root, rootMargin: "120px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const handleGridClick = (photo: PhotoData) => {
    if (selectMode) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(photo.id)) {
          next.delete(photo.id);
        } else {
          next.add(photo.id);
        }
        return next;
      });
      return;
    }
    setActivePhoto(photo);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleUploadChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    event.target.value = "";

    setUploading(true);
    try {
      await uploadPhotos(files);
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!hasSelection) return;
    const ids = Array.from(selectedIds);
    setSelectMode(false);
    setSelectedIds(new Set());
    try {
      await deletePhotos(ids);
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const handleDeleteActive = useCallback(async () => {
    if (!activePhoto) return;
    const id = activePhoto.id;
    setActivePhoto(null);
    try {
      await deletePhotos([id]);
    } catch (error) {
      console.error("Delete failed:", error);
    }
  }, [activePhoto, deletePhotos]);

  const handleExitSelect = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const photoUrl = (photo: PhotoData) => `${API_URL}${photo.url}`;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        {selectMode ? (
          <button
            type="button"
            className={styles.headerButton}
            onClick={handleDeleteSelected}
            disabled={!hasSelection}
          >
            삭제
          </button>
        ) : (
          <button
            type="button"
            className={styles.headerButton}
            onClick={handleUploadClick}
            disabled={uploading}
          >
            {uploading ? "업로드 중…" : "등록"}
          </button>
        )}
        <h2 className={styles.headerTitle}>사진</h2>
        {selectMode ? (
          <button
            type="button"
            className={styles.headerButton}
            onClick={handleExitSelect}
          >
            취소
          </button>
        ) : (
          <button
            type="button"
            className={styles.headerButton}
            onClick={() => setSelectMode(true)}
            disabled={photos.length === 0}
          >
            선택
          </button>
        )}
      </header>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleUploadChange}
        className={styles.fileInput}
        aria-hidden
        tabIndex={-1}
      />

      <div className={styles.gallery} ref={galleryRef}>
        {photos.length === 0 && !loading && (
          <div className={styles.loading}>사진이 없습니다</div>
        )}
        <div className={styles.grid}>
          {photos.map((photo) => {
            const isSelected = selectedIds.has(photo.id);
            return (
              <button
                key={photo.id}
                type="button"
                className={styles.gridButton}
                onClick={() => handleGridClick(photo)}
              >
                {selectMode && (
                  <span
                    className={`${styles.selectionIndicator} ${
                      isSelected ? styles.selectionIndicatorSelected : ""
                    }`}
                  >
                    {isSelected && <span className={styles.selectionCheck} />}
                  </span>
                )}
                <img
                  src={photoUrl(photo)}
                  alt={photo.caption ?? `Photo`}
                  className={styles.gridImage}
                  loading="lazy"
                />
              </button>
            );
          })}
        </div>
        <div ref={sentinelRef} className={styles.sentinel} aria-hidden />
        {loading && (
          <div className={styles.loading} aria-live="polite">
            불러오는 중…
          </div>
        )}
        {!loading && hasMore && photos.length > 0 && (
          <div className={styles.loading}>스크롤하면 더 보기</div>
        )}
      </div>

      {activePhoto && (
        <div className={styles.overlay}>
          <div className={styles.overlayHeader}>
            <button
              type="button"
              className={styles.overlayButton}
              onClick={() => setActivePhoto(null)}
              aria-label="Back"
            >
              <ArrowLeft />
            </button>
            <button
              type="button"
              className={styles.overlayButton}
              aria-label="Delete"
              onClick={handleDeleteActive}
            >
              <Trash2 />
            </button>
          </div>
          <div className={styles.overlayImageWrapper}>
            <img
              src={photoUrl(activePhoto)}
              alt={activePhoto.caption ?? "Selected photo"}
              className={styles.overlayImage}
            />
          </div>
        </div>
      )}
    </div>
  );
}
