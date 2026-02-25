"use client";

import Image from "next/image";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import styles from "./PhotosTab.module.css";

const baseImages = ["/logo.png", "/avatar-female.png", "/avatar-male.png"];

export default function PhotosTab() {
  const [activeImage, setActiveImage] = useState<string | null>(null);

  const images = useMemo(
    () =>
      Array.from({ length: 36 }, (_, index) => ({
        id: index + 1,
        src: baseImages[index % baseImages.length],
      })),
    []
  );

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button type="button" className={styles.headerButton}>
          등록
        </button>
        <h2 className={styles.headerTitle}>사진</h2>
        <button type="button" className={styles.headerButton}>
          선택
        </button>
      </header>

      <div className={styles.gallery}>
        <div className={styles.grid}>
          {images.map((image) => (
            <button
              key={image.id}
              type="button"
              className={styles.gridButton}
              onClick={() => setActiveImage(image.src)}
            >
              <Image
                src={image.src}
                alt={`Photo ${image.id}`}
                fill
                sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 20vw"
                className={styles.gridImage}
              />
            </button>
          ))}
        </div>
      </div>

      {activeImage && (
        <div className={styles.overlay}>
          <div className={styles.overlayHeader}>
            <button
              type="button"
              className={styles.overlayButton}
              onClick={() => setActiveImage(null)}
              aria-label="Back"
            >
              <ArrowLeft />
            </button>
            <button type="button" className={styles.overlayButton} aria-label="Delete" disabled>
              <Trash2 />
            </button>
          </div>
          <div className={styles.overlayImageWrapper}>
            <Image
              src={activeImage}
              alt="Selected photo"
              fill
              sizes="100vw"
              className={styles.overlayImage}
            />
          </div>
        </div>
      )}
    </div>
  );
}
