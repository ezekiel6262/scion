import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { randomUUID } from 'node:crypto';
import { DomainError } from '../src/domain.ts';
import { Nep413AuthService } from '../src/nep413-auth.ts';
import { NearBalanceService } from '../src/near-balances.ts';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { verifyToken } from '../src/crypto.ts';

let auth:Nep413AuthService|undefined;
let balances:NearBalanceService|undefined;
const s3=new S3Client({});
const response=(body:unknown,status=200,requestId='')=>({statusCode:status,headers:{'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,OPTIONS','x-request-id':requestId},body:JSON.stringify(body),isBase64Encoded:false});
export async function handler(event:APIGatewayProxyEventV2):Promise<APIGatewayProxyStructuredResultV2>{
  const requestId=randomUUID();if(event.requestContext.http.method==='OPTIONS')return response({},204,requestId);
  try{const secret=process.env.SCION_SIGNING_SECRET;if(!secret)throw new Error('SCION_SIGNING_SECRET is required');auth??=new Nep413AuthService(secret,process.env.SCION_AUTH_RECIPIENT??'d30lp8j3k8uetx.cloudfront.net');balances??=new NearBalanceService(secret);const body=event.body?JSON.parse(event.isBase64Encoded?Buffer.from(event.body,'base64').toString():event.body):{};
    if(event.rawPath.endsWith('/challenge'))return response({data:auth.challenge()},201,requestId);
    if(event.rawPath.endsWith('/verify'))return response({data:await auth.verify(body.challengeId,body.accountId,body.publicKey,body.signature)},200,requestId);
    if(event.rawPath.endsWith('/balances')){const authorization=event.headers.authorization??event.headers.Authorization;if(!authorization?.startsWith('Bearer '))throw new DomainError('unauthorized','A valid bearer session is required',401);const actor=balances.actor(authorization.slice(7));return response({data:await balances.holdings(actor)},200,requestId);}
    if(event.rawPath.endsWith('/avatar')){const authorization=event.headers.authorization??event.headers.Authorization;if(!authorization?.startsWith('Bearer '))throw new DomainError('unauthorized','A valid bearer session is required',401);const raw=verifyToken(authorization.slice(7),secret);if(!raw)throw new DomainError('invalid_session','Session token is invalid',401);let session:any;try{session=JSON.parse(Buffer.from(raw,'base64url').toString())}catch{throw new DomainError('invalid_session','Session token payload is invalid',401)}if(new Date(session.exp)<=new Date())throw new DomainError('session_expired','Session expired',401);const contentType=String(body.contentType??'');if(!['image/webp','image/jpeg','image/png'].includes(contentType))throw new DomainError('invalid_avatar','Use a PNG, JPEG, or WebP image');const bytes=Buffer.from(String(body.data??''),'base64');if(!bytes.length||bytes.length>600000)throw new DomainError('avatar_too_large','Profile picture must be 600 KB or smaller',413);const bucket=process.env.AVATAR_BUCKET,site=process.env.SCION_SITE_URL;if(!bucket||!site)throw new Error('Avatar storage is not configured');const ext=contentType==='image/png'?'png':contentType==='image/jpeg'?'jpg':'webp',key=`avatars/${encodeURIComponent(session.sub)}-${Date.now()}.${ext}`;await s3.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:bytes,ContentType:contentType,CacheControl:'public,max-age=31536000,immutable'}));return response({data:{avatarUrl:`${site}/${key}`}},201,requestId);}
    return response({error:{code:'not_found',message:'Route not found'},requestId},404,requestId);
  }catch(error){const e=error instanceof DomainError?error:new DomainError('internal_error','Unexpected server error',500);return response({error:{code:e.code,message:e.message},requestId},e.status,requestId);}
}
