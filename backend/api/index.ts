import { SimulatedNearIntentsAdapter } from '../src/adapters.ts';
import { ScionService } from '../src/service.ts';
import { createHandler } from '../src/http.ts';
import { WalletAuthService } from '../src/auth.ts';
import { createAuthStore, createRepository } from '../src/runtime.ts';

const secret=process.env.SCION_SIGNING_SECRET ?? 'deployment-secret-required';
const service = new ScionService(await createRepository(), new SimulatedNearIntentsAdapter(), secret);
await service.seed();
export default createHandler(service,new WalletAuthService(await createAuthStore(),secret));
