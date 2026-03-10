"use client";

import styles from "./RouteDetail.module.css";

interface RouteDetailProps {
  legs: Record<string, unknown>[];
  meetupStationName?: string;
  partnerName?: string;
  partnerDepartureTime?: string;
  onBack: () => void;
}

const MODE_LABELS: Record<string, string> = { WALK: "도보", BUS: "버스", SUBWAY: "지하철", EXPRESSBUS: "고속버스", TRAIN: "기차" };
const MODE_COLORS: Record<string, string> = { WALK: "#888", BUS: "#39b54a", SUBWAY: "#0052a4" };

export default function RouteDetail({ legs, meetupStationName, partnerName = "상대방", partnerDepartureTime, onBack }: RouteDetailProps) {
  return (
    <div className={styles.container}>
      <button type="button" onClick={onBack} className={styles.backBtn}>← 뒤로</button>
      <div className={styles.steps}>
        {legs.map((leg, idx) => {
          const mode = leg.mode as string;
          const sectionTime = leg.sectionTime as number;
          const startName = (leg.start as Record<string, unknown>)?.name as string | undefined;
          const endName = (leg.end as Record<string, unknown>)?.name as string | undefined;
          const color = MODE_COLORS[mode] ?? "#555";
          const label = MODE_LABELS[mode] ?? mode;
          const minutes = Math.ceil((sectionTime ?? 0) / 60);

          const passStopList = leg.passStopList as Record<string, unknown> | undefined;
          const stationList = passStopList?.stationList as Record<string, unknown>[] | undefined;
          const isMeetupLeg = stationList?.some((s) => meetupStationName && (s.stationName as string) === meetupStationName);

          return (
            <div key={idx} className={styles.step}>
              <div className={styles.indicator} style={{ backgroundColor: color }} />
              <div className={styles.content}>
                <div className={styles.modeRow}>
                  <span className={styles.mode} style={{ color }}>{label}</span>
                  <span className={styles.time}>{minutes}분</span>
                </div>
                {startName && <div className={styles.station}>{startName}</div>}
                {endName && <div className={styles.station}>→ {endName}</div>}
                {isMeetupLeg && meetupStationName && (
                  <div className={styles.meetupBadge}>
                    여기서 {partnerName} 만남
                    {partnerDepartureTime && (
                      <span className={styles.partnerTime}>
                        ({partnerName} 출발: {new Date(partnerDepartureTime).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
