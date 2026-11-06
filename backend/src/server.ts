import { createServer } from 'node:http';
import { SimulatedNearIntentsAdapter } from './adapters.ts';
import { ScionService } from './service.ts';
import { createHandler } from './http.ts';
import { WalletAuthService } from './auth.ts';
import { createAuthStore, createRepository } from './runtime.ts';

const port = Number(process.env.PORT ?? 8787);
const secret = process.env.SCION_SIGNING_SECRET ?? 'local-development-secret-change-me';
const service = new ScionService(await createRepository(), new SimulatedNearIntentsAdapter(), secret);
await service.seed();
const handler = createHandler(service, new WalletAuthService(await createAuthStore(), secret));

const server = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk);
  const request = new Request(`http://${req.headers.host ?? `localhost:${port}`}${req.url ?? '/'}`, {
    method: req.method,
    headers: req.headers as HeadersInit,
    body: ['GET', 'HEAD'].includes(req.method ?? 'GET') ? undefined : Buffer.concat(chunks),
  });
  const response = await handler(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
});

server.listen(port, () => console.info(`Scion API listening on http://localhost:${port}`));
process.on('SIGTERM', () => server.close());
