# Veilbranch

**Private strategies. Public lineage.**

Veilbranch is a privacy-native social network and protocol for executable investment strategies on NEAR. Creators publish versioned strategy objects, sell scoped access, and earn when followers fork their work. Followers keep custody and execute with their own limits.

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

## Project foundations

See [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md), [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DATA_MODEL.md](docs/DATA_MODEL.md), [docs/SCREEN_MAP.md](docs/SCREEN_MAP.md), and [docs/MILESTONES.md](docs/MILESTONES.md).

## Honest integration boundary

Implemented now: strategy state machine, capability scopes, field-level disclosure, fork lineage, local policy checks, simulated receipts, royalty accounting, revocation and expiry.

Next production integrations: NEAR wallet signing, 1Click/NEAR Intents quote and execution, chain-indexed proof attestations, encrypted object storage, smart-contract settlement, and confidential-compute inference.
