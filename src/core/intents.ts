// Execution adapters. Scion never holds user funds: the follower signs each intent.
//
// SimulatedIntents is what the demo runs. It models the 1Click flow (quote, deposit,
// settlement, signed receipt) with a local solver key so receipts are really signed.
// OneClickAdapter targets the NEAR Intents 1Click API and is wired for M2. It has
// NOT been verified against the live API in this slice and is not called by the demo.

import { newSigner, sign, sha256 } from './crypto';

export interface QuoteRequest { fromAsset: string; fromChain: string; toAsset: string; toChain: string; amountUsd: number; slippageBps: number; wallet: string }
export interface Quote { id: string; req: QuoteRequest; amountOut: number; minOut: number; price: number; feeUsd: number; route: string; deadline: number; simulated: boolean }
export interface SolverReceipt { quoteId: string; wallet: string; from: string; to: string; fromChain: string; toChain: string; amountIn: number; amountOut: number; price: number; ts: number; prevHash: string; hash: string; solverSig: string; simulated: boolean }

export interface IntentsAdapter {
  readonly name: string;
  quote(req: QuoteRequest, prices: Record<string, number>, now: number): Promise<Quote>;
  settle(q: Quote, prevHash: string, now: number): Promise<SolverReceipt>;
}

export class SimulatedIntents implements IntentsAdapter {
  readonly name = 'Simulated NEAR Intents solver';
  private solver?: CryptoKeyPair;
  async key() { return (this.solver ??= await newSigner()); }

  async quote(req: QuoteRequest, prices: Record<string, number>, now: number): Promise<Quote> {
    const p = prices[req.toAsset] ?? 1;
    const feeUsd = +(req.amountUsd * 0.0008).toFixed(2); // 8 bps solver fee
    const amountOut = (req.amountUsd - feeUsd) / p;
    const route = req.fromChain === req.toChain ? `${req.fromChain} swap` : `${req.fromChain} to ${req.toChain} via NEAR Intents`;
    return { id: 'q_' + crypto.randomUUID().slice(0, 8), req, amountOut, minOut: amountOut * (1 - req.slippageBps / 10000), price: p, feeUsd, route, deadline: now + 120_000, simulated: true };
  }

  async settle(q: Quote, prevHash: string, now: number): Promise<SolverReceipt> {
    if (now > q.deadline) throw new Error('Quote expired. Request a new quote.');
    const body = { quoteId: q.id, wallet: q.req.wallet, from: q.req.fromAsset, to: q.req.toAsset, fromChain: q.req.fromChain, toChain: q.req.toChain, amountIn: q.req.amountUsd, amountOut: +q.amountOut.toFixed(8), price: q.price, ts: now, prevHash };
    const hash = await sha256(JSON.stringify(body));
    const solverSig = await sign((await this.key()).privateKey, { ...body, hash });
    return { ...body, hash, solverSig, simulated: true };
  }
}

/** M2: live 1Click quotes. Asset ids follow the Defuse naming, e.g. nep141:wrap.near. */
export class OneClickAdapter {
  readonly name = 'NEAR Intents 1Click API';
  constructor(private base = 'https://1click.chaindefuser.com/v0') {}
  async tokens() {
    const r = await fetch(`${this.base}/tokens`);
    if (!r.ok) throw new Error(`1Click tokens failed: ${r.status}`);
    return r.json();
  }
  async dryQuote(p: { originAsset: string; destinationAsset: string; amount: string; slippageBps: number; recipient: string; refundTo: string }) {
    const r = await fetch(`${this.base}/quote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        dry: true, swapType: 'EXACT_INPUT', slippageTolerance: p.slippageBps,
        originAsset: p.originAsset, depositType: 'ORIGIN_CHAIN', destinationAsset: p.destinationAsset,
        amount: p.amount, refundTo: p.refundTo, refundType: 'ORIGIN_CHAIN',
        recipient: p.recipient, recipientType: 'DESTINATION_CHAIN',
        deadline: new Date(Date.now() + 10 * 60_000).toISOString(),
      }),
    });
    if (!r.ok) throw new Error(`1Click quote failed: ${r.status}`);
    return r.json();
  }
}
