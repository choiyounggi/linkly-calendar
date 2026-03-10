# Couple Route Guidance Design

커플 캘린더 일정의 약속 장소까지 대중교통 경로 안내 기능.
각자 집에서 출발하여 약속 시간에 도착하기 위한 경로를 보여주고,
두 사람의 경로가 겹치는 역이 있으면 합류 지점을 자동 추천한다.

## 1. DB Schema

### CalendarEvent 변경

```prisma
model CalendarEvent {
  id               String   @id @default(cuid())
  coupleId         String
  title            String
  placeName        String?       // POI 이름
  placeAddress     String?       // POI 주소
  placeLat         Float?        // 위도
  placeLng         Float?        // 경도
  appointmentAt    DateTime?     // 약속 시간 (도착 목표)
  detail           String?       // 메모
  createdByUserId  String
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  couple    Couple @relation(fields: [coupleId], references: [id], onDelete: Cascade)
  createdBy User   @relation(fields: [createdByUserId], references: [id], onDelete: Cascade)
  routeCaches RouteCache[]

  @@index([coupleId])
  @@index([createdByUserId])
}
```

제거 필드: `place`, `expectedSchedule`, `startAt`, `endAt`, `allDay`, `meetupLat`, `meetupLng`, `meetupName`, `meetupNote`, `description`.

### RouteCache 신규

```prisma
model RouteCache {
  id        String   @id @default(cuid())
  eventId   String
  userId    String
  cacheKey  String   @unique
  routeData Json
  createdAt DateTime @default(now())
  expiresAt DateTime

  event CalendarEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  user  User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([eventId, userId])
  @@index([expiresAt])
}
```

### User 모델

변경 없음. 기존 `homeLat`, `homeLng`, `homeAddress`, `homeUpdatedAt` 활용.

## 2. API Endpoints

### POI 검색

```
GET /v1/transit/poi/search?keyword={검색어}&page=1
```

TMAP POI API 호출 후 정제된 결과 반환. API 키 프론트 노출 방지.

응답:
```json
{
  "results": [
    { "name": "강남역 2번출구", "address": "서울 강남구...", "lat": 37.497, "lng": 127.027 }
  ]
}
```

### 캘린더 일정 CRUD

```
POST   /v1/events                         — 생성
GET    /v1/events?coupleId=&month=2026-03  — 월별 목록
GET    /v1/events/:id                      — 상세
PATCH  /v1/events/:id                      — 수정
DELETE /v1/events/:id                      — 삭제
```

### 커플 경로 분석

```
POST /v1/transit/couple-route
Body: { eventId, userId }
```

서버 내부 동작:
1. eventId → 일정 조회 (placeLat/placeLng, appointmentAt)
2. coupleId → 커플 멤버 2명 조회 (각자 homeLat/homeLng)
3. 캐시 확인 (Redis 1차 → DB RouteCache 2차)
4. 캐시 미스 → TMAP 대중교통 API 2회 호출 (arrivalTime 역산)
5. 두 경로의 역 목록 비교 → 겹침 분석
6. 결과 캐시 저장 후 반환

응답 (합류역 있을 때):
```json
{
  "type": "meetup",
  "meetupStation": { "name": "시청역", "lat": 37.564, "lng": 126.977 },
  "myRoute": {
    "departureTime": "2026-03-15T09:00:00",
    "totalTime": 55,
    "legs": [...]
  },
  "partnerDepartureTime": "2026-03-15T09:30:00",
  "cachedAt": "..."
}
```

응답 (겹치는 역 없을 때):
```json
{
  "type": "individual",
  "noOverlapReason": "겹치는 경로가 없어 각자 이동합니다.",
  "myRoute": { "departureTime": "...", "totalTime": 55, "legs": [...] },
  "cachedAt": "..."
}
```

### 사용자 프로필

```
GET   /v1/users/me   — 내 정보 조회
PATCH /v1/users/me   — 내 정보 수정 (homeLat, homeLng, homeAddress)
```

## 3. Route Overlap Algorithm

1. 멤버A 최적 경로에서 대중교통 leg의 모든 역 추출 → stationsA
2. 멤버B 최적 경로에서 대중교통 leg의 모든 역 추출 → stationsB
3. 교집합 = stationsA ∩ stationsB (정규화된 역 이름 기준)
4. 교집합 비어있으면 → `type: "individual"`
5. 교집합 있으면 → 두 경로에서 가장 일찍 등장하는 공통역을 합류 지점으로 선택

역 이름 매칭:
- 공백/특수문자 제거 후 비교
- "역" 접미사 정규화
- 동일 이름이 없으면 위경도 근접도(50m 이내)로 보완

## 4. Frontend UI

### 온보딩 (`/onboarding`)

소셜 로그인 → 커플 등록 → 본인 정보 입력(집 위치 필수, TMAP POI 검색) → 메인 화면.
집 위치 미입력 시 다음 단계 진행 불가.

### EventModal 개편

| 필드 | 입력 방식 | 필수 |
|------|-----------|------|
| 제목 | 텍스트 | O |
| 약속 시간 | 날짜+시간 picker | O |
| 장소 | TMAP POI 검색 자동완성 | X |
| 메모 | 텍스트 영역 | X |

### 일정 상세 (요약)

캘린더에서 일정 탭 시 모달에 경로 요약 표시:
- 출발 시간, 소요 시간, 환승 횟수
- 합류역 있으면: "OO역에서 OO님과 만남"
- "상세 경로 보기" 버튼

장소 또는 집 위치가 없으면 경로 안내 섹션 숨김.

### 상세 경로 화면

스텝별 경로 표시 (도보/버스/지하철 구간):
- 합류역에 "여기서 OO님 만남" + 파트너 출발 시간 표시
- 겹치는 경로 없을 때: 안내 메시지 + 본인 경로만 표시

### Settings > 내 정보

집 위치 TMAP POI 검색으로 수정 가능.

## 5. Caching Strategy

### 2단계 캐시

```
요청 → Redis (1차) → DB RouteCache (2차) → TMAP API 호출
```

캐시 키: `transit:couple-route:{sha256(eventId + appointmentAt + homes + place)}`

| 계층 | TTL |
|------|-----|
| Redis | 1시간 |
| DB RouteCache | 24시간 |

### 캐시 무효화

- 일정 수정 (장소/시간) → 해당 eventId의 RouteCache 삭제
- 집 위치 변경 → 해당 couple의 모든 RouteCache 삭제
- "경로 새로고침" 버튼 → 해당 건만 강제 갱신

기존 `transit:route:*` 캐시와 독립 운영.
