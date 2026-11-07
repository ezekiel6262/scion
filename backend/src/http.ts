import { DomainError } from './domain.ts'; import type { ScionService } from './service.ts'; import type { WalletAuthService } from './auth.ts'; import { randomUUID } from 'node:crypto';

const json=(body:unknown,status=200,requestId?:string)=>Response.json(body,{status,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type,idempotency-key,x-near-account,x-view-key','access-control-allow-methods':'GET,POST,OPTIONS','x-request-id':requestId??''}});
export const createHandler=(service:ScionService,auth:WalletAuthService)=>async(request:Request)=>{
  const requestId=randomUUID(),url=new URL(request.url),path=(url.pathname.replace(/^\/api(?=\/|$)/,'').replace(/\/$/,'')||'/');
  if(request.method==='OPTIONS')return json({},204,requestId); const actor=resolveActor(request,auth);
  try{
    console.info(JSON.stringify({event:'request',requestId,method:request.method,path,actor}));
    if(request.method==='GET'&&path==='/health')return json({ok:true,service:'scion-api',mode:process.env.SCION_EXECUTION_MODE??'simulated'},200,requestId);
    if(request.method==='POST'&&path==='/v1/auth/challenge'){const b=await request.json() as any;return json({data:await auth.challenge(b.accountId,b.publicKey)},201,requestId);}
    if(request.method==='POST'&&path==='/v1/auth/verify'){const b=await request.json() as any;return json({data:await auth.verify(b.challengeId,b.signature)},200,requestId);}
    if(request.method==='GET'&&path==='/v1/strategies')return json({data:await service.listStrategies()},200,requestId);
    if(request.method==='GET'&&path==='/v1/me')return json({data:{accountId:requireActor(actor),profile:await service.profile(requireActor(actor))}},200,requestId);
    if(request.method==='POST'&&path==='/v1/profile')return json({data:await service.saveProfile(requireActor(actor),await request.json())},200,requestId);
    if(request.method==='POST'&&path==='/v1/strategies')return json({data:await service.createStrategy(requireActor(actor),await request.json())},201,requestId);
    let m=path.match(/^\/v1\/versions\/([^/]+)$/); if(request.method==='GET'&&m)return json({data:await service.readVersion(actor,m[1],request.headers.get('x-view-key')??undefined)},200,requestId);
    if(request.method==='POST'&&path==='/v1/capabilities')return json({data:await service.issueCapability(requireActor(actor),await request.json())},201,requestId);
    m=path.match(/^\/v1\/capabilities\/([^/]+)\/revoke$/);if(request.method==='POST'&&m)return json({data:await service.revoke(requireActor(actor),m[1])},200,requestId);
    if(request.method==='POST'&&path==='/v1/access/offers')return json({data:await service.createOffer(requireActor(actor),await request.json())},201,requestId);
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
