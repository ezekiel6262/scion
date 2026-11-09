import { useEffect, useState } from 'react';
import { initSigningPage, type SignPageSession } from '@peerfolio/privy-near-connect/sign-page';
import { privyAuthStatus, privyClient } from '../core/privy-auth';

export function PrivySignPage() {
  const [session, setSession] = useState<SignPageSession>();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!privyAuthStatus().configured) return setError('Scion email login is not configured.');
    const controller = new AbortController();
    void privyClient()
      .then((privy) => initSigningPage(privy as unknown as Parameters<typeof initSigningPage>[0], { allowedOrigins: [window.location.origin], debug: false, signal: controller.signal }))
      .then(setSession)
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Signing request failed.');
      });
    return () => controller.abort();
  }, []);

  return <main className="sign-page"><div className="box"><div className="box-body"><p className="eyebrow">Scion secure approval</p><h1 className="h2">Approve with your embedded wallet</h1>{error ? <p className="loss">{error}</p> : session ? <><p className="muted">Requested by <b>{session.targetOrigin}</b>. Review the request, then approve it with your Scion wallet.</p><button className="btn primary lg" onClick={() => void session.sign()}>Approve request</button><button className="btn ghost lg" onClick={() => window.close()}>Reject</button></> : <p className="muted">Preparing your secure signing request…</p>}</div></div></main>;
}
