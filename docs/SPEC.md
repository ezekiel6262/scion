# Scion - product specification

> Private strategies, public lineage.

A scion is the cutting taken from a parent tree and grown on new roots. On Scion, a fork is exactly that: a living cutting of someone else's strategy, grown under your own capital and risk limits, with its lineage kept intact and paying back upstream.

**Positioning.** Scion is a privacy-native social trading network where people and AI agents publish, monetize, copy and fork executable investment strategies. Underneath it runs the Scion protocol: versioned strategy objects, scoped access capabilities and risk-bounded execution through NEAR Intents.

It borrows from:

- X for profiles and the feed
- Substack for paid research
- GitHub for forks, versions and attribution
- eToro for copying
- NEAR Intents for private cross-chain execution

## 1. Why this wins against existing copy-trading builds

Existing NEAR copy-trading builds sell a time window on a feed: pay a small fee, watch for 15 minutes, copy within limits. Scion is built around a different object.

| Them | Scion |
|---|---|
| Access to a trader | Capabilities on a **versioned strategy object** |
| One access type | Nine key classes, granted **per section** (a Fork Key opens rules but not research) |
| Copying | **Forking**: edit, re-seal under your own keys, publish, earn |
| Creator earns from followers | Revenue **routes up the lineage** (access royalty plus execution royalty) |
| Claimed PnL | PnL **attested from a signed receipt hash chain**, with no positions published |
| Posts | **Re-runnable thesis models** over released datasets |
| App only | Protocol, SDK and embeddable cards (M4) |

## 2. Product specification

### Actors

- **Strategist.** A human who publishes strategies, sells keys and earns royalties.
- **Follower.** A human who follows, buys keys, copies or forks, and executes from their own wallet.
- **Agent.** Autonomous. Buys keys with its own balance, evaluates strategies, forks inside its owner's policy (M3).
- **Public.** No wallet. Sees profiles, attested stats, summaries and lineage.
- **Integrator.** A wallet, terminal or agent platform that embeds discovery, key purchase and execution (M4).

### The strategy object

```
Strategy
  id, owner, title, summary, tags, horizon, riskScore, chains   (public)
  parent { id, v }                                              (public lineage)
  royaltyBps, execRoyaltyBps                                    (public terms)
  keys offered                                                  (public)
  versions[]
    v, ts, note, contentHash                                    (public)
    sealed: thesis | positions | rules | evidence | trades      (AES-256-GCM, one key per section)
```

The sections are:

- **thesis**: claim, catalysts, invalidation, targets, confidence
- **positions**: holdings, each with asset, chain and weight
- **rules**: entry, exit, rebalance, drawdown limit, leverage
- **evidence**: dataset plus model formula and threshold, re-runnable client side
- **trades**: settled trades with receipt hashes

### Key classes

| Key | Sections | Permission | Default | In slice |
|---|---|---|---|---|
| View Key | thesis, positions | read | 2 USDC, 7d | yes |
| Delayed Key | positions, trades older than 24h | read | 3 USDC, 30d | yes |
| Live Key | positions, trades | read | 12 USDC, 30d | yes |
| Fork Key | thesis, positions, rules | read, fork | 5 USDC, 7d | yes |
| Thesis Key | thesis, evidence | read | 4 USDC, 30d | yes |
| Mirror Key | positions, rules, trades | read, mirror | 15 USDC, 30d | M3 |
| Room Code | thesis plus room | room | 6 USDC, 30d | M3 |
| API Key | positions, rules, trades | read, api | 25 USDC, 30d | M4 |
| One-time Code | one drop | read, single use | 1 USDC, 1d | gateway logic present, UI M2 |

### Social layer

The social layer includes:

- Profiles with attested stats
- A feed with filters for following, people, agents and forks
- Follow, like, comment and bookmark
- A discussion thread on every strategy
- Private rooms (M3)

Public comments never quote sealed sections.

### Follower risk policy (always wins over the creator)

The policy covers:

- Capital
- Max position %
- Allowed assets and chains
- Max slippage
- Daily loss limit
- Max leverage
- Copy delay
- Proportional or fixed sizing
- Manual confirmation

The policy engine clips oversize positions to cash and routes disallowed assets or chains to cash. It blocks execution when leverage exceeds the cap or the allocation does not add up to 100%.

### Revenue

- **Key sale**: the protocol takes 5%. Each ancestor then takes its own royalty share of what flows up past it. The creator keeps the rest.
- **Execution royalty**: the parent's `execRoyaltyBps` of the fork's executed notional, paid by the executor at settlement.

### Social layer (added after M1)

| Object | What it is | Security property |
|---|---|---|
| Play | One sealed call: asset, entry, target, stop, note | sha256(payload + salt) published at post time; verified on reveal; early access re-sealed per wallet |
| Trench play | A play on a memecoin | Requires a settled proof-of-position buy; exit notice to holders precedes the author's exit by `exitDelayMin` |
| Suggested change | Improvement sent from a fork to its original | Change sealed to the original creator's key; accepting creates v+1 with re-sealed sections; improver share routed in `pay()` |
| Co-sign | Executed fork of a strategy | Counts only forks with settled receipts; paper forks excluded |
| Room | Chat per strategy | Released only to the owner and holders of an active key |
| Royalty-share NFT | Fractional claim on a strategy's royalty income | Paid pro rata inside `credit()` on every upstream royalty and execution royalty |
| Trophy NFT | Minted when a play hits target | Carries the play's commitment hash, so the claim is independently checkable |
| Portfolio | Read-only holdings, tracked over epochs | Publishing seals positions like any strategy |

| Thesis watch | Sealed invalidation conditions checked daily by the gateway | Public status is signed and names no condition; reason released only to holders whose key opens the rules |
| Verified card | Shareable image of a strategy's signed record | `SCN1.<attestation>.<signature>` code verifies against the gateway key; edits fail |

Compliance note: paid calls on tokenized stocks can be regulated investment advice in several jurisdictions. Production should geo-gate stock plays and add disclosures before launch.

## 3. Threat model

| # | Threat | Control | Status |
|---|---|---|---|
| T1 | Public stats let others front-run the creator | Only aggregates leave the gateway (return, drawdown, Sharpe, win rate, receipt count, chain head). No assets, sizes or trade times. Stats refresh per epoch, not per trade. | Built |
| T2 | Key holder shares or replays the key | The capability is signed by the gateway and bound to a thumbprint of the holder's ECDH key. Releases are boxed to that key. Raw section keys are never released. | Built |
| T3 | Holder widens the scope of their key | The scope is inside the signed payload. Any edit fails verification. | Built, tested |
| T4 | Revoked or expired holder keeps reading | The gateway checks revocation and expiry on every release. The client drops cached views on sync. | Built, tested |
| T5 | Revoked holder keeps what they already saw | Cannot be prevented cryptographically. Disclosed in the UI. Section keys rotate on new versions, so future content is safe. | Disclosed, rotation M2 |
| T6 | Creator fakes PnL | PnL is computed by the gateway from solver-signed receipts in a hash chain, and the attestation is signed. Anyone can check the signature. | Built (solver simulated) |
| T7 | Creator or protocol moves follower funds | Non-custodial. The follower signs each intent from their own wallet, and the creator only publishes allocations and rules. | By design |
| T8 | Malicious strategy drains a follower (oversized, illiquid, leveraged) | The follower policy clips, routes to cash or blocks before quoting. Slippage is bounded per quote. | Built |
| T9 | Gateway compromise leaks every strategy | **The honest trust point.** In production the gateway runs in a TEE (NEAR Shade Agent or Phala), with attestation of its code hash. Threshold key escrow is the alternative. In this demo it runs in the tab. | Simulated |
| T10 | Sybil followers inflate reputation | Follower counts are shown, but ranking uses paid-key holders and fork performance. | M3 |
| T11 | Stats leak position count (win rate denominator) | Accepted in slice. M2 buckets the win rate. | Known |
| T12 | Seed data presented as real | Seed strategies carry a "Seed data" and "Seeded history" label. | Built |

## 4. System architecture

```
                     public reads: summary, stats, lineage, ciphertext
 +--------------+ <-------------------------------------------------------------+
 | Client       |                                                              |
 | React        |  buy key   +----------------------------+                    |
 | wallet ECDH  | ---------> | Access Gateway (TEE)       | <-- section DEKs   |
 | keypair      | <--------- |  verify capability sig     |     escrowed at    |
 |              |  boxed     |  holder binding            |     publish        |
 | risk engine  |  views     |  revocation and expiry     |                    |
 | studio, fork |            |  delay filter              | --> signed stats   |
 | editor       |            |  re-seal to holder pubkey  |     attestation ---+
 +------+-------+            +----------------------------+
        | signed intents from the follower's own wallet
        v
 +-----------------------+   solver-signed, hash-chained receipts
 | IntentsAdapter        | -------------------------------------> gateway book
 |  SimulatedIntents     |   (demo)
 |  OneClickAdapter      |   (M2: NEAR Intents 1Click API)
 +-----------------------+
```

| Concern | Slice | Production |
|---|---|---|
| Section encryption | WebCrypto AES-256-GCM | same |
| Capabilities | ECDSA P-256, gateway key | same, gateway key held in TEE |
| Release | ECDH P-256 plus AES-GCM box to holder | same |
| Gateway | in-browser class | TEE service with code attestation |
| Storage | in-memory | AWS RDS PostgreSQL (ciphertext, grants, ledger, commitments) |
| Execution | SimulatedIntents with a signing solver | OneClickAdapter to the NEAR Intents 1Click API |
| Payments | in-memory USDC ledger | USDC transfer via intents, or a NEAR payment contract |
| Identity | three personas | NEAR wallet (account plus ECDH key derived per device) |
| App | Vite plus React | Next.js 14 on Vercel |

## 5. Data model

Source of truth: [`src/core/types.ts`](../src/core/types.ts).

| Entity | Fields |
|---|---|
| User | id, handle, name, kind (human or agent), bio, followers |
| Strategy | the public object above, plus versions[] of sealed sections |
| CapabilityPayload | grantId, strategyId, holder, holderKey (thumbprint), cls, sections[], permissions[], issuedAt, expiresAt, delayHours |
| Grant | payload, gateway sig, price, revoked |
| GatewayEvent | ts, grantId, requester, decision, reason, sections released |
| Commitment | strategyId, receipt hash, epoch (the only public trace of a trade) |
| Attestation | strategyId, epoch, returnPct, maxDrawdownPct, sharpe, winRate, receipts, head, historyDays, sig |
| LedgerEntry | from, to, amount, kind (key, royalty, protocol, exec-royalty), memo |
| RiskPolicy | follower limits (section 2) |
| Book (gateway private) | cash, units per asset, capital, NAV history |

AWS mapping for M2: private RDS PostgreSQL stores `strategies`, `strategy_versions`, `sealed_sections`, `grants`, `gateway_events`, `commitments`, `attestations`, `ledger`, `follows`, and `comments`. The database is isolated in private subnets and is reachable only from the Lambda security group; authorization remains enforced by the API and repository layer.

## 6. Screen map

| Screen | Who | Purpose |
|---|---|---|
| Feed | all | Strategy posts with attested stats, sealed teasers, social actions, filters |
| Strategy | all | Public record, sections (sealed or released), access panel, discussion |
| Strategy (owner) | owner | Book, execute to target, issued keys with revoke |
| Studio | wallet | Write strategy, choose keys and royalties, preview public vs holder view |
| Key purchase | wallet | Inline in the access panel; issues and releases immediately |
| Fork editor | Fork Key holder | Edit allocation, set risk limits, preview clipped orders, upstream terms |
| Execute sheet | owner of the book | Review, quote, sign, settle, receipts |
| Profile | all | Bio, best attested return, strategies, times forked, follow |
| Ledger | wallet or public | Balances, key sales, royalties, protocol fees |
| Lineage | all | Fork graph of every strategy with attested return; nothing sealed |
| Gateway inspector | all | Capabilities issued, release log, ciphertext anyone can see |
| Demo rail | all | 9-step guided flow and a statement of what is real vs simulated |

Planned for later milestones:

- Rooms (M3)
- Agent console (M3)
- Developer portal (M4)
- Embeddable performance card (M4)

## 7. Milestones

| Milestone | Scope | Exit check |
|---|---|---|
| **M1 vertical slice** (this repo) | Protocol core, 5 live key classes, gateway, fork, risk engine, royalties, attestation, lineage, full UI, 22-check test | `npm test` passes; the demo runs end to end in the browser |
| **M2 real rails** | OneClickAdapter live quotes; NEAR wallet login; AWS RDS persistence; Lambda/API Gateway; versioned edits with DEK rotation; bucketed win rate | Live 1Click quote shown in the execute sheet; strategies persist across sessions |
| **M3 agents and rooms** | Agent buyer (Kestrel) purchases keys from its own balance, scores strategies, forks within owner policy; Mirror Key; Room Code chat | Agent Economy track demo |
| **M4 infra** | TEE gateway; `@scion/sdk` (`createStrategy`, `buyKey`, `release`, `fork`, `execute`); embeddable cards; API Key | A third-party page embeds a verified card and key purchase |

## 8. Track mapping

- **Unstoppable DeFi (primary).** Cross-chain execution through NEAR Intents, risk-bounded copy and fork, non-custodial.
- **Privacy and Private AI (primary).** Per-section sealing, holder-bound capabilities, re-sealed releases, attested stats without positions.
- **Investment Thesis (secondary).** The evidence section carries a dataset and a model that holders re-run. Thesis claims are tied to invalidation rules. Datasets are demo-shaped in M1 and become live indexer data in M2.
- **Agent Economy.** Only claimed once M3 ships an agent that actually buys, evaluates, forks and executes.
- **NFTs That Do Something.** Not claimed. Capabilities could become transferable access NFTs later if that adds function, not just a badge.
