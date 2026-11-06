# Scion

**Private strategies. Public lineage.**

Scion is a privacy-native social network and protocol for executable investment strategies on NEAR. Creators publish versioned strategy objects, sell scoped access, and earn when followers fork their work. Followers keep custody and execute with their own limits.

## Demo

The first vertical slice is a deterministic, browser-local simulation of the complete Alice → Bob flow:

1. Alice publishes a private cross-chain strategy and thesis.
2. A confidential NEAR Intents execution is simulated and a public proof receipt updates performance.
3. Bob buys a 15-minute View + Fork capability for 0.10 USDC.
4. Bob sees only the fields granted by the capability.
5. Bob forks the strategy, changes allocation and drawdown limits, then executes from his own wallet.
6. Alice receives the configured royalty.
7. The key can be revoked or allowed to expire; the public lineage remains visible without positions.

The UI labels all simulated integrations. No real funds move in this slice.

## Run locally

Serve `dist/` with any static server, for example:

```powershell
npx serve dist
```

Or open `dist/index.html` directly.

## Backend

The API-first backend lives in `backend/`. It implements strategy versions, scoped capabilities, field-level projection, forks and attribution, follower policy evaluation, simulated NEAR Intents receipts, revocation, and public lineage. It runs on Node.js 24 without installing dependencies:

```powershell
cd backend
npm test
npm start
```

The frontend contract is documented in `backend/openapi.yaml`. Supabase Postgres persistence and NEAR wallet-signature verification are implemented. Settlement contracts, encrypted object storage, and live NEAR Intents execution remain adapter boundaries rather than being falsely represented as production integrations.

## Project foundations

See [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md), [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DATA_MODEL.md](docs/DATA_MODEL.md), [docs/SCREEN_MAP.md](docs/SCREEN_MAP.md), and [docs/MILESTONES.md](docs/MILESTONES.md).

## Honest integration boundary

Implemented now: strategy state machine, Supabase persistence, NEAR wallet sessions, capability scopes, field-level disclosure, fork lineage, capability-gated execution, hash-bound manual confirmation, local policy checks, simulated receipts, royalty accounting, revocation and expiry.

Next production integrations: NEAR wallet signing, 1Click/NEAR Intents quote and execution, chain-indexed proof attestations, encrypted object storage, smart-contract settlement, and confidential-compute inference.
