# Issue 4 Audit: Test Infrastructure

## Findings

### Test isolation (fixed)

- **Problem**: All API test files shared a single `vi.mock("../src/db")` in-memory database. With `fileParallelism: true` (default), parallel test files raced in `beforeEach` DELETE statements → hook timeouts and `client.execute` undefined errors.
- **Fix**: Set `fileParallelism: false` in `apps/api/vitest.config.ts`. Each test file now runs sequentially against the shared mock safely.

### bcrypt slowness in tests (fixed)

- **Problem**: bcrypt cost 12 caused 5s+ timeouts when many tests hashed passwords concurrently.
- **Fix**: Use cost factor 4 when `process.env.VITEST` is set.

### Untested services

- `bookmarks.service.ts` — still covered by query-performance tests rather than a focused service-spec file
- Remaining client E2E failure-path coverage is still thin (network/API failure fallbacks)

### Untested error paths

- Handler tests mock services; real service error propagation untested for search, notifications, admin service layer
- Client E2E: no tests for network/API failure fallbacks

### Test helper patterns

- `createTestUser` etc. in `tests/helpers.ts` — good DRY pattern
- Handler tests over-mock `validateSessionToken` — discourages integration-style auth testing but keeps handler tests fast
- E2E tests rely on seeded DB state — acceptable for this project

## Changes made

1. `fileParallelism: false`, increased timeouts in API vitest config
2. Lower bcrypt cost in test environment
3. Added `auth.security.test.ts`, `query-performance.test.ts`, `tracing.test.ts`
4. Added focused service coverage for `mentions`, `search`, `notifications`, and `admin`
