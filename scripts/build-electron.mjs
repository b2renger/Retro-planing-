// Bundles the Electron main and preload scripts with esbuild.
//   electron/main.ts    -> dist-electron/main.cjs
//   electron/preload.ts -> dist-electron/preload.cjs
// Output is CommonJS (.cjs) because package.json has "type": "module" and Electron loads main/preload as CJS.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron'],
  sourcemap: true,
  logLevel: 'info',
  absWorkingDir: root,
};

await Promise.all([
  build({ ...common, entryPoints: ['electron/main.ts'], outfile: 'dist-electron/main.cjs' }),
  build({ ...common, entryPoints: ['electron/preload.ts'], outfile: 'dist-electron/preload.cjs' }),
]);
console.log('[build-electron] wrote dist-electron/main.cjs and dist-electron/preload.cjs');
