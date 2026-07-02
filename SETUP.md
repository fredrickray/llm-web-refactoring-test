# Developer Setup

## Prerequisites
- Node.js 22+
- pnpm 9.15 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)

## First-time setup
```bash
pnpm install
pnpm run proto:generate
pnpm run db:generate && pnpm run db:migrate && pnpm run db:seed
```

## Environment variables (optional for local dev)
| Variable | Default | Required in prod |
|----------|---------|------------------|
| `GRPC_JWT_SECRET` | dev fallback | Yes |
| `SESSION_SECRET` | dev fallback | Yes |
| `DATABASE_URL` | `file:./chirp.db` | No |

## Run services
```bash
pnpm run dev          # all services
pnpm run dev:api      # API only (ports 3001/50051)
pnpm run dev:user     # user app (port 3000)
pnpm run dev:admin    # admin app (port 3002)
```

## Test & validate
```bash
pnpm run typecheck    # TypeScript
pnpm run lint         # Biome
pnpm run test:unit    # Vitest
pnpm run build        # Production build
```

## Test accounts
- User: `alice@test.com` / `password123`
- Admin: `admin@chirp.com` / `admin123`

Pre-commit hooks run Biome on staged files automatically after `pnpm install`.
