# Judge evidence index

Start here when evaluating Scion from the repository. Each claim names inspectable evidence and its current status. “Sandbox” is deliberately not described as production.

## Eight-point audit

| # | Claim | Status | Evidence | Verify |
|---|---|---|---|---|
| 1 | Users authenticate with a NEAR wallet, not a demo persona. | Live | `src/core/near-wallet.ts`, `backend/src/nep413-auth.ts`, `backend/test/auth.test.ts` | `npm run test:backend`; connect from `/app`. |
| 2 | Scion discovers NEAR tokens and requests 1Click quotes without custody. | Live | `src/ui/LiveSwap.tsx`, `src/core/intents.ts`, `backend/src/near-balances.ts` | Open Trade and search a symbol or contract. A swap requires wallet approval. |
| 3 | Paid access follows independently verified NEAR settlement. | Live backend | `backend/src/near-transactions.ts`, `backend/src/service.ts`, `backend/test/near-transactions.test.ts` | Backend tests cover finality, signer, contract, recipients, amount, and replay. |
| 4 | Private access is cryptographic, not just hidden UI. | Protocol sandbox | `src/core/crypto.ts`, `src/core/engine.ts`, `src/core/policy.ts`, `tests/protocol.test.ts` | `npm test` covers encryption, re-sealing, expiry, revocation, and denial. |
| 5 | Forks preserve lineage and upstream economics. | Sandbox + persisted model | `src/core/engine.ts`, `backend/src/domain.ts`, `backend/db/schema.ts` | `npm test`; inspect lineage and settlement records. |
| 6 | Agents are user-owned and policy-bounded. | Live control plane; execution paused | `src/ui/LiveAgents.tsx`, `backend/src/service.ts`, `backend/aws/agent-runner.ts` | Create an agent; inspect limits, pause, and revoke. Runner has no DB/wallet access. |
| 7 | The flagship thesis is sourced and reproducible. | Reproducible snapshot | `THESIS.md`, `data/`, `src/core/thesisModel.ts`, `scripts/rerun-model.ts` | `npm run model`; vary an input. |
| 8 | Production isolates data and exposes observable services. | Deployed | `infra/template.yaml`, `infra/README.md`, `backend/openapi.yaml` | Visit `/api/v1/health`; inspect networking, alarms, backups, deletion protection. |

## Contradiction guardrails

- Seed activity is tagged **Demo**, carries `demo: true`, and is excluded from verified live performance.
- Live product and deterministic protocol sandbox are separate execution paths.
- Autonomous agent execution is **not active**. Accounts and policies are the shipped foundation.
- No TEE or NEAR AI Cloud attestation is claimed.
- NFT-shaped demo records are not claimed as live on-chain minting.
- AWS hosts the system; NEAR provides wallet identity, authorization, settlement, and Intents.

## Track evidence

### Unstoppable DeFi

`src/ui/LiveSwap.tsx` handles discovery, quote, review, and wallet approval. `src/core/intents.ts` separates live and deterministic adapters. `src/core/policy.ts` enforces follower limits. `backend/src/near-transactions.ts` independently verifies receipts.

Known gap: all 1Click terminal states, including failed/refunded deposits, should be prominent in transaction history. It is not claimed complete.

### Investment Thesis

`THESIS.md` contains claim, counterevidence, assumptions, and falsification. `data/` contains dated linked inputs. `npm run model` rebuilds the model with sensitivity overrides. `src/ui/Thesis.tsx` provides interactive exploration.

### AI Security & Defense

Agent policy covers allowed assets, per-trade/daily caps, allocation, slippage, and leverage. Proposal mode requires owner action. Bounded execution starts paused. The isolated runner lacks wallet/DB access; its output is revalidated. Owners can pause or revoke.

### Autonomous Business

Scion treats a strategy or user-owned agent as a constrained revenue-generating entity. `backend/src/service.ts` implements verified checkout, creator payment, protocol fee, and upstream royalty accounting; `backend/src/near-transactions.ts` verifies settlement; `backend/aws/agent-runner.ts` provides isolated research execution; and `src/ui/LiveAgents.tsx` exposes the owner's operating constraints and kill controls. Dedicated NEAR agent-account provisioning provides attributable identity.

Known gap: the official reference prompt asks for a complete autonomous sale-to-cost-to-payout loop. Scion's components and ledger model exist, but the fully autonomous loop and automatic attributable agent payout are not yet claimed as shipped.

### Agent Economy

Dedicated NEAR subaccount provisioning and user-owned agent identity are live. Automatic attributable earnings and autonomous spending remain future work.

### Open Innovation

Scion introduces a new ownership primitive for trading intelligence: an idea can remain private, be sold through scoped capabilities, produce public proofs, be forked under a different risk policy, and retain attribution and upstream economics across its descendants. This combines money, intelligence, privacy, and authorship rather than treating a strategy as either a static post or a custodial copy-trading account. The evidence spans `src/core/engine.ts`, `src/core/crypto.ts`, `src/core/policy.ts`, `src/ui/Lineage.tsx`, and the live commerce and execution paths.

## Commands

```bash
npm ci
npm run typecheck
npm test
npm run check:backend
npm run test:backend
npm run model
npm run build
```

Public endpoints: [site](https://scionhub.xyz), [app](https://scionhub.xyz/app), [docs](https://scionhub.xyz/docs), [health](https://scionhub.xyz/api/v1/health).
