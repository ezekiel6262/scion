import { DomainError } from './domain.ts'; import type { VeilbranchService } from './service.ts'; import { randomUUID } from 'node:crypto';

const json=(body:unknown,status=200,requestId?:string)=>Response.json(body,{status,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'content-type,x-near-account,x-view-key','access-control-allow-methods':'GET,POST,OPTIONS','x-request-id':requestId??''}});
export const createHandler=(service:VeilbranchService)=>async(request:Request)=>{
  const requestId=randomUUID(),url=new URL(request.url),path=url.pathname.replace(/\/$/,'')||'/';
  if(request.method==='OPTIONS')return json({},204,requestId); const actor=request.headers.get('x-near-account')??undefined;
  try{
    console.info(JSON.stringify({event:'request',requestId,method:request.method,path,actor}));
    if(request.method==='GET'&&path==='/health')return json({ok:true,service:'veilbranch-api',mode:process.env.VEILBRANCH_EXECUTION_MODE??'simulated'},200,requestId);
    if(request.method==='GET'&&path==='/v1/strategies')return json({data:await service.listStrategies()},200,requestId);
    if(request.method==='POST'&&path==='/v1/strategies')return json({data:await service.createStrategy(requireActor(actor),await request.json())},201,requestId);
    let m=path.match(/^\/v1\/versions\/([^/]+)$/); if(request.method==='GET'&&m)return json({data:await service.readVersion(actor,m[1],request.headers.get('x-view-key')??undefined)},200,requestId);
    if(request.method==='POST'&&path==='/v1/capabilities')return json({data:await service.issueCapability(requireActor(actor),await request.json())},201,requestId);
    m=path.match(/^\/v1\/capabilities\/([^/]+)\/revoke$/);if(request.method==='POST'&&m)return json({data:await service.revoke(requireActor(actor),m[1])},200,requestId);
    if(request.method==='POST'&&path==='/v1/forks')return json({data:await service.createFork(requireActor(actor),await request.json())},201,requestId);
    if(request.method==='POST'&&path==='/v1/executions/preview'){const b=await request.json() as any;return json({data:service.evaluatePolicy(b.proposal,b.policy)},200,requestId);}
    if(request.method==='POST'&&path==='/v1/executions')return json({data:await service.execute(requireActor(actor),await request.json())},201,requestId);
    m=path.match(/^\/v1\/strategies\/([^/]+)\/lineage$/);if(request.method==='GET'&&m)return json({data:await service.lineage(m[1])},200,requestId);
    return json({error:{code:'not_found',message:'Route not found'},requestId},404,requestId);
  }catch(error){const e=error instanceof DomainError?error:new DomainError('internal_error','Unexpected server error',500);console.error(JSON.stringify({event:'error',requestId,code:e.code,message:error instanceof Error?error.message:String(error)}));return json({error:{code:e.code,message:e.message},requestId},e.status,requestId)}
};
function requireActor(actor?:string){if(!actor)throw new DomainError('unauthorized','x-near-account is required',401);return actor;}
