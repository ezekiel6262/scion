# Final hackathon submission copy

## Form fields

- **Project name:** Scion
- **Team lead:** Zek
- **Email address:** larryclues@gmail.com
- **Team size:** 1 (solo builder)
- **Tracks:** Unstoppable DeFi; Investment Thesis; AI Security & Defense; Autonomous Business; Agent Economy; Open Innovation. Add Privacy & Private AI only if the form permits another track and use the qualified claim in `SUBMISSION.md`.
- **NEAR wallet address:** Enter a mainnet wallet that Zek controls and can receive the prize. Do not use a placeholder. Confirm whether `maleegg7870.near` is the intended prize wallet before submitting.
- **Repository:** https://github.com/ezekiel6262/scion
- **Demo post:** Add the final public X post URL after uploading `demo-video/scion-hackathon-demo-2026.mp4`.

## What did you build?

Scion is a non-custodial strategy, thesis and agent network built on NEAR. It solves a basic problem in social trading: people can post screenshots or signals, but followers cannot reliably verify when a thesis was created, see how it evolved through forks, buy only the private research they need, or execute it under their own risk limits.

On Scion, creators publish public or sealed strategies and plays, grant wallet-bound access, sell scoped and expiring keys, and keep verifiable lineage when another user forks their work. Followers can inspect live market data, open a strategy or trade with one key, set their own limits, and swap NEAR ecosystem tokens through NEAR Intents. Verified checkout splits route revenue to the creator and upstream strategy owners.

Scion also lets a user create a research, proposal or bounded autonomous agent. A bounded agent receives a dedicated recoverable NEAR subaccount with an owner recovery key and a separate execution key encrypted by AWS KMS. Scheduled AI cycles can propose a trade, but the model never sees a wallet key. Exact token identities, per-trade and rolling daily caps, and slippage are checked before the isolated signer can submit a 1Click swap. Every successful execution returns an attributable receipt; the owner can pause the agent or revoke its on-chain key.

NEAR is not a badge on the product: NEP-413 proves user ownership, NEAR accounts provide human-readable identities and recoverable agent subaccounts, NEAR Intents supplies cross-token routing and settlement, and finalized transactions anchor payments, access and execution receipts. Seeded activity is visibly marked **Demo** and excluded from verified live results. Fine-grained per-section re-sealing and historical scenarios are explicitly labeled protocol sandbox rather than presented as production infrastructure.

## X demo-post draft

Trading ideas travel fast, but proof and control usually disappear the moment someone posts a screenshot.

I built **Scion**: a non-custodial strategy, thesis and agent network where a user can publish a public or sealed strategy, sell a scoped key, fork another trader's work with lineage intact, and execute under their own limits.

The complete moment in this demo: a user discovers a strategy, verifies its history, follows the fork trail, checks live markets, then moves from research to an owner-controlled execution path. Creators earn from direct access and upstream fork royalties instead of losing attribution when their work spreads.

Scion also supports user-owned agents. A bounded agent gets a dedicated recoverable NEAR subaccount and a separate execution key encrypted by AWS KMS. The AI can research and propose, but it never sees the key. Exact token allowlists, trade caps, daily caps and slippage are enforced before a NEAR Intents 1Click swap can be signed. The owner can pause it or remove the execution key on-chain.

NEAR makes this concrete: NEP-413 wallet proofs, readable account identities, dedicated agent subaccounts, finalized payment and execution receipts, and NEAR Intents routing across ecosystem tokens. Seeded network activity is clearly marked Demo; verified live results stay separate.

Live: https://scionhub.xyz  
Repo: https://github.com/ezekiel6262/scion

What would you want to verify before trusting a forked strategy or a user-owned trading agent with limited capital?
