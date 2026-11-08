# Four-minute judge demo

This path requires no funds. Wallet-only actions can stop before signing.

## 0:00 — Idea

Open <https://scionhub.xyz>. Scion makes private trading intelligence composable: seal it, sell scoped access, fork it under personal limits, and evaluate it publicly without giving Scion custody.

## 0:35 — Proof-rich network

Open Home or Explore. Show return, drawdown, risk, co-signers, and lineage; **Demo** labels; public/sealed strategies; and Plays with entry, target, stop, crowd stance, and reveal state. Open a family tree to show attribution survives a fork.

## 1:20 — Live non-custodial trade

Open Trade and search a NEAR token by name, symbol, or contract. The client requests a NEAR Intents / 1Click quote. The user reviews and signs; Scion never receives the wallet key. Stop before approval if no wallet is connected.

## 2:05 — User-owned agent

Open Agents. Show owner, mode, allowed assets, trade/daily limits, slippage/leverage, pause, and revoke. Dedicated agent-account provisioning is real; autonomous execution is safety-paused until authority is verified.

## 2:50 — Reproducible thesis

Open the NEAR Intents thesis and change a sensitivity input. Then run:

```bash
npm run model -- --monthlyVolumeB=8 --thresholdPct=1
```

The command reads sourced inputs; `THESIS.md` states counterevidence and falsification.

## 3:25 — Security boundary

Open Security log. Private sections use independent keys; access is scoped, expiring, revocable, and holder-bound. Demo activity cannot execute. Paid access requires verified settlement.

Close: **Scion is a non-custodial market for strategies and user-owned trading agents, where privacy, proof, and attribution survive the fork.**
