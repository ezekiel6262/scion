import { MemoryRepository } from '../src/repository.ts';
import { SimulatedNearIntentsAdapter } from '../src/adapters.ts';
import { ScionService } from '../src/service.ts';
import { createHandler } from '../src/http.ts';

const service = new ScionService(new MemoryRepository(), new SimulatedNearIntentsAdapter(), process.env.SCION_SIGNING_SECRET ?? 'deployment-secret-required');
await service.seed();
export default createHandler(service);
