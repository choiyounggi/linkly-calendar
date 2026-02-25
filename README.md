# Linkly Calendar

AI-driven calendar project for smart scheduling and management.

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

### Build

To build all apps and packages:

```bash
pnpm build
```

### Development

To start the development server for all apps:

```bash
pnpm dev
```

## 📝 Change Log

- **2026-02-25**: 
  - Initial setup configuration.
  - Enforced `packageManager` to `pnpm@9.12.0`.
  - Migrated `turbo.json` to v2 schema (`pipeline` -> `tasks`).
