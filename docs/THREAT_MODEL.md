# Threat model

## Assets and trust boundaries

Protected assets: wallet authority, private positions, thesis evidence, strategy code/rules, capability secrets, execution intent timing, identity links, payment receipts, performance proofs, and royalty balances.

Trust boundaries: creator client ↔ encrypted storage; buyer client ↔ capability service; client ↔ NEAR wallet; policy engine ↔ Intents solver; verifier ↔ public profile; agent ↔ API gateway.

## Priority threats and controls

| Threat | Control | MVP status |
|---|---|---|
| Front-running from leaked positions | Field encryption, delayed disclosure, coarse public metrics, no order timestamps | Modeled; UI redaction implemented |
| Stolen/replayed access capability | Subject/resource binding, signed token hash, short expiry, revocation and replay-safe settlement | Live backend |
| Creator revokes after payment | Signed terms, escrow/refund policy, revocation reason and receipt | Revocation state implemented |
| Buyer republishes private edge | Watermarked payloads, license terms, account binding, rate limits | Planned |
| Fake or cherry-picked PnL | Wallet-linked observation window, capital bands, proof freshness, comparable cohorts | Assurance labels implemented |
| Sybil followers / wash revenue | Proof-of-payment uniqueness, reputation weighting, anomaly detection | Planned |
| Malicious model drains agent | Dedicated funded subaccount, unique KMS-encrypted key, exact token-identity allowlist, deterministic per-trade/daily/slippage limits, paused default, owner recovery and revocation | Live bounded mode |
| Solver returns hostile route | Registry asset match, exact-input quote bounds, expiry, direct NEP-141 deposit, 1Click terminal-state verification and persisted receipt | Live |
| Fork hides attribution | Parent-version commitment in child manifest and settlement contract | Lineage implemented |
| Metadata correlation | Batch writes, timing jitter, relays, minimized logs | Planned |
| Agent prompt/data poisoning | Signed schemas, provenance, sandboxed evaluation, no thesis text as authority | Planned |
| Database/storage compromise | AES-256-GCM encrypted strategy payloads, secret isolated in Secrets Manager, private RDS, encrypted storage/backups, auditable access | Live for new production versions |
| Model or prompt accesses wallet key | Model runner has no KMS permission or key material; signing occurs after independent API policy checks | Live |

## Security invariants

1. Buying access never grants trading authority.
2. Strategy authors cannot override follower wallet policy.
3. Revocation stops future decryptions/streams, not knowledge already revealed.
4. Public proofs disclose no exact live position or order timing.
5. Every execution binds strategy version, follower policy version, quote, and wallet signature.
6. Fork attribution references an immutable parent and cannot be silently rewritten.

## Known limits

Scion has two explicit lanes. The production lane persists new strategy-version payloads as AES-256-GCM ciphertext, enforces signed capabilities in the API, verifies settlement, and isolates bounded-agent keys with AWS KMS. The guided protocol sandbox still demonstrates finer per-section re-encryption, delayed sealed plays, performance scenarios, and historical network density in the browser; those records are labeled **Demo**. The production lane has not received an external security audit, does not claim TEE/private model inference, and does not make previously disclosed plaintext versions retroactively confidential.
