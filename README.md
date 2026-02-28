# Linkly Calendar

A **Couples Calendar Web App** designed for both **mobile and desktop**, helping partners stay connected with shared schedules and memories.

## 💡 Concept
A shared calendar experience for couples to manage day‑to‑day plans, celebrate milestones, and keep in touch — all in one place.

## ✨ Key Features
- **Calendar**: Shared schedules and events
- **Anniversary**: Track important dates and milestones
- **Chat**: Lightweight messaging for quick updates
- **Gallery**: Shared memories and photos
- **(Future) AI**: Smart suggestions and insights

## 🎨 Design Direction
- **Clean & Simple** UI
- **Bright Yellow Theme** 🍌

## 🧱 Architecture
- **Monorepo**: Turborepo
- **Web**: Next.js
- **API**: NestJS

## 🚍 Transit Routing

- Tmap Transit API spec: [`docs/transit/tmap.md`](docs/transit/tmap.md)

## 💬 Chat Fanout (BullMQ + Redis Pub/Sub)

Chat messages are fanned out through a queue + Pub/Sub bridge:

1. **API** enqueues a job in BullMQ queue `chat-fanout` with `{ coupleId, messageId }`.
2. **Worker** consumes the job and publishes to Redis channel `chat:couple:{coupleId}`.
3. **WebSocket gateway** subscribes to Redis and emits `chat:message` to room `couple:{coupleId}`.
4. **Clients** de-dupe by `messageId` (duplicate jobs are OK).

### Chat API (Encrypted)

**POST `/chat/messages`**

```bash
curl --request POST \
  --url http://localhost:3000/chat/messages \
  --header 'content-type: application/json' \
  --data '{
    "coupleId": "couple_123",
    "senderUserId": "user_123",
    "kind": "TEXT",
    "text": "Hello!",
    "sentAtMs": 1700000000000
  }'
```

**GET `/chat/messages`**

```bash
curl --request GET \
  --url "http://localhost:3000/chat/messages?coupleId=couple_123&userId=user_123&limit=50"
```

### Chat Security Notes

- Chat payloads are encrypted at rest using **AES-256-GCM**.
- Configure keys via environment variables:
  - `CHAT_ENCRYPTION_KEYS` (preferred): comma-delimited `version:base64Key` pairs
    - Example: `CHAT_ENCRYPTION_KEYS=1:BASE64_KEY,2:BASE64_KEY`
  - `CHAT_ENCRYPTION_KEY_VERSION`: active version for new messages (default `1`)
  - `CHAT_ENCRYPTION_KEY` (legacy fallback): single base64/hex key for the active version
- Keys must be **32 bytes** (base64 or 64-char hex).

### Chat WebSocket Heartbeat

The chat gateway sends periodic `chat:ping` events and expects `chat:pong` replies.
Sockets are disconnected if a pong is not received within the timeout window.

Environment variables (optional):

- `CHAT_WS_PING_INTERVAL_MS` (default `25000`)
- `CHAT_WS_PONG_TIMEOUT_MS` (default `60000`)

## ✅ Current Status
- **Login UI implemented** (social auth shells)
- **Main layout + bottom tabs**: Calendar / Chat / Photos / Settings
- **Calendar tab**: FullCalendar with modal create/edit/delete (local state)
- **Chat tab**: UI skeleton + keyboard‑aware, full‑width input bar (local state)
- **Photos tab**: header + grid + fullscreen viewer + select‑mode delete + local upload + infinite scroll (local state)
- **API**: `/health` endpoint checks Postgres + Redis availability
- **DB**: Prisma schema v1 + initial migration (`init_schema_v1`)

---

## 🛠 Tech Stack

- **Monorepo**: [Turborepo](https://turbo.build/)
- **Package Manager**: [PNPM](https://pnpm.io/) (v9.12.0)
- **Apps**:
  - `web`: [Next.js](https://nextjs.org/) (Frontend)
  - `api`: [NestJS](https://nestjs.com/) (Backend)
- **Database**: PostgreSQL (Prisma)
- **Backend (NestJS)**:
  - **Queue & Cache**: `@nestjs/bullmq`, `bullmq`, `ioredis` (For schedule notifications, chat)
  - **Integration**: `@googleapis/calendar` (Google Calendar)
  - **ORM**: `prisma`, `@prisma/client`
  - **Validation**: `zod` (Shared validation between FE/BE)
  - **Auth**: `passport`, `@nestjs/passport` (Optional/Custom OAuth implementation)
- **Frontend (Next.js)**:
  - **Calendar UI**: `@fullcalendar/*`
  - **Forms**: `react-hook-form`, `zod`
- **Packages**:
  - `@linkly/ui`: Shared UI components
  - `@linkly/config`: Shared configuration (TypeScript, ESLint, etc.)
  - `@linkly/shared`: Shared utilities and types

## 🚀 Getting Started

### Prerequisites

- Node.js (v20+)
- PNPM (v9.12.0)

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

> `pnpm dev` now starts the local infra automatically (`docker compose up -d`).

The API loads environment variables from `.env.local` first, then `.env`.
Use `.env.local` for developer-specific secrets and keep `.env` shared.


### Chat encryption env runbook (API)

If API startup fails with:

```
CHAT_ENCRYPTION_KEYS or CHAT_ENCRYPTION_KEY must be set
```

use this runbook:

1. Initialize env files:

```bash
pnpm init:env
```

2. Set one of these variables in repo-root `.env.local` (preferred) or `.env`:

```bash
# preferred (supports rotation)
CHAT_ENCRYPTION_KEYS=1:<base64-or-64hex-key>
CHAT_ENCRYPTION_KEY_VERSION=1

# legacy fallback
# CHAT_ENCRYPTION_KEY=<base64-or-64hex-key>
```

3. Restart API (`pnpm dev` or API process).

Notes:
- API env loading is deterministic from repo root with precedence: `.env.local` > `.env`.
- Startup logs only a safe boolean for key presence: whether `CHAT_ENCRYPTION_KEYS` exists.
- Keys must decode to exactly 32 bytes.

Troubleshooting checklist:
- Confirm you edited the **repo root** env file, not `apps/api/.env`.
- If `CHAT_ENCRYPTION_KEYS` is set, verify format is comma-delimited `version:key` pairs (e.g. `1:...`, `2:...`).
- If `CHAT_ENCRYPTION_KEY_VERSION` is set, ensure that version exists in `CHAT_ENCRYPTION_KEYS`.
- Re-run `pnpm init:env` to regenerate missing defaults.

### Local Services (Docker)

If you want to manage infra manually:

```bash
cp .env.example .env

pnpm infra:up
```

- Postgres: `localhost:5432`
- Redis: `localhost:6379`
- Default DB: `linkly` (user: `linkly`, password: `linkly_local_password`)

### Health Check

When the API is running (default `http://localhost:3000`):

```bash
curl http://localhost:3000/health
```

Response example:

```json
{"ok":true,"postgres":"ok","redis":"ok","ts":"2024-01-01T00:00:00.000Z"}
```

### 🚍 Transit (Tmap)

> Requires `TMAP_APP_KEY` in your `.env`.

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

> The departures endpoint maps `arrivalBy` + `arrivalTime`/`departureTime` into
> `reqDttm` per the public Tmap Transit docs: https://transit.tmapmobility.com/guide/procedure

### 🗄️ Database (Prisma)

**Schema overview**
- **User**: Social/local auth identities + optional home location (homeLat/homeLng/homeAddress/homeUpdatedAt)
- **Couple** + **CoupleMember**: Couple registration and membership
- **CoupleInvite**: Invitation/request flow (invite → accept/decline/expire)
- **CalendarEvent**: Shared couple events (title/place/expectedSchedule/detail + legacy description) + optional meetup point (meetupLat/meetupLng/meetupName/meetupNote)
- **GalleryPhoto**: Shared gallery photos (stored in DB table `Photo`)
- **ChatMessage**: Couple chat messages (encrypted payload: ciphertext/iv/tag + keyVersion, ms timestamp)

**Migrations**

```bash
# Ensure DATABASE_URL is set (see .env.example)
DATABASE_URL=postgresql://linkly:linkly_local_password@localhost:5432/linkly?schema=public \
  npx prisma migrate dev --name init_schema_v1

npx prisma generate
```

**Seed data (automatic)**

`docker compose up -d` runs a one-shot `db-init` service that applies migrations and seeds:

- The `db-init` container uses **anonymous volumes** for `/workspace/node_modules` (and `.pnpm-store`) so container installs don’t write into the host workspace (prevents cross-OS/arch node_modules issues).

- Users: `linkly.one@example.com`, `linkly.two@example.com`
- Couple: status `ACTIVE`
- Chat: a few text + image messages
- Gallery: 2 photos

To reseed:

```bash
docker compose down -v
pnpm infra:up
```

> Note: `CoupleMember` currently has a unique constraint on `userId` to enforce **one couple per user**. Remove that constraint if multi-couple memberships are desired.

### Notes / Limitations

- Calendar, chat, and photos currently use **local-only state** (no server persistence yet).
- Photo uploads are stored locally in the client (no backend storage).
- API health check expects Postgres + Redis to be reachable via env (`POSTGRES_HOST/PORT`, `REDIS_HOST/PORT`).

### Build

```bash
pnpm build
```

### Lint

```bash
pnpm lint
```
