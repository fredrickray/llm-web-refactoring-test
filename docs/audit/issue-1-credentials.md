# Issue 1 Audit: Credential Storage & Trust Establishment

## Credential Storage Vulnerability

### What it is

Passwords were hashed with **SHA-256 and a hardcoded static salt** (`password + "salt"`) in `apps/api/src/services/utils.ts`.

### How it could be exploited

- SHA-256 is designed for speed, not password storage. Attackers with a database dump can brute-force or rainbow-table common passwords at billions of hashes per second.
- The static salt is identical for every user, so identical passwords produce identical hashes and precomputed tables remain effective.
- GPU/ASIC cracking makes weak user passwords recoverable in minutes to hours at scale.

### Severity

**Critical (CVSS ~9.0)** — Full credential compromise for any user with a weak or reused password once the `password_hash` column is exposed.

### Fix

- New passwords use **bcrypt** (cost factor 12).
- Legacy SHA-256 hashes are detected by format (`64` hex chars) and verified on login.
- On successful legacy login, the hash is **transparently upgraded** to bcrypt — no plaintext passwords required.
- Seeded users keep working: their stored SHA-256 hashes verify correctly and upgrade on first login.

---

## Trust Establishment Vulnerability

### What it is

Two related problems broke trust between client and API:

1. **Shared JWT signing on the BFF** — Client apps (`grpc.server.ts`) held the same `GRPC_JWT_SECRET` as the API and **re-minted JWTs** from cookie session data (`userId`, `username`, `role`). Anyone with the hardcoded default secret could forge tokens and call gRPC directly as any user, including admins.

2. **Hardcoded secrets & plaintext gRPC** — Default JWT/session secrets were committed in source. gRPC used `ServerCredentials.createInsecure()`, exposing tokens on the network in non-local deployments.

### How it could be exploited

- Read the default secret from the repo → forge a JWT with `role: "admin"` → call admin gRPC endpoints directly, bypassing the web UI.
- Intercept plaintext gRPC on a shared network → steal session tokens.
- Tamper with cookie session fields and have the BFF sign a new token (admin app included role from cookie, which could be manipulated if session encryption were broken).

### Severity

**Critical (CVSS ~9.8)** — Full account takeover and privilege escalation without valid credentials.

### Fix

- **API-only token issuance**: BFF stores the API-issued JWT from login/register in the encrypted httpOnly session cookie and passes it to gRPC unchanged. Clients no longer sign JWTs.
- **`GRPC_JWT_SECRET` required in production** — API refuses to start without it.
- gRPC TLS is enabled in production when cert/key material is supplied via `GRPC_TLS_CERT_PEM` / `GRPC_TLS_KEY_PEM` or `GRPC_TLS_CERT_PATH` / `GRPC_TLS_KEY_PATH`; otherwise production startup fails fast.
