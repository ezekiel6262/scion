import { MemoryRepository } from '../src/repository.ts';
import { SimulatedNearIntentsAdapter } from '../src/adapters.ts';
import { VeilbranchService } from '../src/service.ts';
import { createHandler } from '../src/http.ts';

const service = new VeilbranchService(new MemoryRepository(), new SimulatedNearIntentsAdapter(), process.env.VEILBRANCH_SIGNING_SECRET ?? 'deployment-secret-required');
await service.seed();
export default createHandler(service);
