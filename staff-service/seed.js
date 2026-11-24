import { connectEmulator } from './provider.js';
import { seed } from './fixtures.js';

await seed(connectEmulator());
console.log('Local seed accounts are ready. Run npm run roles to sign in as each one.');
