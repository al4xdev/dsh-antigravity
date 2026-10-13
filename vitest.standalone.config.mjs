import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';

// npm exec installs the runner outside this fork; resolve the test API from it.
const runnerRequire = createRequire(realpathSync(process.argv[1]));
export default {
  resolve: { alias: { vitest: join(dirname(runnerRequire.resolve('vitest/package.json')), 'dist/index.js') } },
  esbuild: { tsconfigRaw: JSON.stringify({ compilerOptions: { experimentalDecorators: false, target: 'ES2022' } }) },
  test: {
    environment: 'node',
    include: ['tests/search.spec.ts', 'tests/provider.spec.ts', 'tests/credential.spec.ts', 'tests/client-config.spec.ts', 'tests/remote.spec.ts', 'tests/quota.spec.ts', 'tests/usage.spec.ts', 'tests/failure.spec.ts', 'tests/api-resilience.spec.ts', 'tests/adapter-recovery.spec.ts', 'tests/quota-retry.spec.ts'],
    testTimeout: 15000,
  },
};
