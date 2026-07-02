# Issue 3 Audit: Error Handling & Observability

## Handler error strategies (before)

| Handler | Strategy | Examples |
|---------|----------|----------|
| **auth** | Mixed: try/catch → `{ success: false, error }` for login/register; **throws** for getCurrentUser | Registration failures returned; invalid session throws |
| **posts** | try/catch → `{ success: false, error }` for mutations; **throws** from service on getPost | createPost returns error object; getPost throws |
| **comments** | Same as posts | createComment returns error; getPostComments throws from service |
| **likes** | try/catch → `{ success: false, error }` | All mutations return error objects |
| **follows** | try/catch → `{ success: false, error }` | |
| **feed** | **Throws** from validateSessionToken (no try/catch) | getHomeFeed throws on bad token |
| **bookmarks** | try/catch → `{ success: false, error }` | |
| **notifications** | try/catch → `{ success: false, error }` | |
| **search** | Silent ignore invalid token; service throws on errors | |
| **users** | Silent ignore invalid token; updateProfile returns/throws | |
| **admin** | **Throws** on auth failure; try/catch → `{ success: false }` for operations | listUsers throws; banUser returns error object |

## Unified error taxonomy

Implemented in `apps/api/src/errors/app-error.ts`:
- `ErrorCode` enum: UNAUTHENTICATED, UNAUTHORIZED, NOT_FOUND, ALREADY_EXISTS, INVALID_ARGUMENT, FAILED_PRECONDITION, INTERNAL
- Maps to gRPC status codes (16, 7, 5, 6, 3, 9, 13)
- `classifyError()` infers code from message patterns without changing response bodies

## Request tracing & structured logging

- `request-context.ts` — AsyncLocalStorage with unique `traceId` per gRPC call
- `logger.ts` — JSON structured logs with traceId, service, method, durationMs
- `handler-wrapper.ts` — wraps every handler method; logs start/success/error
- `server.ts` — returns `x-trace-id` in gRPC response metadata

**Response contracts preserved**: success/error payloads unchanged; traceId sent via metadata only.
