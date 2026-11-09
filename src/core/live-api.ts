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
export type LiveProfile = { accountId:string; displayName:string; handle:string; bio:string; avatarUrl?:string; demo?:boolean; createdAt:string; updatedAt:string };
export type LiveHolding = { asset:string; chain:'near'; contractId?:string; units:string; raw:string; decimals:number; usdPrice?:number; observedAt:string };
export type LiveBalances = { accountId:string; network:'mainnet'; observedAt:string; holdings:LiveHolding[]; proof:string };
export type LiveExecution = {id:string;executor:string;versionId:string;intentHash:string;policyHash:string;mode:'live'|'simulated';status:string;createdAt:string};
export type LiveStrategyDetail = {strategy:Omit<LiveStrategy,'latestVersion'>;profile?:LiveProfile;version:LiveStrategy['latestVersion'] & Partial<{thesis:{summary:string;evidence:string[]};positions:CreateLiveStrategy['positions'];rules:CreateLiveStrategy['rules'];risk:CreateLiveStrategy['risk']}>;versions:LiveStrategy['latestVersion'][];executions:LiveExecution[]};
export type LiveFeedItem={strategy:LiveStrategy;profile?:LiveProfile;demo:boolean;likes:number;comments:number;forks:number;liked:boolean;following:boolean};
export type LiveComment={id:string;author:string;body:string;createdAt:string;profile?:LiveProfile};
export type LiveNotification={id:string;actor:string;kind:string;strategyId?:string;text:string;read:boolean;createdAt:string};
export type LivePublicProfile={profile:LiveProfile;strategies:LiveStrategy[];followers:number;following:number;viewerFollowing:boolean};
export type LiveDeviceSession={id:string;userAgent:string;createdAt:string;lastSeenAt:string;revoked:boolean;current:boolean};
export type LiveAuditEvent={id:string;event:string;details:Record<string,unknown>;createdAt:string};
export type LiveOffer={id:string;issuer:string;versionId:string;scopes:string[];expiresInSeconds:number;priceMinor:number;status:string;createdAt:string};
export type LiveCommerce={paymentsEnabled:boolean;paymentConfig?:{contractId:string;treasury:string};protocolFeeBps:number;earnings:{account:string;currency:'USDC';totalMinor:number;entries:{id:string;kind:string;amountMinor:number;createdAt:string}[]};offers:LiveOffer[];marketplace:LiveOffer[];keys:{id:string;versionId:string;scopes:string[];expiresAt:string;status:string;priceMinor:number}[];purchases:{id:string;offerId:string;amountMinor:number;status:string;createdAt:string}[]};
export type LiveInviteStatus={required:boolean;admitted:boolean;remaining:number;invites:{id:string;usedBy?:string;createdAt:string}[]};
export type LiveAgentPolicy={allowedAssets:string[];maxTradeMinor:number;dailyLimitMinor:number;maxAllocationBps:number;maxSlippageBps:number;maxLeverageBps:number;requiresOwnerApproval:boolean};
export type LiveAgentProposal={id:string;agentId:string;action:'watch'|'trade';thesis:string;rationale:string;asset?:string;side?:'buy'|'sell';notionalMinor?:number;confidence:number;status:string;executionState:string;executionReceiptId?:string;executionError?:string;createdAt:string};
export type LiveSwap={id:string;txHash:string;depositAddress:string;originAsset:string;destinationAsset:string;originSymbol:string;destinationSymbol:string;amountIn:string;amountOut:string;amountInFormatted?:string;amountOutFormatted?:string;status:'SUCCESS';verified:true;createdAt:string};
export type LiveAgent={id:string;owner:string;name:string;handle:string;description:string;mode:'research'|'proposal'|'bounded';status:'active'|'paused'|'revoked';visibility:'public'|'private';executionAccount?:string;earningsAccount?:string;accountStatus?:'active';accountTxHash?:string;executionPublicKey?:string;authorityPreparedAt?:string;automationReady:boolean;scheduleEnabled?:boolean;scheduleHours?:number;demo?:boolean;policy:LiveAgentPolicy;policyHash:string;stats:{proposals:number;wins:number;losses:number;verifiedExecutions:number};proposals?:LiveAgentProposal[];createdAt:string;updatedAt:string};

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
  async feed(token?:string){return (await this.request<ApiEnvelope<LiveFeedItem[]>>('/v1/feed',token?{headers:{authorization:`Bearer ${token}`}}:{})).data;}
  async toggleFollow(token:string,account:string){return (await this.request<ApiEnvelope<{following:boolean}>>(`/v1/social/follows/${encodeURIComponent(account)}`,{method:'POST',headers:{authorization:`Bearer ${token}`},body:'{}'})).data;}
  async publicProfile(account:string,token?:string){return (await this.request<ApiEnvelope<LivePublicProfile>>(`/v1/profiles/${encodeURIComponent(account)}`,token?{headers:{authorization:`Bearer ${token}`}}:{})).data;}
  async toggleLike(token:string,strategyId:string){return (await this.request<ApiEnvelope<{liked:boolean}>>(`/v1/social/likes/${encodeURIComponent(strategyId)}`,{method:'POST',headers:{authorization:`Bearer ${token}`},body:'{}'})).data;}
  async comments(strategyId:string){return (await this.request<ApiEnvelope<LiveComment[]>>(`/v1/strategies/${encodeURIComponent(strategyId)}/comments`)).data;}
  async addComment(token:string,strategyId:string,body:string){return (await this.request<ApiEnvelope<LiveComment>>(`/v1/strategies/${encodeURIComponent(strategyId)}/comments`,{method:'POST',headers:{authorization:`Bearer ${token}`},body:JSON.stringify({body})})).data;}
  async notifications(token:string){return (await this.request<ApiEnvelope<LiveNotification[]>>('/v1/notifications',{headers:{authorization:`Bearer ${token}`}})).data;}
  async readNotifications(token:string){return this.request<ApiEnvelope<{updated:number}>>('/v1/notifications/read',{method:'POST',headers:{authorization:`Bearer ${token}`},body:'{}'});}
  async sessions(token:string){return (await this.request<ApiEnvelope<LiveDeviceSession[]>>('/v1/security/sessions',{headers:{authorization:`Bearer ${token}`}})).data;}
  async revokeSession(token:string,id:string){return (await this.request<ApiEnvelope<{id:string;revoked:boolean}>>(`/v1/security/sessions/${encodeURIComponent(id)}/revoke`,{method:'POST',headers:{authorization:`Bearer ${token}`},body:'{}'})).data;}
  async audit(token:string){return (await this.request<ApiEnvelope<LiveAuditEvent[]>>('/v1/security/audit',{headers:{authorization:`Bearer ${token}`}})).data;}
  async block(token:string,account:string){return (await this.request<ApiEnvelope<{blocked:boolean}>>(`/v1/moderation/blocks/${encodeURIComponent(account)}`,{method:'POST',headers:{authorization:`Bearer ${token}`},body:'{}'})).data;}
  async report(token:string,input:{targetType:'profile'|'strategy'|'comment';targetId:string;reason:string}){return (await this.request<ApiEnvelope<{id:string;status:string}>>('/v1/moderation/reports',{method:'POST',headers:{authorization:`Bearer ${token}`},body:JSON.stringify(input)})).data;}
  async commerce(token:string){return (await this.request<ApiEnvelope<LiveCommerce>>('/v1/account/commerce',{headers:{authorization:`Bearer ${token}`}})).data;}
  async invites(token:string){return (await this.request<ApiEnvelope<LiveInviteStatus>>('/v1/beta/invites',{headers:{authorization:`Bearer ${token}`}})).data;}
  async createInvite(token:string){return (await this.request<ApiEnvelope<{code:string}>>('/v1/beta/invites',{method:'POST',headers:{authorization:`Bearer ${token}`},body:'{}'})).data;}
  async agents(token?:string){return (await this.request<ApiEnvelope<LiveAgent[]>>('/v1/agents',token?{headers:{authorization:`Bearer ${token}`}}:{})).data;}
  async agent(id:string,token?:string){return (await this.request<ApiEnvelope<LiveAgent>>(`/v1/agents/${encodeURIComponent(id)}`,token?{headers:{authorization:`Bearer ${token}`}}:{})).data;}
  async createAgent(token:string,input:{name:string;handle:string;description:string;mode:LiveAgent['mode'];visibility:'public'|'private';executionAccount?:string;policy:Omit<LiveAgentPolicy,'requiresOwnerApproval'>}){return (await this.request<ApiEnvelope<LiveAgent>>('/v1/agents',{method:'POST',headers:{authorization:`Bearer ${token}`},body:JSON.stringify(input)})).data;}
  async setAgentStatus(token:string,id:string,status:'active'|'paused'|'revoked'){return (await this.request<ApiEnvelope<LiveAgent>>(`/v1/agents/${encodeURIComponent(id)}/status`,{method:'POST',headers:{authorization:`Bearer ${token}`},body:JSON.stringify({status})})).data;}
  async prepareAgentAuthority(token:string,id:string){return (await this.request<ApiEnvelope<{publicKey:string;preparedAt:string}>>(`/v1/agents/${encodeURIComponent(id)}/authority`,{method:'POST',headers:{authorization:`Bearer ${token}`}})).data;}
  async registerAgentAccount(token:string,id:string,input:{accountId:string;txHash:string;publicKey?:string}){return (await this.request<ApiEnvelope<LiveAgent>>(`/v1/agents/${encodeURIComponent(id)}/account`,{method:'POST',headers:{authorization:`Bearer ${token}`},body:JSON.stringify(input)})).data;}
  async createAgentProposal(token:string,id:string,input:{action:'watch'|'trade';thesis:string;rationale:string;asset?:string;side?:'buy'|'sell';notionalMinor?:number;confidence:number}){return (await this.request<ApiEnvelope<LiveAgentProposal>>(`/v1/agents/${encodeURIComponent(id)}/proposals`,{method:'POST',headers:{authorization:`Bearer ${token}`},body:JSON.stringify(input)})).data;}
  async decideAgentProposal(token:string,id:string,decision:'approve'|'reject'){return (await this.request<ApiEnvelope<LiveAgentProposal>>(`/v1/agent-proposals/${encodeURIComponent(id)}/decision`,{method:'POST',headers:{authorization:`Bearer ${token}`},body:JSON.stringify({decision})})).data;}
  async runAgent(token:string,agentId:string){return (await this.request<ApiEnvelope<{agentId:string;run:{id:string;model:string;inputTokens:number;outputTokens:number;latencyMs:number};proposal:LiveAgentProposal}>>('/v1/agent-runtime/run',{method:'POST',headers:{authorization:`Bearer ${token}`},body:JSON.stringify({agentId})},90_000)).data;}
  async createOffer(token:string,input:{versionId:string;scopes:string[];expiresInSeconds:number;priceMinor:number}){return (await this.request<ApiEnvelope<LiveOffer>>('/v1/access/offers',{method:'POST',headers:{authorization:`Bearer ${token}`},body:JSON.stringify(input)})).data;}
  async checkoutPlan(token:string,offerId:string){return (await this.request<ApiEnvelope<{token:string;contractId:string;amountMinor:number;transfers:{receiverId:string;amountMinor:number;kind:string}[]}>>('/v1/access/checkout-plan',{method:'POST',headers:{authorization:`Bearer ${token}`},body:JSON.stringify({offerId})})).data;}
  async verifyPayment(token:string,txHash:string,checkoutPlan:string){return (await this.request<ApiEnvelope<{proof:string;txHash:string}>>('/v1/auth/transactions/payment',{method:'POST',headers:{authorization:`Bearer ${token}`},body:JSON.stringify({txHash,checkoutPlan})})).data;}
  async purchase(token:string,offerId:string,settlementProof:string,idempotencyKey:string){return (await this.request<ApiEnvelope<{purchase:unknown;capabilityToken:string}>>('/v1/access/purchases',{method:'POST',headers:{authorization:`Bearer ${token}`,'idempotency-key':idempotencyKey},body:JSON.stringify({offerId,settlementProof})})).data;}
  async verifyExecution(token:string,input:{txHash:string;depositAddress:string;amountIn:string;originContract?:string}){return (await this.request<ApiEnvelope<{proof:string}>>('/v1/auth/transactions/execution',{method:'POST',headers:{authorization:`Bearer ${token}`},body:JSON.stringify(input)})).data;}
  async createFork(token:string,input:{parentVersionId:string;name:string;slug:string;changes:Record<string,unknown>;capabilityToken?:string}){return (await this.request<ApiEnvelope<{strategy:LiveStrategy;version:LiveStrategy['latestVersion']}>>('/v1/forks',{method:'POST',headers:{authorization:`Bearer ${token}`},body:JSON.stringify(input)})).data;}

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
  async uploadAvatar(token:string,input:{contentType:string;data:string}){return (await this.request<ApiEnvelope<{avatarUrl:string}>>('/v1/auth/avatar',{method:'POST',headers:{authorization:`Bearer ${token}`},body:JSON.stringify(input)})).data;}
  async saveProfile(token:string,input:Pick<LiveProfile,'displayName'|'handle'|'bio'> & {avatarUrl?:string;inviteCode?:string}){return (await this.request<ApiEnvelope<LiveProfile>>('/v1/profile',{method:'POST',headers:{authorization:`Bearer ${token}`},body:JSON.stringify(input)})).data;}

  async createStrategy(token: string, strategy: CreateLiveStrategy) {
    return (await this.request<ApiEnvelope<{ strategy: LiveStrategy; version: LiveStrategy['latestVersion'] }>>('/v1/strategies', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify(strategy),
    })).data;
  }
  async strategy(id:string,token?:string){return (await this.request<ApiEnvelope<LiveStrategyDetail>>(`/v1/strategies/${encodeURIComponent(id)}`,token?{headers:{authorization:`Bearer ${token}`}}:{})).data;}
  async myStrategies(token:string){return (await this.request<ApiEnvelope<LiveStrategy[]>>('/v1/my/strategies',{headers:{authorization:`Bearer ${token}`}})).data;}
  async updateStrategy(token:string,id:string,input:Partial<CreateLiveStrategy>){return (await this.request<ApiEnvelope<{strategy:LiveStrategy;version:LiveStrategy['latestVersion']}>>(`/v1/strategies/${encodeURIComponent(id)}`,{method:'POST',headers:{authorization:`Bearer ${token}`},body:JSON.stringify(input)})).data;}
  async recordExecution(token:string,input:{strategyId:string;txHash:string;status:'SUCCESS';depositAddress:string;amountIn:string;amountOut?:string;verificationProof:string}){return (await this.request<ApiEnvelope<LiveExecution>>('/v1/executions/receipts',{method:'POST',headers:{authorization:`Bearer ${token}`},body:JSON.stringify(input)})).data;}
  async swaps(token:string){return (await this.request<ApiEnvelope<LiveSwap[]>>('/v1/swaps',{headers:{authorization:`Bearer ${token}`}})).data;}
  async recordSwap(token:string,input:Omit<LiveSwap,'id'|'status'|'verified'|'createdAt'> & {verificationProof:string}){return (await this.request<ApiEnvelope<LiveSwap>>('/v1/swaps',{method:'POST',headers:{authorization:`Bearer ${token}`},body:JSON.stringify(input)})).data;}

  private async request<T>(path: string, init: RequestInit = {},timeoutMs=10_000): Promise<T> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
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
