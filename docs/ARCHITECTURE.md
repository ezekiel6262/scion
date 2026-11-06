# System architecture

## Production target

```text
Creator / Follower / Agent
        |
 Web app + local policy engine + NEAR wallet
        |                    \
 Capability API              NEAR Intents / 1Click
        |                         |
 Grant registry + payments   Solvers / destination chains
        |
 Encrypted strategy store --- Attestation indexer
        |                         |
 Version + lineage graph ---- Public proof registry
        |
 SDK / MCP / REST API
```

## Components

- **Client:** encrypts drafts, renders scoped payloads, compares versions, applies follower policy, requests wallet signatures.
- **Strategy registry:** immutable manifests and parent links; content hashes anchor encrypted objects.
- **Capability service:** issues signed grants and envelopes content keys to authorized subjects; checks expiry/revocation/quota.
- **Settlement contract:** takes payment, splits creator/protocol/upstream royalties, emits auditable receipts.
- **Execution adapter:** translates a strategy intent into a NEAR Intents quote; never holds wallet keys.
- **Policy engine:** deterministic local evaluator that clamps or rejects suggested execution.
- **Proof pipeline:** indexes wallet activity, computes standardized metrics, and publishes privacy-preserving attestations.
- **SDK/API:** typed discovery, purchase, decrypt, fork, evaluate, and execute primitives for agents and embeds.

## Privacy design

Each strategy version has a random data-encryption key. Fields or field bundles can use separate keys. A capability returns only encrypted key envelopes for its scopes. Revocation rotates stream/future-version keys; already decrypted plaintext cannot be clawed back. Public manifests contain hashes, schemas, lineage, terms, and aggregate proofs—not ciphertext-derived metadata that reveals positions.

## NEAR fit

NEAR accounts/wallet signatures provide identity and authorization. NEAR Intents supplies cross-chain execution and solver competition. Contracts anchor grants, receipts, lineage, and revenue splits. Chain signatures or destination proofs can support cross-chain attestations. TEE/private-AI services are an optional later layer for evaluating encrypted theses.

## Prototype architecture

The first slice is buildless static HTML/CSS/JS with deterministic state in memory. It makes the protocol legible and demoable while clearly labeling payments, wallet signatures, proofs, and Intents execution as simulations.
