# Scion API

API-first backend for versioned private strategies and scoped access.

## Run

Requires Node.js 24+ and no package installation.

```powershell
cd backend
npm test
npm start
```

For Postgres, set `DATABASE_URL` and run `npm run migrate` before starting the API.

The API listens on `http://localhost:8787`. Use `/v1/auth/challenge` and `/v1/auth/verify` to exchange a NEAR ed25519 wallet signature for a one-hour bearer session. The `x-near-account` development header is disabled in production unless `SCION_ALLOW_DEV_HEADER=true`.

## Implemented vertical slice

- Immutable strategy versions and exact parent links
- Public payloads that omit private positions and thesis content
- NEAR ed25519 wallet challenge verification and signed sessions
- Signed, subject-bound, scoped capability tokens
- Expiry and revocation checks
- Scoped field projection (assets can be revealed while sizes remain hidden)
- Fork creation with upstream attribution and royalty terms
- Deterministic follower-side execution policy evaluation
- Simulated NEAR Intents execution receipts behind an adapter
- Public lineage graph
- Structured errors, request IDs, and audit events

## Production boundaries

Without `DATABASE_URL`, local development uses the in-memory repository. With `DATABASE_URL`, the runtime uses Neon Postgres through `@neondatabase/serverless`; apply `migrations/001_initial.sql` first. Settlement contracts, encrypted object storage, and the live NEAR Intents/1Click API remain adapter boundaries.

See `openapi.yaml` for the frontend contract.
