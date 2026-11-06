# Veilbranch API

API-first backend for versioned private strategies and scoped access.

## Run

Requires Node.js 24+ and no package installation.

```powershell
cd backend
npm test
npm start
```

The API listens on `http://localhost:8787`. Authentication is deliberately replaceable in this slice: send `x-near-account: alice.near` or `x-near-account: bob.near`. Production replaces that header with a verified NEAR wallet challenge/signature session.

## Implemented vertical slice

- Immutable strategy versions and exact parent links
- Public payloads that omit private positions and thesis content
- Signed, subject-bound, scoped capability tokens
- Expiry and revocation checks
- Scoped field projection (assets can be revealed while sizes remain hidden)
- Fork creation with upstream attribution and royalty terms
- Deterministic follower-side execution policy evaluation
- Simulated NEAR Intents execution receipts behind an adapter
- Public lineage graph
- Structured errors, request IDs, and audit events

## Production boundaries

`MemoryRepository` is only for local development and tests. The domain layer depends on repository, payment, and execution ports. The next adapters should be Postgres, a NEAR wallet-signature verifier, a settlement contract, encrypted object storage, and the live NEAR Intents/1Click API.

See `openapi.yaml` for the frontend contract.
