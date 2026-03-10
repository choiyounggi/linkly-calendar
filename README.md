# Linkly Calendar

모바일/데스크톱에서 모두 사용할 수 있는 **커플 캘린더 웹앱**입니다.
공유 일정과 추억을 한곳에서 관리해, 두 사람이 더 잘 연결되도록 돕습니다.

## 콘셉트
커플이 일상 일정을 함께 관리하고, 기념일을 챙기고, 대화를 이어갈 수 있는 통합 경험을 제공합니다.

## 주요 기능

| 기능 | 설명 | 상태 |
|------|------|------|
| **캘린더** | 공유 일정 CRUD, 날짜별 목록 모달, 이벤트 미리보기 | 구현 완료 |
| **커플 경로 안내** | 각자 집에서 약속 장소까지 최적 환승역 자동 분석 | 구현 완료 |
| **장소 검색 (POI)** | Tmap POI 검색 기반 약속 장소 자동완성 입력 | 구현 완료 |
| **채팅** | AES-256-GCM 암호화 실시간 메시징 (WebSocket + BullMQ) | 구현 완료 |
| **갤러리** | SHA-256 해시 파일 저장, 업로드/삭제, 무한 스크롤, 라이트박스 | 구현 완료 |
| **설정** | 커플 정보 (이름·생일·만난날·집주소), 내 정보, 커플 끊기 | 구현 완료 |
| **AI** | 스마트 추천 및 인사이트 | 예정 |

## 디자인 방향
- 깔끔하고 단순한 UI
- 밝은 옐로우 테마

---

## 아키텍처

```
linkly-calendar/                 # Turborepo 모노레포
├── apps/
│   ├── api/                     # NestJS 백엔드 (포트 3001)
│   │   └── src/
│   │       ├── chat/            # 채팅 (암호화, WebSocket, BullMQ 팬아웃)
│   │       ├── chat-fanout/     # BullMQ 워커 + Redis Pub/Sub 브리지
│   │       ├── couple/          # 커플 정보 조회/수정, 커플 끊기
│   │       ├── event/           # 이벤트 CRUD + 경로 캐시 무효화
│   │       ├── gallery/         # 사진 업로드/조회/삭제 (SHA-256 해시 파일명)
│   │       ├── transit/         # Tmap 대중교통, POI 검색, 커플 경로 분석
│   │       ├── user/            # 사용자 프로필 (이름, 생일, 집 위치)
│   │       ├── prisma/          # Prisma 서비스
│   │       └── redis/           # Redis 연결 모듈
│   └── web/                     # Next.js 프론트엔드 (포트 3000)
│       └── src/
│           ├── app/main/components/
│           │   ├── CalendarTab     # FullCalendar + 날짜별 이벤트 관리
│           │   ├── ChatTab         # 실시간 채팅 UI
│           │   ├── PhotosTab       # 갤러리 그리드 + 라이트박스 + 선택 삭제
│           │   ├── SettingsTab     # 커플 정보 + 내 정보 + 커플 끊기
│           │   ├── EventModal      # 이벤트 생성/수정 모달 + POI 검색
│           │   ├── PoiSearchInput  # 장소 자동완성 드롭다운
│           │   ├── RouteSummary    # 경로 요약 (만남역, 출발 시간)
│           │   └── RouteDetail     # 구간별 상세 경로
│           └── hooks/
│               ├── useEvents       # 이벤트 CRUD + 낙관적 업데이트
│               ├── usePhotos       # 사진 업로드/조회/삭제 + 커서 페이지네이션
│               ├── useCouple       # 커플 정보 조회/수정/끊기
│               ├── useUserProfile  # 내 정보 조회/수정
│               ├── useCoupleRoute  # 커플 경로 분석 + 캐시 갱신
│               └── usePoiSearch    # 디바운스 POI 검색 + 요청 취소
├── packages/
│   ├── shared/                  # @linkly/shared (채팅 상수/타입)
│   └── config/                  # @linkly/config (공통 설정)
├── prisma/                      # Prisma 스키마 + 마이그레이션 + 시드
├── uploads/                     # 업로드 파일 저장소 (git 미추적)
└── docker-compose.yml           # Postgres + Redis + db-init
```

## 기술 스택

| 분류 | 기술 |
|------|------|
| **모노레포** | [Turborepo](https://turbo.build/) |
| **패키지 매니저** | [PNPM](https://pnpm.io/) v9.12.0 |
| **프론트엔드** | [Next.js](https://nextjs.org/), React 19, FullCalendar |
| **백엔드** | [NestJS](https://nestjs.com/), Prisma, Multer |
| **데이터베이스** | PostgreSQL 16 (Prisma ORM) |
| **캐시/큐** | Redis 7, BullMQ, ioredis |
| **실시간** | Socket.IO (WebSocket + Redis Pub/Sub) |
| **보안** | Helmet, CORS 허용 목록, ThrottlerGuard, AES-256-GCM |
| **외부 API** | Tmap Transit API, Tmap POI 검색 |

---

## 시작하기

### 사전 준비
- Node.js v20+
- PNPM v9.12.0
- Docker & Docker Compose

### 설치 및 실행
```bash
pnpm install
pnpm init:env          # .env.example 기반으로 .env.local 생성 (최초 1회)
pnpm dev               # prisma generate + docker compose up + 앱 실행
```

> **최초 실행 시 반드시 `pnpm init:env`를 먼저 실행하세요.**
> `.env.example`의 모든 변수를 `.env.local`에 복사하고, 채팅 암호화 키를 자동 생성합니다.

API는 `.env.local`을 우선 로드하고, 이후 `.env`를 로드합니다.
개발자 개인 비밀값은 `.env.local`에 두세요.

### 로컬 인프라 (Docker)
```bash
pnpm infra:up          # Postgres + Redis + db-init (마이그레이션 + 시드)
pnpm infra:down        # 인프라 중지
```

- **Postgres**: `localhost:5432` (user: `linkly`, password: `linkly_local_password`, db: `linkly`)
- **Redis**: `localhost:6379`

### 스키마 변경 반영
```bash
npx prisma db push     # 스키마를 DB에 직접 반영 (개발용)
npx prisma generate    # Prisma 클라이언트 재생성
```

### 헬스 체크
```bash
curl http://localhost:3001/health
# {"ok":true,"postgres":"ok","redis":"ok","ts":"..."}
```

### 빌드 / 린트
```bash
pnpm build
pnpm lint
```

---

## API 엔드포인트

### 이벤트 (Event CRUD)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/v1/events` | 이벤트 생성 (장소, 약속 시간 포함) |
| `GET` | `/v1/events?coupleId=&month=YYYY-MM&userId=` | 월별 이벤트 조회 |
| `GET` | `/v1/events/:id?userId=` | 단건 조회 |
| `PATCH` | `/v1/events/:id?userId=` | 이벤트 수정 (경로 캐시 자동 무효화) |
| `DELETE` | `/v1/events/:id?userId=` | 이벤트 삭제 (경로 캐시 자동 삭제) |

### 커플 정보

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/v1/couples/:id?userId=` | 커플 정보 조회 (멤버 이름·생일·집주소, 만난 날짜) |
| `PATCH` | `/v1/couples/:id?userId=` | 커플 정보 수정 (만난 날짜, 나/상대 닉네임) |
| `DELETE` | `/v1/couples/:id?userId=` | 커플 끊기 (cascade 전체 삭제) |

### 갤러리 (사진)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/v1/photos` | 사진 업로드 (multipart, 최대 20장, 파일당 10MB) |
| `GET` | `/v1/photos?coupleId=&userId=&cursor=&take=` | 사진 목록 (커서 페이지네이션) |
| `DELETE` | `/v1/photos/:id?userId=` | 단건 삭제 (DB + 파일 하드 딜리트) |
| `DELETE` | `/v1/photos` | 일괄 삭제 (body: `{ ids, userId }`) |

업로드된 사진은 `uploads/photos/` 디렉토리에 SHA-256 해시 파일명으로 저장되고,
`/uploads/photos/{hash}.ext` 경로로 정적 서빙됩니다.

### 커플 경로 안내

**`POST /v1/transit/couple-route`**
```json
{
  "eventId": "이벤트 ID",
  "userId": "요청 사용자 ID",
  "forceRefresh": false
}
```

응답:
- `type`: `"meetup"` (겹치는 환승역 발견) 또는 `"individual"` (개별 경로)
- `meetupStation`: `{ name, lat, lng }` (meetup인 경우)
- `myRoute`: `{ departureTime, totalTime, transferCount, legs }`
- `partnerDepartureTime`: 파트너 출발 시간

캐싱: Redis 1시간 + DB 24시간 2계층 캐시, 이벤트/집 위치 변경 시 자동 무효화

### POI 검색

**`GET /v1/transit/poi/search?keyword=강남역&page=1`**

Tmap POI 검색 API를 통한 장소 자동완성

### 대중교통 경로

**`POST /v1/transit/route:compute`**
```json
{
  "startX": "127.025",
  "startY": "37.637",
  "endX": "127.030",
  "endY": "37.609",
  "count": 1,
  "lang": 0,
  "format": "json"
}
```

**`POST /v1/transit/departures:compute`** — `arrivalBy` + `arrivalTime`/`departureTime` 지원

### 사용자 프로필

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/v1/users/me?userId=` | 내 프로필 조회 (이름, 생일, 집 위치 등) |
| `PATCH` | `/v1/users/me?userId=` | 프로필 수정 (이름, 생일, 집 위치, 경로 캐시 무효화) |

### 채팅

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/chat/messages` | 메시지 전송 (서버에서 AES-256-GCM 암호화 후 저장) |
| `GET` | `/chat/messages?coupleId=&userId=&limit=` | 메시지 조회 (복호화 후 반환) |
| `GET` | `/chat/identity?providerUserId=` | 사용자 식별자 조회 |

---

## 채팅 아키텍처

### 팬아웃 (BullMQ + Redis Pub/Sub)
1. **API**가 BullMQ `chat-fanout` 큐에 `{ coupleId, messageId }` 작업을 적재
2. **워커**가 작업을 소비해 Redis 채널 `chat:couple:{coupleId}`로 발행
3. **WebSocket 게이트웨이**가 Redis를 구독하고 `couple:{coupleId}` 룸에 전송
4. **클라이언트**는 `messageId` 기준으로 중복 제거

### 암호화
- **AES-256-GCM**으로 저장 시 암호화
- `CHAT_ENCRYPTION_KEYS`: `version:base64Key` 쌍을 쉼표로 구분 (키 로테이션 지원)
- `CHAT_ENCRYPTION_KEY_VERSION`: 신규 메시지에 사용할 활성 버전 (기본 `1`)
- 키 길이는 반드시 **32바이트** (base64 또는 64자 hex)

### WebSocket 하트비트
- `chat:ping` → `chat:pong` 응답 확인
- `CHAT_WS_PING_INTERVAL_MS` (기본 `25000`)
- `CHAT_WS_PONG_TIMEOUT_MS` (기본 `60000`)

---

## 보안

| 항목 | 설정 |
|------|------|
| **HTTP 헤더** | Helmet 미들웨어 (`crossOriginResourcePolicy: cross-origin`) |
| **CORS** | `CORS_ORIGINS` 환경 변수 기반 허용 목록 |
| **Rate Limiting** | short: 10req/1s, medium: 100req/60s (ThrottlerGuard) |
| **채팅 암호화** | AES-256-GCM + 키 버전 로테이션 |
| **파일 업로드** | Multer (파일당 10MB, 요청당 20장 제한) |

---

## 데이터베이스 (Prisma)

### 스키마 개요

| 모델 | 설명 |
|------|------|
| `User` | 소셜/로컬 인증, 생일, 집 위치 (`homeLat`, `homeLng`, `homeAddress`) |
| `Couple` | 커플 상태, 만난 날짜 (`anniversaryDate`) |
| `CoupleMember` | 커플 멤버십, 별칭 (`nickname`), 역할 (사용자당 1개 커플 제약) |
| `CoupleInvite` | 초대/수락/거절/만료 흐름 |
| `CalendarEvent` | 커플 공유 이벤트 (장소 좌표, 약속 시간 포함) |
| `RouteCache` | 경로 분석 결과 DB 캐시 (24시간 TTL) |
| `GalleryPhoto` | 공유 갤러리 사진 (DB 테이블명: `Photo`) |
| `ChatMessage` | 암호화 채팅 메시지 (ciphertext + iv + tag + keyVersion) |

### 마이그레이션
```bash
DATABASE_URL=postgresql://linkly:linkly_local_password@localhost:5432/linkly?schema=public \
  npx prisma migrate dev --name <migration_name>

npx prisma generate
```

### 시드 데이터
`docker compose up -d` 시 `db-init` 서비스가 마이그레이션 + 시드를 자동 수행합니다.

- 사용자: `linkly.one@example.com`, `linkly.two@example.com`
- 커플 상태: `ACTIVE`
- 채팅: 텍스트/이미지 메시지 샘플
- 갤러리: 사진 2개

재시드: `docker compose down -v && pnpm infra:up`

---

## 환경 변수

`.env.example` 참조. 주요 항목:

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 연결 문자열 | (필수) |
| `REDIS_HOST` / `REDIS_PORT` | Redis 연결 | `localhost:6379` |
| `TMAP_APP_KEY` | Tmap API 키 | (필수, 경로/POI 검색용) |
| `CHAT_ENCRYPTION_KEYS` | 채팅 암호화 키 (`ver:base64Key`) | (필수) |
| `CHAT_ENCRYPTION_KEY_VERSION` | 활성 키 버전 | `1` |
| `CORS_ORIGINS` | 허용 Origin 목록 (쉼표 구분) | `http://localhost:3000,http://localhost:3001` |
| `PORT` | API 포트 | `3001` |
| `NEXT_PUBLIC_API_URL` | 프론트엔드 API 주소 | `http://localhost:3001` |

---

## 참고 / 제한사항
- 사진은 `uploads/photos/` 디렉토리에 SHA-256 해시 파일명으로 로컬 저장됩니다. S3 등 외부 저장소 미연동.
- `CoupleMember.userId`는 **사용자당 1개 커플**을 강제하는 unique 제약이 있습니다.
- 인증은 아직 스켈레톤 수준입니다 (userId를 쿼리 파라미터로 전달).
- 커플 끊기 시 Couple 레코드 삭제로 일정·사진·채팅 등 모든 관련 데이터가 cascade 삭제됩니다.
