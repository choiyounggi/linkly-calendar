"use client";

import Image from "next/image";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import styles from "./page.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function Home() {
  const { token, loading } = useAuth();
  const router = useRouter();

  // 이미 로그인 상태면 메인으로 이동
  useEffect(() => {
    if (!loading && token) {
      router.replace("/main");
    }
  }, [loading, token, router]);

  if (loading) {
    return (
      <div className={styles.page}>
        <p>로딩 중...</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <main className={styles.card}>
        <div className={styles.header}>
          <Image
            className={styles.logo}
            src="/logo.png"
            alt="Linkly Calendar logo"
            width={140}
            height={140}
            priority
          />
          <h1 className={styles.title}>Linkly Calendar</h1>
          <p className={styles.subtitle}>Couples calendar for your shared moments</p>
        </div>
        <div className={styles.buttons}>
          <a href={`${API_URL}/v1/auth/kakao`} className={`${styles.button} ${styles.kakao}`}>
            카카오 로그인
          </a>
          <a href={`${API_URL}/v1/auth/google`} className={`${styles.button} ${styles.google}`}>
            구글 로그인
          </a>
          <a href={`${API_URL}/v1/auth/naver`} className={`${styles.button} ${styles.naver}`}>
            네이버 로그인
          </a>
        </div>
      </main>
    </div>
  );
}
