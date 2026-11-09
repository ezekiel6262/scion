# Judge evidence index

Start here when evaluating Scion from the repository. Each claim names inspectable evidence and its current status. “Sandbox” is deliberately not described as production.

## Eight-point audit

| # | Claim | Status | Evidence | Verify |
|---|---|---|---|---|
| 1 | Users authenticate with a NEAR wallet, not a demo persona. | Live | `src/core/near-wallet.ts`, `backend/src/nep413-auth.ts`, `backend/test/auth.test.ts` | `npm run test:backend`; connect from `/app`. |
| 2 | Scion discovers NEAR tokens and requests 1Click quotes without custody. | Live | `src/ui/LiveSwap.tsx`, `src/core/intents.ts`, `backend/src/near-balances.ts` | Open Trade and search a symbol or contract. A swap requires wallet approval. |
| 3 | Paid access follows independently verified NEAR settlement. | Live backend | `backend/src/near-transactions.ts`, `backend/src/service.ts`, `backend/test/near-transactions.test.ts` | Backend tests cover finality, signer, contract, recipients, amount, and replay. |
| 4 | Private access is cryptographic, not just hidden UI. | Live storage/capability plane + per-section sandbox | `backend/src/content-crypto.ts`, `backend/src/service.ts`, `src/core/crypto.ts`, `tests/protocol.test.ts` | New production strategy payloads are AES-256-GCM encrypted at rest; signed capabilities enforce subject, resource, scope, expiry and revocation. |
| 5 | Forks preserve lineage and upstream economics. | Live persisted model and verified checkout splits | `backend/src/service.ts`, `backend/src/domain.ts`, `backend/db/schema.ts` | Backend tests verify immutable parent edges, idempotent purchase, creator revenue, upstream royalty and protocol splits. |
| 6 | Agents are user-owned, policy-bounded, and capable of autonomous execution. | Live, opt-in and funded by owner | `backend/src/agent-execution.ts`, `backend/src/service.ts`, `backend/aws/agent-runner.ts`, `src/ui/LiveAgents.tsx` | A bounded agent starts paused. Provisioning adds owner recovery plus a unique KMS-encrypted key. The model proposes; deterministic policy authorizes; 1Click settles; pause/revoke stops future signing. |
| 7 | The flagship thesis is sourced and reproducible. | Reproducible snapshot | `THESIS.md`, `data/`, `src/core/thesisModel.ts`, `scripts/rerun-model.ts` | `npm run model`; vary an input. |
| 8 | Production isolates data and exposes observable services. | Deployed | `infra/template.yaml`, `infra/README.md`, `backend/openapi.yaml` | Visit `/api/v1/health`; inspect networking, alarms, backups, deletion protection. |

## Contradiction guardrails

- Seed activity is tagged **Demo**, carries `demo: true`, and is excluded from verified live performance.
- Live product and deterministic protocol sandbox are separate execution paths.
- Autonomous execution is opt-in only for funded bounded agents with verified dual-key NEAR accounts. Demo agents cannot activate or trade.
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

The autonomous signing boundary enforces exact allowed token identities, per-trade/daily caps and slippage. Allocation and leverage fields remain useful for proposal/portfolio policy, but spot autonomous swaps do not falsely claim portfolio-wide allocation accounting. Proposal mode still requires owner action. Bounded mode starts paused. A unique secp256k1 key is generated in the API process, immediately encrypted by AWS KMS, stored only as ciphertext, and decrypted only inside the isolated signer. The model receives market data and emits a schema-bound proposal but never sees the key. The API revalidates policy and rolling daily spend before a 1Click transfer. Owners retain a recovery key and can pause or revoke; revocation also attempts finalized on-chain removal of the agent key.

### Autonomous Business

Scion treats a strategy or user-owned agent as a constrained revenue-generating entity. `backend/src/service.ts` implements verified checkout, creator payment, protocol fee, and upstream royalty accounting; `backend/src/near-transactions.ts` verifies settlement; `backend/aws/agent-runner.ts` provides isolated research execution; and `src/ui/LiveAgents.tsx` exposes the owner's operating constraints and kill controls. Dedicated NEAR agent-account provisioning provides attributable identity.

The autonomous research-to-policy-to-1Click-execution-to-receipt loop is shipped. Verified strategy sales and upstream royalty splits are also shipped. Automatic routing of marketplace earnings directly into an agent subaccount remains disclosed rather than claimed.

### Agent Economy

Dedicated NEAR subaccounts, owner recovery, unique encrypted agent keys, scheduled research, bounded autonomous spending and attributable settlement receipts are live. Automatic marketplace-earnings routing to an agent subaccount remains future work.

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
