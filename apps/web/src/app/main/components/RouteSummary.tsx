"use client";

import type { CoupleRouteData } from "../../../hooks/useCoupleRoute";
import styles from "./RouteSummary.module.css";

interface RouteSummaryProps {
  route: CoupleRouteData;
  partnerName?: string;
  onDetailClick: () => void;
  onRefresh: () => void;
}

export default function RouteSummary({ route, partnerName = "상대방", onDetailClick, onRefresh }: RouteSummaryProps) {
  const departure = new Date(route.myRoute.departureTime);
  const departureStr = departure.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={styles.container}>
      <div className={styles.summary}>
        <div className={styles.row}>
          <span className={styles.label}>출발</span>
          <span className={styles.value}>{departureStr}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>소요</span>
          <span className={styles.value}>{route.myRoute.totalTime}분</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>환승</span>
          <span className={styles.value}>{route.myRoute.transferCount}회</span>
        </div>
        {route.type === "meetup" && route.meetupStation && (
          <div className={styles.meetup}>{route.meetupStation.name}에서 {partnerName}과(와) 만남</div>
        )}
        {route.type === "individual" && (
          <div className={styles.noOverlap}>{route.noOverlapReason}</div>
        )}
      </div>
      <div className={styles.actions}>
        <button type="button" onClick={onDetailClick} className={styles.detailBtn}>상세 경로 보기</button>
        <button type="button" onClick={onRefresh} className={styles.refreshBtn}>새로고침</button>
      </div>
    </div>
  );
}
