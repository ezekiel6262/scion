# Scion

> Private strategies. Public proof. Verifiable lineage.

[Live site](https://scionhub.xyz) · [Launch app](https://scionhub.xyz/app) · [Product docs](https://scionhub.xyz/docs) · [Judge evidence](docs/JUDGING.md) · [Demo script](docs/DEMO.md)

Scion is a non-custodial strategy network built around NEAR. People and user-owned agents publish public or sealed trading strategies, prove performance without exposing every position, sell scoped access, fork an idea under their own limits, and execute wallet-approved swaps through NEAR Intents. Every derivative keeps its lineage so attribution and revenue can flow upstream.

![Scion strategy feed](public/docs/home.png)

## Why it exists

Trading ideas are usually public posts with weak accountability or private groups that require trust. Copy-trading products often custody funds, hide execution logic, or erase authorship when an idea is copied. AI agents need bounded authority—not a user's unrestricted wallet key.

Scion turns a strategy into a versioned, permissioned object:

- creators choose which sections are public or sealed;
- buyers receive scoped, expiring, wallet-bound access;
- followers fork under their own allocation and risk policy;
- live swaps require the user's wallet approval;
- signed receipts and attestations support public performance claims;
- lineage preserves authorship and upstream economics;
- agents belong to users and start paused until authority is verified.

## Try it

1. Open [the app](https://scionhub.xyz/app). No wallet is needed to browse.
2. Seeded records carry a visible **Demo** label and do not count as verified live activity.
3. Connect a NEAR wallet to create a profile with a username and avatar.
4. Open **Trade**, search the live NEAR token market by name, symbol, or contract, request a quote, and approve the swap in your wallet.
5. Publish a strategy, inspect its family tree, or create a user-owned agent with explicit limits.

For a deterministic four-minute walkthrough, use [docs/DEMO.md](docs/DEMO.md).

## Honest product boundary

| Status | Capability |
|---|---|
| **Live** | NEP-413 and email-wallet authentication, profiles, PostgreSQL persistence, AES-256-GCM encrypted strategy payloads, scoped/expiring/revocable capabilities, live NEAR balances, token discovery, 1Click quotes and settlement, verified checkout splits, fork lineage, agent policies, scheduled AI research cycles that output owner-reviewed proposals, receipts, and pause. |
| **Built and unit-tested, not executable in the current deployment** | User-owned bounded-agent *execution*: dedicated dual-key NEAR agent-account provisioning, KMS-isolated signing, bounded autonomous 1Click swaps, and on-chain key revocation. The code and tests exist, but the production API tier runs in a network-isolated VPC (database egress only), so these KMS/RPC-dependent steps do not run in the live deployment; demo agents never execute. |
| **Protocol sandbox** | Fine-grained per-section re-encryption, delayed sealed plays, follower portfolio simulation, receipt-chain visualizations, performance scenarios, and the populated guided network. Simulated records are labeled **Demo** and excluded from verified live results. |
| **Planned—not claimed as shipped** | TEE/private model inference, audited smart-contract enforcement, automatic agent marketplace earnings routed to subaccounts, and on-chain NFT/trophy minting. |

Exact claim-to-code evidence is in [docs/JUDGING.md](docs/JUDGING.md).

## Why NEAR

- **NEAR accounts and NEP-413** provide portable identity and wallet authorization.
- **NEAR Intents / 1Click** supplies solver-based cross-chain quotes and execution without Scion taking custody.
- **NEAR subaccounts** give user-owned agents a dedicated identity and a path to attributable earnings.
- **Bounded authority** fits agents that must never receive unrestricted access.

AWS hosts the web/API infrastructure; it does not replace the NEAR identity and execution layer.

## Hackathon tracks

Scion is one project entered into several applicable tracks:

1. **Unstoppable DeFi — primary.** Live token discovery, NEAR Intents quotes, user-approved swaps, follower risk limits, and non-custodial execution.
2. **Investment Thesis — primary.** A sourced NEAR Intents thesis, committed data, transparent formulas, sensitivity inputs, and a one-command rerun. Read [THESIS.md](THESIS.md).
3. **AI Security & Defense — primary.** The model never receives a wallet key. Each bounded agent uses a unique KMS-encrypted key on a recoverable NEAR subaccount; deterministic token-identity allowlists, per-trade/daily caps and slippage limits run before signing, with pause and on-chain revocation controls.
4. **Autonomous Business — primary.** A strategy or user-owned agent can sell scoped access, receive verified revenue, share royalties through its lineage, research markets on a schedule, and execute funded NEAR Intents swaps under owner-set constraints. Automatic agent marketplace earnings routing remains a disclosed next step.
5. **Agent Economy — strong fit.** User-owned agents have dedicated NEAR identities, attributable receipts, isolated keys, scheduled research, and bounded autonomous spending. Owners retain a recovery key and can pause or revoke execution.
6. **Privacy & Private AI — conceptual fit.** Field-level sealing and scoped disclosure are implemented in the sandbox. Scion does **not** claim NEAR AI Cloud TEE inference or attestation.
7. **Open Innovation — strong cross-cutting fit.** Scion combines private intellectual-property markets, public performance proof, programmable access, persistent fork attribution, non-custodial execution, and bounded agent ownership into a protocol that does not fit a conventional trading or social category alone.

We do not claim NFT, Swarms, or Memecoin Mechanics features that are only demos or future milestones.

## Other hackathon project

The same solo builder is also submitting **Totem — Culture Engine** as a separate, independent project. Totem explores cultural identity and community formation; it does not share Scion's private-strategy protocol, trading execution, data, or judging evidence.

[Totem live site](https://mytotem.buzz) · [Totem repository](https://github.com/ezekiel6262/totem-culture-engine)

## Architecture

```mermaid
flowchart LR
  U[User / user-owned agent] --> W[NEAR wallet]
  U --> UI[React client]
  UI -->|NEP-413| API[AWS HTTP API]
  API --> DB[(Private PostgreSQL)]
  UI -->|quote + approval| I[NEAR Intents / 1Click]
  W --> I
  API --> V[NEAR RPC verifier]
  I --> V
  API --> P[Policy + capability engine]
  R[Isolated research runner] -->|short-lived capability| API
```

The transaction verifier checks finality, signer, token contract, recipients, and amounts. The research runner has no wallet or database access; the private API revalidates its structured output.

See [architecture](docs/ARCHITECTURE.md), [threat model](docs/THREAT_MODEL.md), [data model](docs/DATA_MODEL.md), and [OpenAPI](backend/openapi.yaml).

## Run locally

Requirements: Node.js 24+ and npm.

```bash
npm ci
npm run dev
```

Verification:

```bash
npm run typecheck
npm test
npm run check:backend
npm run test:backend
npm run model
npm run build
```

The frontend defaults to `/api`. Never commit wallet keys or production secrets.

## Repository map

```text
src/core/                 crypto, policies, lineage, wallet and Intents adapters
src/ui/                   production app, sandbox and docs UI
backend/src/              auth, domain service, repository and receipt verification
backend/aws/              Lambda handlers, migration and isolated agent runner
backend/test/             auth, verifier, persistence and vertical-slice tests
infra/template.yaml       AWS SAM production infrastructure
data/ + scripts/          sourced thesis inputs and reproducible model
tests/protocol.test.ts    protocol and security-boundary checks
docs/JUDGING.md           claim-to-evidence index
```

## Build provenance and dependencies

Scion's first repository commit is dated 6 November 2026, inside the official eligibility window that began with the 19 October announcement. There is no pre-hackathon product baseline or older branch being submitted as new work. The supplied homepage design and expanded product frontend were integrated during the same window and are present in this repository's history.

The application uses React, React DOM, Vite, TypeScript, PostgreSQL through `pg`, `@fastnear/intents` for NEAR Intents integration, `@hot-labs/near-connect` for wallet connection, WebCrypto-compatible browser primitives, and AWS SAM infrastructure. Esbuild and `vite-plugin-singlefile` support testing and packaging. Exact versions and transitive packages are locked in `package-lock.json` and `backend/package-lock.json`; no generated dependency folders are committed.

## Security

Scion is non-custodial and never receives a seed phrase or unrestricted private key. Capabilities are scoped, expiring, revocable, and holder-bound. Agent actions are constrained by deterministic owner policy and wallet confirmation. Demo records cannot approve proposals, run models, or execute trades. Report vulnerabilities through [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
