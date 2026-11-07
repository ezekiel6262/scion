// The flagship public thesis model. Pure functions, no simulation.
// The same code runs in the app (Evidence section) and in `npm run model`,
// which re-reads data/near-intents.csv and data/near-facts.json.

export interface Point { date: string; cumB: number; source: string; url: string }
export interface Facts {
  asOf: string;
  monthlyVolumeRecordUsdB: { value: number; month: string; previousHighUsdB: number; previousHighMonth: string; source: string; url: string };
  buybacksUsdM: { value: number; since: string; through: string; note: string; source: string; url: string };
  cumulativeAtEndFebruaryUsdB: { value: number; derived: string; source: string; url: string };
  marketCapUsdB: { value: number; date: string; source: string; url: string };
  priceUsd: { value: number; date: string; source: string; url: string };
  supplyB: { value: number; stakedPct: number; date: string; source: string; url: string };
  confidentialShare: { confidentialUsdB: number; totalUsdB: number; source: string; url: string };
  incident: { text: string; source: string; url: string };
}

// Snapshot embedded for the app. `npm run model` checks it matches the CSV.
export const POINTS: Point[] = [
  { date: '2025-10-30', cumB: 2.95, source: 'Coinspeaker, from the NEAR Intents Dune dashboard', url: 'https://www.mexc.com/news/148545' },
  { date: '2025-11-10', cumB: 4.5, source: 'PANews, from Token Terminal', url: 'https://www.mexc.com/news/160357' },
  { date: '2026-01-16', cumB: 10.0, source: 'Coinspeaker, from the NEAR Intents Dune dashboard', url: 'https://www.mexc.com/it-IT/news/492807' },
  { date: '2026-05-25', cumB: 19.0, source: 'Crypto Briefing', url: 'https://cryptobriefing.com/near-intents-20b-transaction-volume/' },
  { date: '2026-06-03', cumB: 20.0, source: 'Crypto Briefing', url: 'https://cryptobriefing.com/near-intents-20b-transaction-volume/' },
  { date: '2026-09-21', cumB: 29.3, source: 'Cointelegraph, from the NEAR Intents Explorer', url: 'https://cointelegraph.com/markets/near-price-surge-intents-zcash-privacy' },
  { date: '2026-10-13', cumB: 34.78, source: "Bitcoin.com, from NEAR's revenue dashboard", url: 'https://www.bitcoin.com/price/near-protocol-near' },
];

export const FACTS: Facts = {
  asOf: '2026-10-15',
  monthlyVolumeRecordUsdB: { value: 4.8, month: '2026-09', previousHighUsdB: 3.65, previousHighMonth: '2025-11', source: "Bitcoin.com, from NEAR's revenue dashboard", url: 'https://www.bitcoin.com/price/near-protocol-near' },
  buybacksUsdM: { value: 16.03, since: 'late February 2026', through: '2026-10-15', note: 'Protocol revenue from Intents swaps goes toward buying NEAR', source: "Bitcoin.com, from NEAR's revenue dashboard", url: 'https://www.bitcoin.com/price/near-protocol-near' },
  cumulativeAtEndFebruaryUsdB: { value: 13.0, derived: 'Bankless reported about $18B total with about $5B since end of February 2026', source: 'Bankless', url: 'https://www.bankless.com/read/a-revival-for-near' },
  marketCapUsdB: { value: 6.06, date: '2026-10-15', source: 'Bitcoin.com', url: 'https://www.bitcoin.com/price/near-protocol-near' },
  priceUsd: { value: 4.63, date: '2026-10-15', source: 'Bitcoin.com', url: 'https://www.bitcoin.com/price/near-protocol-near' },
  supplyB: { value: 1.31, stakedPct: 45.7, date: '2026-10-15', source: 'Bitcoin.com', url: 'https://www.bitcoin.com/price/near-protocol-near' },
  confidentialShare: { confidentialUsdB: 1.9, totalUsdB: 31.4, source: 'Crypto Briefing, from Dune', url: 'https://cryptobriefing.com/near-protocol-intents-30-billion-volume-record/' },
  incident: { text: 'About $3.8M was withdrawn through a contract bug on 1 October 2026 and returned on 2 October; the faulty feature was removed on 7 October', source: 'Bitcoin.com', url: 'https://www.bitcoin.com/price/near-protocol-near' },
};

const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;

export interface ModelInputs { monthlyVolumeB: number; takeBps: number; marketCapB: number; thresholdPct: number }
export interface ModelResult {
  impliedTakeBps: number;
  avgMonthlyB: number;
  doublingDays: number;
  annualBuybackM: number;
  buybackYieldPct: number;
  holds: boolean;
  steps: { label: string; formula: string; value: string }[];
}

export function defaults(f: Facts = FACTS): ModelInputs {
  return { monthlyVolumeB: f.monthlyVolumeRecordUsdB.value, takeBps: +impliedTakeBps(POINTS, f).toFixed(2), marketCapB: f.marketCapUsdB.value, thresholdPct: 0.5 };
}

export function impliedTakeBps(points: Point[], f: Facts) {
  const last = points.at(-1)!;
  const sinceFeb = last.cumB - f.cumulativeAtEndFebruaryUsdB.value;
  return (f.buybacksUsdM.value * 1e6) / (sinceFeb * 1e9) * 10_000;
}

export function runModel(points: Point[], f: Facts, i: ModelInputs): ModelResult {
  const a = points.find((p) => p.date === '2026-01-16')!, z = points.at(-1)!;
  const span = days(a.date, z.date);
  const avgMonthlyB = ((z.cumB - a.cumB) / span) * 30.44;
  const doublingDays = (span * Math.LN2) / Math.log(z.cumB / a.cumB);
  const take = impliedTakeBps(points, f);
  const annualBuybackM = i.monthlyVolumeB * 12 * 1e3 * (i.takeBps / 10_000);
  const buybackYieldPct = (annualBuybackM / (i.marketCapB * 1e3)) * 100;
  return {
    impliedTakeBps: take, avgMonthlyB, doublingDays, annualBuybackM, buybackYieldPct, holds: buybackYieldPct >= i.thresholdPct,
    steps: [
      { label: 'Average monthly volume since 16 Jan 2026', formula: `(${z.cumB} - ${a.cumB}) / ${span.toFixed(0)} days x 30.44`, value: `$${avgMonthlyB.toFixed(2)}B` },
      { label: 'Cumulative volume doubling time', formula: `${span.toFixed(0)} x ln 2 / ln(${z.cumB} / ${a.cumB})`, value: `${doublingDays.toFixed(0)} days` },
      { label: 'Implied buyback take rate', formula: `$${f.buybacksUsdM.value}M / ($${z.cumB}B - $${f.cumulativeAtEndFebruaryUsdB.value}B)`, value: `${take.toFixed(2)} bps` },
      { label: 'Annual buyback at your inputs', formula: `$${i.monthlyVolumeB}B x 12 x ${i.takeBps} bps`, value: `$${annualBuybackM.toFixed(1)}M` },
      { label: 'Buyback yield on market cap', formula: `$${annualBuybackM.toFixed(1)}M / $${i.marketCapB}B`, value: `${buybackYieldPct.toFixed(2)}%` },
    ],
  };
}

export function parseCsv(text: string): Point[] {
  const lines = text.trim().split('\n').slice(1);
  return lines.map((l) => {
    const cells: string[] = [];
    let cur = '', q = false;
    for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { cells.push(cur); cur = ''; } else cur += ch; }
    cells.push(cur);
    return { date: cells[0], cumB: +cells[1], source: cells[2], url: cells[3] };
  });
}
