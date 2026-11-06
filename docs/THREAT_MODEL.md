# Threat model

## Assets and trust boundaries

Protected assets: wallet authority, private positions, thesis evidence, strategy code/rules, capability secrets, execution intent timing, identity links, payment receipts, performance proofs, and royalty balances.

Trust boundaries: creator client ↔ encrypted storage; buyer client ↔ capability service; client ↔ NEAR wallet; policy engine ↔ Intents solver; verifier ↔ public profile; agent ↔ API gateway.

## Priority threats and controls

| Threat | Control | MVP status |
|---|---|---|
| Front-running from leaked positions | Field encryption, delayed disclosure, coarse public metrics, no order timestamps | Modeled; UI redaction implemented |
| Stolen/replayed key | Subject binding, nonce, short expiry, audience restriction, replay cache | Capability simulation implemented |
| Creator revokes after payment | Signed terms, escrow/refund policy, revocation reason and receipt | Revocation state implemented |
| Buyer republishes private edge | Watermarked payloads, license terms, account binding, rate limits | Planned |
| Fake or cherry-picked PnL | Wallet-linked observation window, capital bands, proof freshness, comparable cohorts | Assurance labels implemented |
| Sybil followers / wash revenue | Proof-of-payment uniqueness, reputation weighting, anomaly detection | Planned |
| Malicious strategy drains follower | Local allowlists, caps, simulation, confirmations, no delegated raw wallet key | Policy checks implemented |
| Solver returns hostile route | Quote bounds, asset/amount verification, expiry, independent simulation | Planned integration |
| Fork hides attribution | Parent-version commitment in child manifest and settlement contract | Lineage implemented |
| Metadata correlation | Batch writes, timing jitter, relays, minimized logs | Planned |
| Agent prompt/data poisoning | Signed schemas, provenance, sandboxed evaluation, no thesis text as authority | Planned |
| Admin/storage compromise | Client-side encryption, split duties, key rotation, auditable access | Planned |

## Security invariants

1. Buying access never grants trading authority.
2. Strategy authors cannot override follower wallet policy.
3. Revocation stops future decryptions/streams, not knowledge already revealed.
4. Public proofs disclose no exact live position or order timing.
5. Every execution binds strategy version, follower policy version, quote, and wallet signature.
6. Fork attribution references an immutable parent and cannot be silently rewritten.

## Known limits

The prototype is a UX and protocol-state simulation. Browser-local data is inspectable and is not confidential storage. Production privacy requires audited cryptography, secure key delivery, server-side authorization, chain contracts, and independent proof verification.
