export type LiveHealth = { ok: boolean; service: string; mode: 'simulated' | 'live' };

export type LiveStrategy = {
  id: string;
  slug: string;
  name: string;
  owner: string;
  latestVersionId: string;
  visibility: string;
  royaltyBps: number;
  latestVersion: {
    id: string;
    semver: string;
    riskClass: string;
    horizonDays: number;
    manifestHash: string;
    createdAt: string;
    restricted: string[];
  };
};

export type CreateLiveStrategy = {
  name: string;
  slug: string;
  visibility:'public'|'sealed';
  thesis: { summary: string; evidence: string[] };
  positions: { asset: string; chain: string; targetWeightBps: number; observedRaw:string; observedUnits:string; observedAt:string }[];
  rules: { maxSlippageBps: number; entry: string; exit: string };
  risk: { maxDrawdownBps: number; leverageBps: number };
  horizonDays: number;
  royaltyBps: number;
  holdingsProof:string;
};
export type LiveProfile = { accountId:string; displayName:string; handle:string; bio:string; avatarUrl?:string; createdAt:string; updatedAt:string };
export type LiveHolding = { asset:string; chain:'near'; contractId?:string; units:string; raw:string; decimals:number; usdPrice?:number; observedAt:string };
export type LiveBalances = { accountId:string; network:'mainnet'; observedAt:string; holdings:LiveHolding[]; proof:string };

type ApiEnvelope<T> = { data: T };
type ApiFailure = { error?: { code?: string; message?: string }; requestId?: string };

export class LiveApiError extends Error {
  constructor(message: string, readonly status: number, readonly code = 'request_failed', readonly requestId?: string) {
    super(message);
  }
}

export class LiveApi {
  private readonly fetcher: typeof fetch;

  constructor(readonly baseUrl = '/api', fetcher?: typeof fetch) {
    this.fetcher = fetcher ?? window.fetch.bind(window);
  }

  health() { return this.request<LiveHealth>('/health'); }
  async strategies() { return (await this.request<ApiEnvelope<LiveStrategy[]>>('/v1/strategies')).data; }

  async authChallenge() {
    return (await this.request<ApiEnvelope<{ challengeId:string; message:string; nonce:string; recipient:string; expiresAt:string }>>('/v1/auth/challenge', {
      method: 'POST', body: '{}',
    })).data;
  }

  async authVerify(input: { challengeId:string; accountId:string; publicKey:string; signature:string }) {
    return (await this.request<ApiEnvelope<{ token: string; accountId: string; expiresAt: string }>>('/v1/auth/verify', {
      method: 'POST', body: JSON.stringify(input),
    })).data;
  }

  async me(token:string){return (await this.request<ApiEnvelope<{accountId:string;profile?:LiveProfile}>>('/v1/me',{headers:{authorization:`Bearer ${token}`}})).data;}
  async balances(token:string){return (await this.request<ApiEnvelope<LiveBalances>>('/v1/auth/balances',{headers:{authorization:`Bearer ${token}`}})).data;}
  async saveProfile(token:string,input:Pick<LiveProfile,'displayName'|'handle'|'bio'> & {avatarUrl?:string}){return (await this.request<ApiEnvelope<LiveProfile>>('/v1/profile',{method:'POST',headers:{authorization:`Bearer ${token}`},body:JSON.stringify(input)})).data;}

  async createStrategy(token: string, strategy: CreateLiveStrategy) {
    return (await this.request<ApiEnvelope<{ strategy: LiveStrategy; version: LiveStrategy['latestVersion'] }>>('/v1/strategies', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify(strategy),
    })).data;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: { accept: 'application/json', 'content-type': 'application/json', ...init.headers },
      });
      const body = await response.json().catch(() => ({})) as T & ApiFailure;
      if (!response.ok) throw new LiveApiError(body.error?.message ?? `Request failed (${response.status})`, response.status, body.error?.code, body.requestId);
      return body;
    } catch (error) {
      if (error instanceof LiveApiError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') throw new LiveApiError('Scion API timed out', 0, 'timeout');
      throw new LiveApiError('Scion API is unavailable', 0, 'offline');
    } finally {
      window.clearTimeout(timeout);
    }
  }
}
