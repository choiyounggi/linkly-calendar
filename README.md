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

### Local Services (Docker, optional)

Use this if you want the API to connect to Postgres/Redis locally.

```bash
cp .env.example .env

docker compose up -d
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

### 🗄️ Database (Prisma)

**Schema overview**
- **User**: Social/local auth identities
- **Couple** + **CoupleMember**: Couple registration and membership
- **CoupleInvite**: Invitation/request flow (invite → accept/decline/expire)
- **CalendarEvent**: Shared couple events
- **Photo**: Shared gallery

**Migrations**

```bash
# Ensure DATABASE_URL is set (see .env.example)
DATABASE_URL=postgresql://linkly:linkly_local_password@localhost:5432/linkly?schema=public \
  npx prisma migrate dev --name init_schema_v1

npx prisma generate
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
