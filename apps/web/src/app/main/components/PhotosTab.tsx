"use client";

import Image from "next/image";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useEffect, useMemo, useReducer, useRef, useState, type ChangeEvent } from "react";
import styles from "./PhotosTab.module.css";

const baseImages = ["/logo.png", "/avatar-female.png", "/avatar-male.png"];
const INITIAL_VISIBLE = 36;
const PAGE_SIZE = 24;

type PhotoItem = {
  id: number;
  src: string;
  isLocal?: boolean;
};

type PhotosState = {
  images: PhotoItem[];
  activeImage: string | null;
  selectMode: boolean;
  selectedIds: Set<number>;
};

type PhotosAction =
  | { type: "ENTER_SELECT" }
  | { type: "EXIT_SELECT" }
  | { type: "TOGGLE_SELECT"; id: number }
  | { type: "OPEN_IMAGE"; src: string }
  | { type: "CLOSE_IMAGE" }
  | { type: "ADD_IMAGES"; items: PhotoItem[] }
  | { type: "DELETE_SELECTED" };

const createInitialImages = (): PhotoItem[] =>
  Array.from({ length: 36 }, (_, index) => ({
    id: index + 1,
    src: baseImages[index % baseImages.length],
    isLocal: false,
  }));

const initializeState = (images: PhotoItem[]): PhotosState => ({
  images,
  activeImage: null,
  selectMode: false,
  selectedIds: new Set<number>(),
});

const photosReducer = (state: PhotosState, action: PhotosAction): PhotosState => {
  switch (action.type) {
    case "ENTER_SELECT":
      return {
        ...state,
        selectMode: true,
        activeImage: null,
      };
    case "EXIT_SELECT":
      return {
        ...state,
        selectMode: false,
        selectedIds: new Set<number>(),
      };
    case "TOGGLE_SELECT": {
      const nextSelected = new Set(state.selectedIds);
      if (nextSelected.has(action.id)) {
        nextSelected.delete(action.id);
      } else {
        nextSelected.add(action.id);
      }
      return {
        ...state,
        selectedIds: nextSelected,
      };
    }
    case "OPEN_IMAGE":
      return {
        ...state,
        activeImage: action.src,
      };
    case "CLOSE_IMAGE":
      return {
        ...state,
        activeImage: null,
      };
    case "ADD_IMAGES": {
      if (action.items.length === 0) {
        return state;
      }
      return {
        ...state,
        images: [...state.images, ...action.items],
      };
    }
    case "DELETE_SELECTED": {
      if (state.selectedIds.size === 0) {
        return state;
      }
      const nextImages = state.images.filter((image) => !state.selectedIds.has(image.id));
      return {
        ...state,
        images: nextImages,
        selectedIds: new Set<number>(),
      };
    }
    default:
      return state;
  }
};

const isBlobSrc = (src: string) => src.startsWith("blob:");

export default function PhotosTab() {
  const initialImages = useMemo(() => createInitialImages(), []);
  const [state, dispatch] = useReducer(photosReducer, initialImages, initializeState);
  const { images, activeImage, selectMode, selectedIds } = state;
  const hasSelection = selectedIds.size > 0;
  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(INITIAL_VISIBLE, initialImages.length)
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nextIdRef = useRef(initialImages.length + 1);
  const imagesRef = useRef(images);
  const visibleCountRef = useRef(visibleCount);
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    visibleCountRef.current = visibleCount;
  }, [visibleCount]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = galleryRef.current;
    if (!sentinel || !root) {
      return;
    }

    let clearLoadingTimer: number | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) {
          return;
        }
        const current = visibleCountRef.current;
        if (current >= images.length) {
          return;
        }
        const nextVisible = Math.min(current + PAGE_SIZE, images.length);
        if (nextVisible === current) {
          return;
        }
        setVisibleCount(nextVisible);
        setIsLoadingMore(true);
        if (clearLoadingTimer) {
          window.clearTimeout(clearLoadingTimer);
        }
        clearLoadingTimer = window.setTimeout(() => {
          setIsLoadingMore(false);
        }, 160);
      },
      {
        root,
        rootMargin: "120px",
      }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
      if (clearLoadingTimer) {
        window.clearTimeout(clearLoadingTimer);
      }
    };
  }, [images.length]);

  useEffect(() => {
    return () => {
      imagesRef.current
        .filter((image) => image.isLocal && isBlobSrc(image.src))
        .forEach((image) => URL.revokeObjectURL(image.src));
    };
  }, []);

  const handleGridClick = (image: PhotoItem) => {
    if (selectMode) {
      dispatch({ type: "TOGGLE_SELECT", id: image.id });
      return;
    }
    dispatch({ type: "OPEN_IMAGE", src: image.src });
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleUploadChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }
    const items: PhotoItem[] = files.map((file) => ({
      id: nextIdRef.current++,
      src: URL.createObjectURL(file),
      isLocal: true,
    }));
    const nextLength = images.length + items.length;
    setVisibleCount((current) => Math.max(current, nextLength));
    dispatch({ type: "ADD_IMAGES", items });
    event.target.value = "";
  };

  const handleDeleteSelected = () => {
    if (!hasSelection) {
      return;
    }
    const urlsToRevoke = images
      .filter((image) => image.isLocal && selectedIds.has(image.id))
      .map((image) => image.src);
    dispatch({ type: "DELETE_SELECTED" });
    urlsToRevoke.forEach((src) => URL.revokeObjectURL(src));
  };

  const clampedVisibleCount = Math.min(visibleCount, images.length);
  const visibleImages = images.slice(0, clampedVisibleCount);
  const hasMoreImages = clampedVisibleCount < images.length;

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
          <button type="button" className={styles.headerButton} onClick={handleUploadClick}>
            등록
          </button>
        )}
        <h2 className={styles.headerTitle}>사진</h2>
        {selectMode ? (
          <button
            type="button"
            className={styles.headerButton}
            onClick={() => dispatch({ type: "EXIT_SELECT" })}
          >
            취소
          </button>
        ) : (
          <button
            type="button"
            className={styles.headerButton}
            onClick={() => dispatch({ type: "ENTER_SELECT" })}
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
        <div className={styles.grid}>
          {visibleImages.map((image) => {
            const isSelected = selectedIds.has(image.id);
            return (
              <button
                key={image.id}
                type="button"
                className={styles.gridButton}
                onClick={() => handleGridClick(image)}
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
                {image.isLocal && isBlobSrc(image.src) ? (
                  <img
                    src={image.src}
                    alt={`Photo ${image.id}`}
                    className={styles.gridImage}
                  />
                ) : (
                  <Image
                    src={image.src}
                    alt={`Photo ${image.id}`}
                    fill
                    sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 20vw"
                    className={styles.gridImage}
                  />
                )}
              </button>
            );
          })}
        </div>
        <div ref={sentinelRef} className={styles.sentinel} aria-hidden />
        {hasMoreImages && (
          <div className={styles.loading} aria-live="polite">
            {isLoadingMore ? "불러오는 중…" : "스크롤하면 더 보기"}
          </div>
        )}
      </div>

      {activeImage && (
        <div className={styles.overlay}>
          <div className={styles.overlayHeader}>
            <button
              type="button"
              className={styles.overlayButton}
              onClick={() => dispatch({ type: "CLOSE_IMAGE" })}
              aria-label="Back"
            >
              <ArrowLeft />
            </button>
            <button type="button" className={styles.overlayButton} aria-label="Delete" disabled>
              <Trash2 />
            </button>
          </div>
          <div className={styles.overlayImageWrapper}>
            {isBlobSrc(activeImage) ? (
              <img src={activeImage} alt="Selected photo" className={styles.overlayImage} />
            ) : (
              <Image
                src={activeImage}
                alt="Selected photo"
                fill
                sizes="100vw"
                className={styles.overlayImage}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
