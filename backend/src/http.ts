import { DomainError } from './domain.ts'; import type { ScionService } from './service.ts'; import type { WalletAuthService } from './auth.ts'; import { randomUUID } from 'node:crypto'; import { verifyToken } from './crypto.ts';

const json=(body:unknown,status=200,requestId?:string)=>Response.json(body,{status,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type,idempotency-key,x-near-account,x-view-key','access-control-allow-methods':'GET,POST,OPTIONS','x-request-id':requestId??''}});
export const createHandler=(service:ScionService,auth:WalletAuthService,internalSecret?:string)=>async(request:Request)=>{
  const requestId=randomUUID(),url=new URL(request.url),path=(url.pathname.replace(/^\/api(?=\/|$)/,'').replace(/\/$/,'')||'/');
  if(request.method==='OPTIONS')return json({},204,requestId);let actor:string|undefined;
  try{
    actor=resolveActor(request,auth);const bearer=bearerToken(request);if(actor&&bearer)await service.ensureSession(actor,bearer,request.headers.get('user-agent')??'Unknown device');
    console.info(JSON.stringify({event:'request',requestId,method:request.method,path,actor}));
    if(request.method==='GET'&&path==='/health')return json({ok:true,service:'scion-api',mode:process.env.SCION_EXECUTION_MODE??'simulated'},200,requestId);
    if(request.method==='POST'&&path==='/v1/auth/challenge'){const b=await request.json() as any;return json({data:await auth.challenge(b.accountId,b.publicKey)},201,requestId);}
    if(request.method==='POST'&&path==='/v1/auth/verify'){const b=await request.json() as any;return json({data:await auth.verify(b.challengeId,b.signature)},200,requestId);}
    if(request.method==='GET'&&path==='/v1/strategies')return json({data:await service.listStrategies()},200,requestId);
    if(request.method==='GET'&&path==='/v1/feed')return json({data:await service.feed(actor)},200,requestId);
    let social=path.match(/^\/v1\/profiles\/([^/]+)$/);if(request.method==='GET'&&social)return json({data:await service.publicProfile(decodeURIComponent(social[1]),actor)},200,requestId);
    social=path.match(/^\/v1\/social\/follows\/([^/]+)$/);if(request.method==='POST'&&social)return json({data:await service.toggleFollow(requireActor(actor),decodeURIComponent(social[1]))},200,requestId);
    social=path.match(/^\/v1\/social\/likes\/([^/]+)$/);if(request.method==='POST'&&social)return json({data:await service.toggleLike(requireActor(actor),social[1])},200,requestId);
    social=path.match(/^\/v1\/strategies\/([^/]+)\/comments$/);if(request.method==='GET'&&social)return json({data:await service.comments(social[1])},200,requestId);if(request.method==='POST'&&social)return json({data:await service.addComment(requireActor(actor),social[1],await request.json())},201,requestId);
    if(request.method==='GET'&&path==='/v1/notifications')return json({data:await service.notifications(requireActor(actor))},200,requestId);
    if(request.method==='POST'&&path==='/v1/notifications/read')return json({data:await service.markNotificationsRead(requireActor(actor))},200,requestId);
    if(request.method==='GET'&&path==='/v1/security/sessions')return json({data:await service.sessions(requireActor(actor),bearer)},200,requestId);
    let security=path.match(/^\/v1\/security\/sessions\/(.+)\/revoke$/);if(request.method==='POST'&&security)return json({data:await service.revokeSession(requireActor(actor),decodeURIComponent(security[1]))},200,requestId);
    security=path.match(/^\/v1\/moderation\/blocks\/(.+)$/);if(request.method==='POST'&&security)return json({data:await service.toggleBlock(requireActor(actor),decodeURIComponent(security[1]))},200,requestId);
    if(request.method==='POST'&&path==='/v1/moderation/reports')return json({data:await service.report(requireActor(actor),await request.json())},201,requestId);
    if(request.method==='GET'&&path==='/v1/admin/reports')return json({data:await service.moderationQueue(requireActor(actor))},200,requestId);
    const moderation=path.match(/^\/v1\/admin\/reports\/(.+)$/);if(request.method==='POST'&&moderation)return json({data:await service.resolveReport(requireActor(actor),decodeURIComponent(moderation[1]),await request.json())},200,requestId);
    if(request.method==='GET'&&path==='/v1/security/audit')return json({data:await service.auditLog(requireActor(actor))},200,requestId);
    if(request.method==='GET'&&path==='/v1/beta/invites')return json({data:await service.inviteStatus(requireActor(actor))},200,requestId);
    if(request.method==='POST'&&path==='/v1/beta/invites')return json({data:await service.createInvite(requireActor(actor))},201,requestId);
    if(request.method==='GET'&&path==='/v1/account/commerce')return json({data:await service.commerce(requireActor(actor))},200,requestId);
    if(request.method==='GET'&&path==='/v1/agents')return json({data:await service.agents(actor)},200,requestId);
    if(request.method==='POST'&&path==='/v1/agents')return json({data:await service.createAgent(requireActor(actor),await request.json())},201,requestId);
    let agentRoute=path.match(/^\/v1\/agents\/([^/]+)$/);if(request.method==='GET'&&agentRoute)return json({data:await service.agentDetail(agentRoute[1],actor)},200,requestId);
    agentRoute=path.match(/^\/v1\/agents\/([^/]+)\/status$/);if(request.method==='POST'&&agentRoute){const b=await request.json() as any;return json({data:await service.setAgentStatus(requireActor(actor),agentRoute[1],b.status)},200,requestId);}
    agentRoute=path.match(/^\/v1\/agents\/([^/]+)\/account$/);if(request.method==='POST'&&agentRoute)return json({data:await service.registerAgentAccount(requireActor(actor),agentRoute[1],await request.json())},200,requestId);
    agentRoute=path.match(/^\/v1\/agents\/([^/]+)\/proposals$/);if(request.method==='POST'&&agentRoute)return json({data:await service.createAgentProposal(requireActor(actor),agentRoute[1],await request.json())},201,requestId);
    agentRoute=path.match(/^\/v1\/agent-proposals\/([^/]+)\/decision$/);if(request.method==='POST'&&agentRoute){const b=await request.json() as any;return json({data:await service.decideAgentProposal(requireActor(actor),agentRoute[1],b.decision)},200,requestId);}
    agentRoute=path.match(/^\/v1\/internal\/agents\/([^/]+)\/cycle$/);if(request.method==='POST'&&agentRoute){verifyInternalAgent(request,internalSecret,agentRoute[1]);const b=await request.json() as any;return json({data:await service.createAutomatedAgentProposal(agentRoute[1],b.proposal,b.run)},201,requestId);}
    if(request.method==='GET'&&path==='/v1/my/strategies')return json({data:await service.myStrategies(requireActor(actor))},200,requestId);
    if(request.method==='GET'&&path==='/v1/me')return json({data:{accountId:requireActor(actor),profile:await service.profile(requireActor(actor))}},200,requestId);
    if(request.method==='POST'&&path==='/v1/profile')return json({data:await service.saveProfile(requireActor(actor),await request.json())},200,requestId);
    if(request.method==='POST'&&path==='/v1/strategies')return json({data:await service.createStrategy(requireActor(actor),await request.json())},201,requestId);
    let detail=path.match(/^\/v1\/strategies\/([^/]+)$/);if(request.method==='GET'&&detail)return json({data:await service.strategyDetail(actor,detail[1])},200,requestId);if(request.method==='POST'&&detail)return json({data:await service.updateStrategy(requireActor(actor),detail[1],await request.json())},200,requestId);
    if(request.method==='POST'&&path==='/v1/executions/receipts')return json({data:await service.recordLiveExecution(requireActor(actor),await request.json())},201,requestId);
    if(request.method==='GET'&&path==='/v1/swaps')return json({data:await service.swaps(requireActor(actor))},200,requestId);
    if(request.method==='POST'&&path==='/v1/swaps')return json({data:await service.recordSwap(requireActor(actor),await request.json())},201,requestId);
    let m=path.match(/^\/v1\/versions\/([^/]+)$/); if(request.method==='GET'&&m)return json({data:await service.readVersion(actor,m[1],request.headers.get('x-view-key')??undefined)},200,requestId);
    if(request.method==='POST'&&path==='/v1/capabilities')return json({data:await service.issueCapability(requireActor(actor),await request.json())},201,requestId);
    m=path.match(/^\/v1\/capabilities\/([^/]+)\/revoke$/);if(request.method==='POST'&&m)return json({data:await service.revoke(requireActor(actor),m[1])},200,requestId);
    if(request.method==='POST'&&path==='/v1/access/offers')return json({data:await service.createOffer(requireActor(actor),await request.json())},201,requestId);
    if(request.method==='POST'&&path==='/v1/access/checkout-plan')return json({data:await service.checkoutPlan(requireActor(actor),await request.json())},200,requestId);
    if(request.method==='POST'&&path==='/v1/access/purchases')return json({data:await service.purchaseAccess(requireActor(actor),await request.json(),request.headers.get('idempotency-key')??undefined)},201,requestId);
    if(request.method==='GET'&&path==='/v1/earnings')return json({data:await service.earnings(requireActor(actor))},200,requestId);
    if(request.method==='POST'&&path==='/v1/forks')return json({data:await service.createFork(requireActor(actor),await request.json())},201,requestId);
    if(request.method==='POST'&&path==='/v1/executions/preview')return json({data:await service.previewExecution(requireActor(actor),await request.json())},200,requestId);
    if(request.method==='POST'&&path==='/v1/executions')return json({data:await service.execute(requireActor(actor),await request.json())},201,requestId);
    m=path.match(/^\/v1\/strategies\/([^/]+)\/lineage$/);if(request.method==='GET'&&m)return json({data:await service.lineage(m[1])},200,requestId);
    return json({error:{code:'not_found',message:'Route not found'},requestId},404,requestId);
  }catch(error){const e=error instanceof DomainError?error:new DomainError('internal_error','Unexpected server error',500);console.error(JSON.stringify({event:'error',requestId,code:e.code,message:error instanceof Error?error.message:String(error)}));return json({error:{code:e.code,message:e.message},requestId},e.status,requestId)}
};
function requireActor(actor?:string){if(!actor)throw new DomainError('unauthorized','A valid bearer session is required',401);return actor;}
function resolveActor(request:Request,auth:WalletAuthService){const authorization=request.headers.get('authorization');if(authorization?.startsWith('Bearer '))return auth.actorFromToken(authorization.slice(7));const dev=request.headers.get('x-near-account');if(dev&&(process.env.NODE_ENV!=='production'||process.env.SCION_ALLOW_DEV_HEADER==='true'))return dev;return undefined;}
function bearerToken(request:Request){const value=request.headers.get('authorization');return value?.startsWith('Bearer ')?value.slice(7):undefined;}
function verifyInternalAgent(request:Request,secret:string|undefined,agentId:string){const token=request.headers.get('x-scion-agent-token');if(!secret||!token)throw new DomainError('unauthorized','Agent runtime authorization is required',401);const raw=verifyToken(token,secret);if(!raw)throw new DomainError('unauthorized','Agent runtime authorization is invalid',401);let value:any;try{value=JSON.parse(Buffer.from(raw,'base64url').toString())}catch{throw new DomainError('unauthorized','Agent runtime authorization is malformed',401)}if(value.purpose!=='agent-cycle'||value.agentId!==agentId||new Date(value.exp)<=new Date())throw new DomainError('unauthorized','Agent runtime authorization is expired or mismatched',401);}
