# Scion

**Private strategies, public lineage.**

Scion is a privacy-native social trading network and protocol on NEAR. People and AI agents publish executable investment strategies, sell scoped and expiring access to them, and let others copy or fork them. Followers set their own risk limits and execute from their own wallet through NEAR Intents. Every fork keeps its lineage and pays royalties upstream.

Think of each strategy as a living document you can copy and improve:

- Strategies are versioned objects containing a thesis, evidence, positions, rules and trades.
- Each section is sealed separately.
- Public profiles show attested performance without leaking positions.

Read the full product spec, threat model, architecture, data model, screen map and milestones in [`docs/SPEC.md`](docs/SPEC.md). The AWS deployment foundation is documented in [`infra/README.md`](infra/README.md).

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # headless run of the 9-step flow, security boundaries and social layer (80 checks)
npm run build        # static build in dist/, deploy to Vercel as-is
npm run build:single # single-file HTML in dist-single/
```

Requirements: Node 20 or newer and a modern browser with WebCrypto (any current Chrome, Safari, Firefox or Edge).

## The demo, end to end

Open the app and use the **Guided demo** rail. Each step switches to the right wallet (Public, Alice or Bob) and the right screen.

1. Alice publishes a private cross-chain strategy and thesis in the Studio. Each section is encrypted in the browser with its own AES-256-GCM key.
2. Alice executes to her target allocation: three cross-chain intents, each producing a solver-signed receipt in a hash chain.
3. Advance the market 24h. The gateway re-attests her stats. As the public you see the verified return, drawdown and receipt count, but no positions.
4. Bob buys a Fork Key: thesis, positions and rules for 7 days.
5. Bob sees exactly those sections. Evidence and trades stay sealed for him.
6. Bob forks, edits the allocation and his risk limits (his position cap clips NEAR), publishes the fork under his own keys, and executes from his own wallet.
7. Alice's ledger shows the key revenue and an execution royalty routed upstream from Bob's fork.
8. Alice revokes Bob's key, or you advance past expiry. The gateway refuses further releases and Bob's client drops its cached view.
9. Explore, View as Family tree, shows the public fork graph with attested results and nothing sealed.

### Social layer, also in the guided demo under "More to try"

- **Plays**: single calls, sealed and timestamped. The commitment hash is public when posted; on reveal anyone can verify it. Early access is bought per play and re-sealed to the buyer's wallet.
- **Trench plays** for memecoins: proof of position (a settled buy before posting) and a no-dump rule (early holders are notified before the author's exit can settle).
- **Suggested changes**: a fork owner suggests an improvement back to the original. The change is sealed so only the original's creator can open it. Accepting creates a new version, re-seals every section with new keys, and credits the improver with a share of future key sales. Forks can then sync with the original through a valid key.
- **Fork duels**: every fork ranked against its parent.
- **Co-signs**: forks backed by executed capital, shown as "N co-signers, $X behind it". Paper forks are tracked but never count.
- **Rooms**: per-strategy chat for the creator and current key holders; losing the key loses the room.
- **Portfolio tracking**: connect a wallet read-only (simulated holdings), track value, publish it as a sealed strategy, manage live and paper forks.
- **Tokenized stocks** (NVDAx, TSLAx) and **demo memecoins** (MOTH, GRUB) as asset classes.
- **NFTs**: royalty-share NFTs that earn a cut of a strategy's fork royalties, and trophy NFTs minted when a sealed call hits its target. NEP-171 shaped metadata, minted in demo state; the contract is milestone M3.

### Public or sealed

Every portfolio, thesis and play is either **public** or **sealed**.

- **Public**: anyone reads every section and forks it free. It is still versioned and signed, and forks still pay royalties back (a share of their key revenue and of executed volume). Public calls show at once and still carry a seal that proves when they were made.
- **Sealed**: sections are encrypted and sold through keys, as described above.

Forkers choose again for their own fork: fork a public portfolio, then seal your version, or the other way round.

### The flagship public thesis: NEAR Intents (Investment Thesis track)

A public thesis by `tunde.near` with real, sourced data, not simulated:

- `data/near-intents.csv`: cumulative NEAR Intents volume from $2.95B (30 Oct 2025) to $34.78B (13 Oct 2026), seven dated points, each with its source link.
- `data/near-facts.json`: September 2026 record month ($4.80B), protocol buybacks of NEAR ($16.03M since late February), market cap, supply, the Confidential Intents share, and the October 2026 contract incident.
- `src/core/thesisModel.ts`: the model. It derives an implied buyback take rate (about 7.4 bps), average monthly volume, doubling time, and the yearly buyback as a share of market cap (about 0.70% at the September record).
- In the app, the Evidence section draws the chart, lists every source, and lets anyone change monthly volume, take rate, market cap and the threshold, and see each formula re-computed.
- From the repository: `npm run model`, or for example `npm run model -- --monthlyVolumeB=8`. It re-reads the CSV and JSON and checks they match the app's snapshot.

The snapshot is as of 15 October 2026. Wiring it to a live Dune or NEAR Intents Explorer query is milestone M2.

### Back or fade

Anyone with a wallet can **back** or **fade** a public thesis or any call, for free. It shows how people receive an idea, and it is settled by data, never by vote:

- Calls: hitting the target settles for backers, hitting the stop for faders, and an exit is decided by the direction of the move.
- Theses: thesis watch invalidating it settles for faders; holding for 7 market days settles for backers.

Every settled stance is scored into a public record on each profile, for example "11 of 14 calls right". Authors cannot back or fade their own call, and a settled stance is locked. No money is staked.

### Publishing and trading

- **Publish with tokens you buy now, tokens you already hold, or both.** The publish flow has four steps: story, positions, keys, review. Each position is either "Buy now" (bought through NEAR Intents right after sealing, paid from wallet USDC or demo capital) or "Already hold" (pulled from the connected wallet, never sold or moved). Held tokens get a gateway-signed holding proof; the public sees only how many tokens it covers. The verified record starts at the publish price, so old gains never count.
- **Trade page.** Buy tokens on NEAR (same-chain swaps such as USDC on NEAR to NEAR) or across chains through NEAR Intents (for example USDC on Base to SOL or tokenized NVIDIA on Solana). You sign every trade; balances, receipts and recent trades update in the wallet, and anything you buy can be published straight into a strategy. The solver is simulated; live 1Click quotes are milestone M2.

### Trust layer

- **Thesis watch**: creators write machine-checkable invalidation conditions into their sealed rules (a data feed falling N weeks in a row, a price drop from entry, a drawdown limit). Every market day the gateway opens the rules, checks them against public data, and publishes a signed status: holding or invalidated, never which condition. Holders whose key opens the rules are alerted with the reason; other holders are alerted without it. The weekly intents-volume feed is simulated: each demo day adds one week.
- **Verified cards**: one tap renders a shareable card (SVG or PNG, light or dark) with the signed return, drawdown, receipts, forks, co-signers and thesis status, and never positions. Each card carries a code (the attestation plus the gateway signature) that anyone can paste into Security log, Verify a card. Changing any number breaks verification.

The **Security log** page shows the security boundary at work: issued capabilities, every release and denial with its reason, and the ciphertext anyone can see.

## Live AWS product path

The `/api/v1` product path uses NEP-413 wallet authentication, NEAR mainnet balance proofs, live 1Click quotes, wallet-approved swaps, profiles, publishing, social activity, invites, and PostgreSQL persistence. Paid access uses a server-signed checkout plan and one NEAR transaction containing the creator payment, upstream royalty, and 10% Scion protocol fee. The internet-facing verifier checks transaction finality, signer, token contract, recipients, and amounts before the private database service can issue a capability. Settlement transaction hashes are unique to prevent replay.

Production keeps the database in isolated subnets, retains seven days of backups, enables deletion protection, and alarms on API/Lambda failures, database CPU, and low storage. Email/social/passkey onboarding remains disabled until provider credentials and a dependency-audited signing SDK are configured. A custom CloudFront domain can be activated with `CustomDomainName` and a us-east-1 ACM certificate ARN.

### User-owned trading agents

Authenticated users can create public or private agent identities in research, proposal, or bounded-execution mode. Every agent is owned by a NEAR account and carries an attested policy covering allowed assets, per-trade and daily limits, allocation, slippage, and leverage. Research agents cannot propose trades. Proposal agents require an explicit owner decision and wallet confirmation. Bounded agents start paused and cannot activate until dedicated execution authority is verified. Owners can pause or permanently revoke agents; Scion does not own their identity, funds, or strategy.

## What is real and what is simulated in the protocol sandbox

| Real in this build | Simulated in this build |
|---|---|
| Per-section AES-256-GCM encryption (WebCrypto) | NEAR Intents solver and settlement (`SimulatedIntents`) |
| ECDSA P-256 signed access capabilities, bound to the holder's key thumbprint | Wallet signing (three local personas) |
| ECDH P-256 re-sealing of each release to one holder | USDC payments (in-memory ledger) |
| Revocation, expiry, delay filtering, one-time use, enforced at the gateway | The gateway enclave (runs in the browser tab; production target is a TEE) |
| Solver-signed receipts in a SHA-256 hash chain | Market prices (fixed daily path) |
| Gateway-signed performance attestations, verifiable in the UI | Seed strategies and their history (labeled "Seed data") |
| Follower risk-policy clipping and blocking | The intents volume dataset (labeled "Demo dataset") |
| Royalty routing up the fork lineage | |

`src/core/intents.ts` remains the deterministic protocol-sandbox adapter. The live product uses `src/ui/LiveSwap.tsx` with the 1Click SDK and independently verifies attached execution receipts through the backend transaction verifier.

## Project layout

```
src/core/crypto.ts    WebCrypto primitives: seal, sign, verify, box
src/core/types.ts     protocol data model
src/core/engine.ts    publish, keys, gateway release, revoke, execute, attest, fork, royalties
src/core/policy.ts    key classes and the follower risk engine
src/core/intents.ts   IntentsAdapter, SimulatedIntents, OneClickAdapter (M2)
src/core/seed.ts      seed network, Alice's template, market path
src/ui/*              app shell, home, explore, strategy page, unlock sheet, fork flow, studio, lineage, keys, earnings, security log, demo guide
tests/protocol.test.ts  headless end-to-end and boundary checks
docs/SPEC.md          foundations
```

## Hackathon tracks

Selected tracks:

- **Unstoppable DeFi**: trading through NEAR Intents, forking with your own risk limits, no custody.
- **Privacy and Private AI**: sealed sections, wallet-bound keys, re-sealed releases, signed records that reveal no positions.
- **Investment Thesis**: the public NEAR Intents thesis with sourced data and a re-runnable model.
- **NFTs That Do Something**: royalty-share NFTs that earn from forks, and trophy NFTs minted by verified calls.

Earlier notes:

- **Unstoppable DeFi** (primary)
- **Privacy and Private AI** (primary)
- **Investment Thesis** (secondary): re-runnable evidence models

We claim Agent Economy only once the M3 agent buyer ships.

## License

MIT
