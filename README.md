# Linkly Calendar

모바일/데스크톱에서 모두 사용할 수 있는 **커플 캘린더 웹앱**입니다.
공유 일정과 추억을 한곳에서 관리해, 두 사람이 더 잘 연결되도록 돕습니다.

## 💡 콘셉트
커플이 일상 일정을 함께 관리하고, 기념일을 챙기고, 대화를 이어갈 수 있는 통합 경험을 제공합니다.

## ✨ 주요 기능
- **캘린더**: 공유 일정/이벤트 관리
- **기념일**: 중요한 날짜와 마일스톤 추적
- **채팅**: 빠른 소통을 위한 경량 메시징
- **갤러리**: 사진/추억 공유
- **(예정) AI**: 스마트 추천 및 인사이트

## 🎨 디자인 방향
- 깔끔하고 단순한 UI
- 밝은 옐로우 테마 🍌

## 🧱 아키텍처
- **모노레포**: Turborepo
- **웹**: Next.js
- **API**: NestJS

## 🚍 대중교통 라우팅
- Tmap Transit API 명세: [`docs/transit/tmap.md`](docs/transit/tmap.md)

## 💬 채팅 팬아웃 (BullMQ + Redis Pub/Sub)
채팅 메시지는 큐 + Pub/Sub 브리지로 팬아웃됩니다.

1. **API**가 BullMQ `chat-fanout` 큐에 `{ coupleId, messageId }` 작업을 적재합니다.
2. **워커**가 작업을 소비해 Redis 채널 `chat:couple:{coupleId}`로 발행합니다.
3. **WebSocket 게이트웨이**가 Redis를 구독하고 `couple:{coupleId}` 룸에 `chat:message`를 전송합니다.
4. **클라이언트**는 `messageId` 기준으로 중복을 제거합니다(중복 작업 허용).

### 채팅 API (암호화)

**POST `/chat/messages`**

```bash
curl --request POST \
  --url http://localhost:3000/chat/messages \
  --header 'content-type: application/json' \
  --data '{
    "coupleId": "couple_123",
    "senderUserId": "user_123",
    "kind": "TEXT",
    "text": "안녕!",
    "sentAtMs": 1700000000000
  }'
```

**GET `/chat/messages`**

```bash
curl --request GET \
  --url "http://localhost:3000/chat/messages?coupleId=couple_123&userId=user_123&limit=50"
```

### 채팅 보안 메모
- 채팅 페이로드는 저장 시 **AES-256-GCM**으로 암호화됩니다.
- 환경 변수로 키를 설정합니다.
  - `CHAT_ENCRYPTION_KEYS`(권장): `version:base64Key` 쌍을 쉼표로 구분
    - 예: `CHAT_ENCRYPTION_KEYS=1:BASE64_KEY,2:BASE64_KEY`
  - `CHAT_ENCRYPTION_KEY_VERSION`: 신규 메시지에 사용할 활성 버전(기본 `1`)
  - `CHAT_ENCRYPTION_KEY`(레거시): 활성 버전 단일 base64/hex 키
- 키 길이는 반드시 **32바이트**여야 합니다(base64 또는 64자 hex).

### 채팅 WebSocket 하트비트
게이트웨이는 주기적으로 `chat:ping`을 보내고 `chat:pong` 응답을 기대합니다.
타임아웃 내 pong이 없으면 소켓 연결을 종료합니다.

선택 환경 변수:
- `CHAT_WS_PING_INTERVAL_MS` (기본 `25000`)
- `CHAT_WS_PONG_TIMEOUT_MS` (기본 `60000`)

## ✅ 현재 상태
- 로그인 UI 구현(소셜 인증 스켈레톤)
- 메인 레이아웃 + 하단 탭: Calendar / Chat / Photos / Settings
- Calendar 탭: FullCalendar + 모달 생성/수정/삭제(로컬 상태)
- Chat 탭: UI 스켈레톤 + 키보드 대응 전폭 입력바(로컬 상태)
- Photos 탭: 헤더 + 그리드 + 전체화면 뷰어 + 선택 삭제 + 로컬 업로드 + 무한 스크롤(로컬 상태)
- API: `/health` 엔드포인트(Postgres + Redis 상태 확인)
- DB: Prisma 스키마 v1 + 초기 마이그레이션(`init_schema_v1`)

---

## 🛠 기술 스택
- **모노레포**: [Turborepo](https://turbo.build/)
- **패키지 매니저**: [PNPM](https://pnpm.io/) (v9.12.0)
- **앱**
  - `web`: [Next.js](https://nextjs.org/) (프론트엔드)
  - `api`: [NestJS](https://nestjs.com/) (백엔드)
- **데이터베이스**: PostgreSQL (Prisma)
- **백엔드(NestJS)**
  - 큐/캐시: `@nestjs/bullmq`, `bullmq`, `ioredis`
  - 연동: `@googleapis/calendar`
  - ORM: `prisma`, `@prisma/client`
  - 검증: `zod`
  - 인증: `passport`, `@nestjs/passport`
- **프론트엔드(Next.js)**
  - 캘린더 UI: `@fullcalendar/*`
  - 폼: `react-hook-form`, `zod`
- **패키지**
  - `@linkly/ui`: 공통 UI 컴포넌트
  - `@linkly/config`: 공통 설정
  - `@linkly/shared`: 공통 유틸/타입

## 🚀 시작하기

### 사전 준비
- Node.js (v20+)
- PNPM (v9.12.0)

### 설치
```bash
pnpm install
```

### 개발 실행
```bash
pnpm dev
```

> `pnpm dev` 실행 시 로컬 인프라(`docker compose up -d`)가 자동 시작됩니다.

API는 `.env.local`을 우선 로드하고, 이후 `.env`를 로드합니다.
개발자 개인 비밀값은 `.env.local`에 두고 `.env`는 공통값 위주로 유지하세요.

### 채팅 암호화 환경 변수 런북(API)
API 시작 시 아래 오류가 나오면:

```text
CHAT_ENCRYPTION_KEYS or CHAT_ENCRYPTION_KEY must be set
```

다음 절차를 따르세요.

1. 환경 파일 초기화
```bash
pnpm init:env
```

2. 루트 `.env.local`(권장) 또는 `.env`에 변수 설정
```bash
# 권장(키 로테이션 지원)
CHAT_ENCRYPTION_KEYS=1:<base64-or-64hex-key>
CHAT_ENCRYPTION_KEY_VERSION=1

# 레거시 대체
# CHAT_ENCRYPTION_KEY=<base64-or-64hex-key>
```

3. API 재시작 (`pnpm dev` 또는 API 프로세스 재기동)

참고:
- API 환경 변수 우선순위: `.env.local` > `.env`
- 시작 로그에는 키 존재 여부만 안전하게 출력
- 키는 디코딩 기준 정확히 32바이트여야 함

점검 체크리스트:
- `apps/api/.env`가 아닌 **레포 루트** env 파일을 수정했는지 확인
- `CHAT_ENCRYPTION_KEYS`는 `version:key` 쌍의 쉼표 구분 형식인지 확인
- `CHAT_ENCRYPTION_KEY_VERSION`이 지정된 경우 해당 버전이 키 목록에 있는지 확인
- 필요 시 `pnpm init:env` 재실행

### 로컬 서비스(Docker)
수동으로 인프라를 관리하려면:

```bash
cp .env.example .env
pnpm infra:up
```

- Postgres: `localhost:5432`
- Redis: `localhost:6379`
- 기본 DB: `linkly` (user: `linkly`, password: `linkly_local_password`)

### 헬스 체크
API 실행(기본 `http://localhost:3000`) 후:

```bash
curl http://localhost:3000/health
```

예시 응답:

```json
{"ok":true,"postgres":"ok","redis":"ok","ts":"2024-01-01T00:00:00.000Z"}
```

### 🚍 대중교통(Tmap)
> `.env`에 `TMAP_APP_KEY`가 필요합니다.

**POST `/v1/transit/route:compute`**
```bash
curl --request POST \
  --url http://localhost:3000/v1/transit/route:compute \
  --header 'content-type: application/json' \
  --data '{
    "startX": "127.02550910860451",
    "startY": "37.63788539420793",
    "endX": "127.030406594109",
    "endY": "37.609094989686",
    "count": 1,
    "lang": 0,
    "format": "json"
  }'
```

**POST `/v1/transit/departures:compute`**
```bash
curl --request POST \
  --url http://localhost:3000/v1/transit/departures:compute \
  --header 'content-type: application/json' \
  --data '{
    "startX": "127.02550910860451",
    "startY": "37.63788539420793",
    "endX": "127.030406594109",
    "endY": "37.609094989686",
    "arrivalBy": true,
    "arrivalTime": "20240227120000",
    "count": 1,
    "lang": 0,
    "format": "json"
  }'
```

> departures 엔드포인트는 `arrivalBy` + `arrivalTime`/`departureTime`을 Tmap 공개 문서 기준 `reqDttm`으로 매핑합니다.

### 🗄️ 데이터베이스(Prisma)
**스키마 개요**
- **User**: 소셜/로컬 인증 + 선택적 집 위치
- **Couple** + **CoupleMember**: 커플 등록/멤버십
- **CoupleInvite**: 초대/수락/거절/만료 흐름
- **CalendarEvent**: 커플 공유 이벤트 + 선택적 만남 위치
- **GalleryPhoto**: 공유 갤러리 사진(DB `Photo` 테이블)
- **ChatMessage**: 커플 채팅 메시지(암호화 페이로드 + 키 버전 + ms 타임스탬프)

**마이그레이션**
```bash
DATABASE_URL=postgresql://linkly:linkly_local_password@localhost:5432/linkly?schema=public \
  npx prisma migrate dev --name init_schema_v1

npx prisma generate
```

**시드 데이터(자동)**
`docker compose up -d` 시 `db-init` 원샷 서비스가 마이그레이션 + 시드를 수행합니다.

- `db-init` 컨테이너는 `/workspace/node_modules`(및 `.pnpm-store`)를 익명 볼륨으로 사용해, 컨테이너 설치물이 호스트 워크스페이스를 오염시키지 않도록 합니다.
- 사용자: `linkly.one@example.com`, `linkly.two@example.com`
- 커플 상태: `ACTIVE`
- 채팅: 텍스트/이미지 메시지 샘플
- 갤러리: 사진 2개

재시드:
```bash
docker compose down -v
pnpm infra:up
```

> 참고: 현재 `CoupleMember.userId`는 **사용자당 1개 커플**을 강제하는 unique 제약이 있습니다. 다중 커플 소속이 필요하면 제약 제거가 필요합니다.

### 참고 / 제한사항
- 캘린더/채팅/사진은 현재 **로컬 상태 기반**입니다(서버 영속화 미적용).
- 사진 업로드는 클라이언트 로컬 저장 방식입니다(백엔드 저장소 미연동).
- API 헬스체크는 env 기반 Postgres/Redis 연결을 전제로 합니다.

### 빌드
```bash
pnpm build
```

### 린트
```bash
pnpm lint
```
