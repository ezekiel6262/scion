import { createServer } from 'node:http';
import { MemoryRepository } from './repository.ts';
import { SimulatedNearIntentsAdapter } from './adapters.ts';
import { VeilbranchService } from './service.ts';
import { createHandler } from './http.ts';

const port = Number(process.env.PORT ?? 8787);
const secret = process.env.VEILBRANCH_SIGNING_SECRET ?? 'local-development-secret-change-me';
const service = new VeilbranchService(new MemoryRepository(), new SimulatedNearIntentsAdapter(), secret);
await service.seed();
const handler = createHandler(service);

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

server.listen(port, () => console.info(`Veilbranch API listening on http://localhost:${port}`));
process.on('SIGTERM', () => server.close());
