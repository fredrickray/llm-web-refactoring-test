# Issue 5 Audit: Build Pipeline & DX

## CI pipeline
- Added `.github/workflows/ci.yml` — fail-fast steps: install → proto generate → typecheck → lint → unit tests → build
- Uses Turborepo `--filter='...[origin/main]'` to only validate changed packages and dependents

## Pre-commit hook
- Husky + lint-staged runs `biome check --write` on staged TS/JS/JSON files
- Fast enough for daily use (~seconds for typical commits)

## Turbo config fixes
- `test:e2e` — added `cache: false` (depends on live servers)
- `db:generate`, `db:migrate` — `cache: false` (schema changes must always run)
- `db:seed` — added `dependsOn: ["db:migrate"]`

## Developer setup guide
- See `SETUP.md` (under 50 lines)
