import { createOneClickClient, type OneClickQuoteResponse } from '@fastnear/intents';
import { useMemo, useState } from 'react';
import { nearWallet } from '../core/near-wallet';
import { useLive } from './live';

const MAX_NEAR = 0.1;
const YOCTO = 10n ** 24n;
const client = createOneClickClient();

const toYocto = (amount: number) => BigInt(Math.floor(amount * 1_000_000)) * (YOCTO / 1_000_000n);

export function LiveNearSwap() {
  const live = useLive();
  const [amount, setAmount] = useState(0.01);
  const [quote, setQuote] = useState<OneClickQuoteResponse>();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const owned = live.strategies.filter((strategy) => strategy.owner === live.session?.accountId);
  const [strategyId, setStrategyId] = useState('');
  const valid = Number.isFinite(amount) && amount > 0 && amount <= MAX_NEAR;
  const output = useMemo(() => quote?.quote.amountOutFormatted ?? quote?.quote.amountOut, [quote]);

  async function requestQuote(dry: boolean) {
    if (!live.session || !valid) throw new Error(`Enter between 0 and ${MAX_NEAR} NEAR.`);
    const tokens = await client.tokens();
    const near = tokens.find((token) => token.assetId === 'nep141:wrap.near');
    const usdc = tokens.find((token) => token.blockchain.toLowerCase() === 'near' && token.symbol.toUpperCase() === 'USDC');
    if (!near || !usdc) throw new Error('The live 1Click token registry does not currently list NEAR and NEAR USDC.');
    return client.quote({
      dry,
      swapType: 'EXACT_INPUT',
      slippageTolerance: 100,
      originAsset: near.assetId,
      destinationAsset: usdc.assetId,
      amount: toYocto(amount).toString(),
      depositType: 'ORIGIN_CHAIN',
      refundTo: live.session.accountId,
      refundType: 'ORIGIN_CHAIN',
      recipient: live.session.accountId,
      recipientType: 'DESTINATION_CHAIN',
      deadline: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
  }

  async function preview() {
    setBusy(true); setError(undefined); setStatus(undefined);
    try { setQuote(await requestQuote(true)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not obtain a live quote.'); }
    finally { setBusy(false); }
  }

  async function execute() {
    setBusy(true); setError(undefined); setStatus('Creating a fresh executable quote…');
    try {
      const executable = await requestQuote(false);
      const depositAddress = executable.quote.depositAddress;
      if (!depositAddress) throw new Error('1Click did not return a deposit address. No transaction was created.');
      if (BigInt(executable.quote.amountIn) > toYocto(MAX_NEAR)) throw new Error('Safety cap rejected a quote above 0.1 NEAR.');
      setQuote(executable);
      setStatus('Review and approve the transaction in your NEAR wallet.');
      const wallet = await nearWallet();
      const outcome = await wallet.signAndSendTransaction({
        network: 'mainnet',
        signerId: live.session!.accountId,
        receiverId: 'wrap.near',
        actions: [
          { type: 'FunctionCall', params: { methodName: 'near_deposit', args: {}, gas: '30000000000000', deposit: executable.quote.amountIn } },
          { type: 'FunctionCall', params: { methodName: 'ft_transfer', args: { receiver_id: depositAddress, amount: executable.quote.amountIn, memo: 'Scion 1Click swap' }, gas: '30000000000000', deposit: '1' } },
        ],
      });
      const txHash = outcome.transaction.hash;
      setStatus('Deposit sent. Waiting for NEAR Intents settlement…');
      await client.submitDeposit({ txHash, depositAddress, nearSenderAccount: live.session!.accountId });
      let settled:'SUCCESS'|'REFUNDED'|'FAILED'|undefined;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const result = await client.status({ depositAddress });
        setStatus(`Settlement: ${result.status.replaceAll('_', ' ').toLowerCase()}`);
        if (['SUCCESS', 'REFUNDED', 'FAILED'].includes(result.status)) { settled=result.status as typeof settled; break; }
        await new Promise((resolve) => window.setTimeout(resolve, 5000));
      }
      if(settled==='SUCCESS'&&strategyId)await live.recordExecution({strategyId,txHash,status:'SUCCESS',depositAddress,amountIn:executable.quote.amountIn,amountOut:executable.quote.amountOut});
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The swap could not be completed.'); setStatus(undefined); }
    finally { setBusy(false); }
  }

  if (!live.session) return <div className="box"><div className="box-body"><h2 className="h2">Live NEAR → USDC</h2><p className="muted">Connect and verify your NEAR wallet to request a mainnet quote.</p><button className="btn primary" onClick={() => void live.connect()}>Connect NEAR wallet</button></div></div>;

  return (
    <div className="box" style={{ marginBottom: 18 }}>
      <div className="box-head"><div><h2 className="h2">Live NEAR → USDC</h2><div className="small faint">NEAR mainnet · real funds · powered by 1Click / NEAR Intents</div></div><span className="pill">0.1 NEAR cap</span></div>
      <div className="box-body" style={{ display: 'grid', gap: 12 }}>
        <label className="label">You pay<input className="input" type="number" min="0.001" max={MAX_NEAR} step="0.001" value={amount} onChange={(event) => { setAmount(Number(event.target.value)); setQuote(undefined); }} /></label>
        <div className="small muted">Connected as <b>{live.session.accountId}</b>. Scion never receives your private key.</div>
        {owned.length>0&&<label className="label">Attach successful receipt to strategy<select className="input" value={strategyId} onChange={(event)=>setStrategyId(event.target.value)}><option value="">Do not attach</option>{owned.map((strategy)=><option value={strategy.id} key={strategy.id}>{strategy.name}</option>)}</select></label>}
        {quote && <dl className="kv"><dt>Estimated USDC</dt><dd>{output}</dd><dt>Minimum received</dt><dd>{quote.quote.minAmountOut ?? 'Included in signed quote'}</dd><dt>Estimated time</dt><dd>{quote.quote.timeEstimate ? `${quote.quote.timeEstimate}s` : 'Provided after execution quote'}</dd></dl>}
        {status && <div className="small strong" aria-live="polite">{status}</div>}
        {error && <div className="small" style={{ color: 'var(--danger)' }} role="alert">{error}</div>}
        {!quote ? <button className="btn primary lg" disabled={busy || !valid} onClick={() => void preview()}>{busy ? 'Getting live quote…' : 'Get live quote'}</button>
          : <button className="btn primary lg" disabled={busy || !valid} onClick={() => void execute()}>{busy ? 'Waiting…' : `Review wallet & swap ${amount} NEAR`}</button>}
        <p className="small faint">The final click opens your wallet with the exact contract actions. Funds move only if you approve there. An unauthenticated 1Click platform fee is included in its quote.</p>
      </div>
    </div>
  );
}
