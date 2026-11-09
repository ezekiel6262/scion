# Four-minute judge demo

This path requires no funds. Wallet-only actions can stop before signing.

## 0:00 — Idea

Open <https://scionhub.xyz>. Scion makes private trading intelligence composable: seal it, sell scoped access, fork it under personal limits, and evaluate it publicly without giving Scion custody.

## 0:35 — Proof-rich network

Open Home or Explore. Show return, drawdown, risk, co-signers, and lineage; **Demo** labels; public/sealed strategies; and Plays with entry, target, stop, crowd stance, and reveal state. Open a family tree to show attribution survives a fork.

## 1:20 — Live non-custodial trade

Open Trade and search a NEAR token by name, symbol, or contract. The client requests a NEAR Intents / 1Click quote. The user reviews and signs; Scion never receives the wallet key. Stop before approval if no wallet is connected.

## 2:05 — User-owned autonomous agent

Open Agents. Create or inspect a bounded agent. Show owner, allowed assets, per-trade/daily limits, slippage, dedicated NEAR account, and **KMS execution ready** state. Explain the dual-key setup: the owner keeps recovery control while the unique agent key stays encrypted by AWS KMS. Run an AI cycle or show a settled receipt. The model proposes; deterministic policy decides; 1Click executes only inside the funded limits. Pause stops signing; revoke removes the execution key.

## 2:50 — Reproducible thesis

Open the NEAR Intents thesis and change a sensitivity input. Then run:

```bash
npm run model -- --monthlyVolumeB=8 --thresholdPct=1
```

The command reads sourced inputs; `THESIS.md` states counterevidence and falsification.

## 3:25 — Security boundary

Open Security log. Production strategy payloads are AES-256-GCM encrypted at rest. Access is scoped, expiring, revocable, and wallet-bound. Fine-grained section re-sealing remains visibly identified as the protocol sandbox. Demo activity cannot execute. Paid access requires verified settlement.

Close: **Scion is a non-custodial market for strategies and user-owned trading agents, where privacy, proof, and attribution survive the fork.**
