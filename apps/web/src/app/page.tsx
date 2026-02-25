import Image from "next/image";
import styles from "./page.module.css";

export default function Home() {
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
          <button type="button" className={`${styles.button} ${styles.kakao}`}>
            카카오 로그인
          </button>
          <button type="button" className={`${styles.button} ${styles.google}`}>
            구글 로그인
          </button>
          <button type="button" className={`${styles.button} ${styles.naver}`}>
            네이버 로그인
          </button>
        </div>
      </main>
    </div>
  );
}
