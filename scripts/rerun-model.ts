// npm run model
// Re-runs the flagship NEAR Intents thesis from the committed data files.
import { readFileSync } from 'node:fs';
import { defaults, parseCsv, POINTS, runModel, type Facts } from '../src/core/thesisModel';

const csv = parseCsv(readFileSync('data/near-intents.csv', 'utf8'));
const facts = JSON.parse(readFileSync('data/near-facts.json', 'utf8')) as Facts;
const same = JSON.stringify(csv.map((p) => [p.date, p.cumB])) === JSON.stringify(POINTS.map((p) => [p.date, p.cumB]));
console.log(`Data: ${csv.length} sourced points, ${csv[0].date} to ${csv.at(-1)!.date}. App snapshot ${same ? 'matches' : 'DIFFERS FROM'} the CSV.\n`);
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const i = { ...defaults(facts), ...Object.fromEntries(Object.entries(args).map(([k, v]) => [k, Number(v)])) };
const r = runModel(csv, facts, i);
for (const s of r.steps) console.log(`${s.label}\n  ${s.formula}\n  = ${s.value}\n`);
console.log(`Thesis condition: buyback yield >= ${i.thresholdPct}% of market cap. ${r.holds ? 'HOLDS' : 'FAILS'}.`);
console.log('\nTry: npm run model -- --monthlyVolumeB=8 --marketCapB=6.06');
if (!same) process.exit(1);
