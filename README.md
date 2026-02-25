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

---

## 🛠 Tech Stack

- **Monorepo**: [Turborepo](https://turbo.build/)
- **Package Manager**: [PNPM](https://pnpm.io/) (v9.12.0)
- **Apps**:
  - `web`: [Next.js](https://nextjs.org/) (Frontend)
  - `api`: [NestJS](https://nestjs.com/) (Backend)
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

### Build

```bash
pnpm build
```

### Lint

```bash
pnpm lint
```
