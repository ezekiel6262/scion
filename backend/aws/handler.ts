import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { SimulatedNearIntentsAdapter, VerifiedUsdcSettlementAdapter } from '../src/adapters.ts';
import { WalletAuthService } from '../src/auth.ts';
import { createHandler } from '../src/http.ts';
import { createAuthStore, createRepository } from '../src/runtime.ts';
import { ScionService } from '../src/service.ts';

let appPromise: ReturnType<typeof initialize> | undefined;
async function initialize() {
  const secret = process.env.SCION_SIGNING_SECRET;
  if (!secret) throw new Error('SCION_SIGNING_SECRET is required');
  const contract=process.env.NEAR_USDC_CONTRACT,treasury=process.env.SCION_TREASURY_ACCOUNT;
  const paymentsEnabled=!!(contract&&treasury);
  const settlement=paymentsEnabled?new VerifiedUsdcSettlementAdapter(secret,contract!,treasury!):undefined;
  const admins=(process.env.SCION_ADMIN_ACCOUNTS??'').split(',').map(v=>v.trim()).filter(Boolean);
  const service = new ScionService(await createRepository(), new SimulatedNearIntentsAdapter(), secret,undefined,settlement,true,paymentsEnabled,paymentsEnabled?{contractId:contract!,treasury:treasury!}:undefined,admins);
  await service.seed();
  return createHandler(service, new WalletAuthService(await createAuthStore(), secret),secret);
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  appPromise ??= initialize();
  const app = await appPromise;
  const host = event.headers.host ?? 'localhost';
  const protocol = event.headers['x-forwarded-proto'] ?? 'https';
  const path = event.rawPath.replace(/^\/api(?=\/|$)/, '') || '/';
  const url = `${protocol}://${host}${path}${event.rawQueryString ? `?${event.rawQueryString}` : ''}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(event.headers)) if (value !== undefined) headers.set(key, value);
  const request = new Request(url, {
    method: event.requestContext.http.method,
    headers,
    body: event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body) : undefined
  });
  const response = await app(request);
  return {
    statusCode: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: await response.text(),
    isBase64Encoded: false
  };
}
