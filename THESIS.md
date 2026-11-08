# Investment thesis: NEAR Intents as settlement infrastructure

## Claim

If NEAR Intents sustains high cross-chain volume while protocol-linked buybacks persist, Intents can become a meaningful demand and value-capture channel for NEAR. This is an infrastructure-adoption thesis, not a guaranteed token-price prediction.

Snapshot date: **15 October 2026**. Refresh the sources before presenting these values as current.

## Reproduce it

```bash
npm ci
npm run model
npm run model -- --monthlyVolumeB=8 --marketCapB=6.06 --thresholdPct=1
```

The command reads `data/near-intents.csv` and `data/near-facts.json`, verifies that the UI snapshot matches the CSV, prints every formula, and exits non-zero if the series diverges.

## Evidence for

- Seven committed observations take cumulative volume from **$2.95B on 30 October 2025** to **$34.78B on 13 October 2026**.
- September 2026 is recorded as a **$4.80B** volume month.
- The facts snapshot records **$16.03M** in protocol-linked buybacks since late February 2026.
- The model derives the implied take rate, monthly average, doubling time, and annualized buyback yield rather than embedding unexplained outputs.

Every factual input includes its source URL in the data files. The UI exposes the formulas and sensitivity controls.

## Evidence against / risks

- A record month is not proof of durable adoption; volume can slow or be incentive-driven.
- Volume should not be equated with revenue.
- Buyback policy, routing economics, and fee capture can change.
- Market capitalization and token supply move independently of usage.
- Contract, solver, bridge, and integration failures can damage demand.
- This is a dated snapshot, not a live oracle.

## Assumptions

1. Published cumulative-volume and buyback observations are comparable across dates.
2. The historical implied take rate is a sensitivity input, not promised policy.
3. Annualizing one month is a scenario, not a forecast.
4. Buyback yield is one value-capture measure; it does not establish token returns.

## Falsification

The thesis is invalidated or needs a new version if sustained verified volume contracts, buybacks stop or are proven unrelated to Intents, source corrections reverse the condition, a material settlement failure breaks the adoption assumption, or the selected inputs put annualized yield below `thresholdPct`.

## Evidence paths

- Inputs: [`data/near-intents.csv`](data/near-intents.csv), [`data/near-facts.json`](data/near-facts.json)
- Model: [`src/core/thesisModel.ts`](src/core/thesisModel.ts)
- Command: [`scripts/rerun-model.ts`](scripts/rerun-model.ts)
- Interactive view: `src/ui/Thesis.tsx`

This thesis is research, not financial advice.
