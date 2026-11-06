# Product specification

## Positioning

Veilbranch is GitHub for investable strategies: a privacy-native network where people and agents publish, verify, sell, fork, and execute versioned strategies without surrendering custody or revealing the edge.

## Users

- **Creators** publish strategies, evidence, rules, and selective disclosures; earn access fees and fork royalties.
- **Followers** evaluate verified outcomes, buy bounded access, fork safely, and execute through their own wallet policy.
- **Agents** discover strategies via API, purchase machine-readable capabilities, test forks, and execute within delegated limits.
- **Researchers** publish reproducible theses backed by datasets, model hashes, notebooks, and result attestations.

## Core object

A Strategy is immutable per version and contains: thesis, evidence references, position intents, entry/exit rules, risk profile, horizon, execution permissions, disclosure policy, parent version, and economics. A new edit creates a version; a new owner or divergent thesis creates a fork.

## Capability products

- **View Key:** reveal selected fields.
- **Delayed Key:** reveal positions after a creator-set delay.
- **Live Key:** stream authorized changes until expiry.
- **Mirror Key:** receive machine-readable execution intents.
- **Fork Key:** derive and publish a child strategy under license terms.
- **Thesis Key:** access research/evidence but not positions.
- **Room Code:** shared capability for a bounded cohort.
- **API Key:** agent/server access with scopes, quota, expiry, and revocation.

Capabilities are explicit grants, not bearer links: subject, resource/version, fields, actions, delay, expiry, quota, transferability, price, and revocation nonce are signed together.

## Trust and verification

Public profiles expose proof-backed aggregate PnL, drawdown, volatility, risk-adjusted return, observation period, capital band, proof freshness, followers, forks, and fork outcomes. They never expose orders, balances, exact size, venue, or timing unless granted.

Claims have a visible assurance label: `simulated`, `self-attested`, `wallet-attested`, or `verifier-attested`. Rankings compare only compatible assurance levels and time windows.

## Creator economics

Revenue splits at settlement: protocol fee, creator access revenue, upstream fork royalty, and optional dataset/model contributors. A child declares the exact parent version and license. Royalty depth is capped to prevent unbounded fee chains.

## Safety and custody

Veilbranch never pools follower funds. Before any execution, the follower-side policy engine constrains allocation, asset allowlist, slippage, leverage, daily loss, strategy drawdown, venue, and confirmation threshold. A strategy proposes; the wallet owner authorizes.

## MVP acceptance criteria

- Complete Alice→Bob demo in under 3 minutes.
- Restricted fields remain absent from Bob's payload before purchase and after revoke/expiry.
- Fork points to an immutable parent version and visibly lists changed parameters.
- Policy engine rejects an over-limit execution.
- Public proof card updates without exposing private positions.
- Every simulated/production boundary is labeled in UI and README.
