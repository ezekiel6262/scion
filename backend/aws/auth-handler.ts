import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { randomUUID } from 'node:crypto';
import { DomainError } from '../src/domain.ts';
import { Nep413AuthService } from '../src/nep413-auth.ts';

let auth:Nep413AuthService|undefined;
const response=(body:unknown,status=200,requestId='')=>({statusCode:status,headers:{'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'POST,OPTIONS','x-request-id':requestId},body:JSON.stringify(body),isBase64Encoded:false});
export async function handler(event:APIGatewayProxyEventV2):Promise<APIGatewayProxyStructuredResultV2>{
  const requestId=randomUUID();if(event.requestContext.http.method==='OPTIONS')return response({},204,requestId);
  try{const secret=process.env.SCION_SIGNING_SECRET;if(!secret)throw new Error('SCION_SIGNING_SECRET is required');auth??=new Nep413AuthService(secret,process.env.SCION_AUTH_RECIPIENT??'d30lp8j3k8uetx.cloudfront.net');const body=event.body?JSON.parse(event.isBase64Encoded?Buffer.from(event.body,'base64').toString():event.body):{};
    if(event.rawPath.endsWith('/challenge'))return response({data:auth.challenge()},201,requestId);
    if(event.rawPath.endsWith('/verify'))return response({data:await auth.verify(body.challengeId,body.accountId,body.publicKey,body.signature)},200,requestId);
    return response({error:{code:'not_found',message:'Route not found'},requestId},404,requestId);
  }catch(error){const e=error instanceof DomainError?error:new DomainError('internal_error','Unexpected server error',500);return response({error:{code:e.code,message:e.message},requestId},e.status,requestId);}
}
