# Data model

## Principal entities

```text
User(id, near_account, display_name, assurance_level)
Strategy(id, owner_id, slug, visibility, latest_version_id)
StrategyVersion(id, strategy_id, semver, parent_version_id, manifest_hash,
  thesis_ref, evidence_refs[], positions_ref, rules_ref, risk_ref,
  horizon, disclosure_policy_id, license_id, created_at)
CapabilityGrant(id, issuer_id, subject_id, version_id, kind, fields[], actions[],
  not_before, expires_at, delay_seconds, quota, price, nonce, status)
FollowerPolicy(id, owner_id, max_allocation, max_slippage_bps, assets[],
  max_leverage, daily_loss_limit, max_drawdown, confirmation_threshold)
Execution(id, version_id, executor_id, policy_id, intent_hash, quote_hash,
  amount, status, assurance, receipt_ref)
PerformanceProof(id, strategy_id, window, metric_set, capital_band,
  assurance, proof_hash, observed_at)
ForkEdge(parent_version_id, child_version_id, creator_id, change_set_hash,
  license_id, royalty_bps)
Settlement(id, grant_id, payer_id, gross, protocol_fee, creator_amount,
  upstream_amount, receipt_ref)
Revocation(grant_id, nonce, reason_code, revoked_at)
```

## Public vs private

Public: IDs, owners/pseudonyms, version metadata, hashes, lineage, license/economics, coarse risk class, aggregate proof metrics, assurance/freshness, follower/fork counts.

Private by default: thesis body, evidence contents, exact positions/sizes, rules/parameters, wallet balances, execution timing/routes, follower policy, content keys.

## Version rules

- Versions are immutable and content-addressed.
- Parent links target an exact version, not a moving strategy head.
- Change sets list semantic fields changed, while secret values remain encrypted.
- Performance attaches to the exact executed version and cannot automatically transfer to a fork.
- Deleting a public node tombstones content but preserves lineage and receipts.
