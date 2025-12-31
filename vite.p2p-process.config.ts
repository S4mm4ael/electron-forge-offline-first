import { defineConfig } from 'vite';

// Vite config for P2P utility process
// Bundle libp2p and its dependencies as ESM
export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        'electron', // Externalize electron
        /^node:/, // Externalize all Node.js built-ins
      ],
      output: {
        entryFileNames: 'p2p-process.mjs', // .mjs extension for ESM
        format: 'es', // Output as ESM to match libp2p
        // Ensure no interop for ESM
        interop: 'esModule',
      },
    },
    // Ensure proper handling of ESM dependencies
    target: 'node18', // Target Node 18+ for ESM support
    // Don't transform ESM to CommonJS
    commonjsOptions: {
      transformMixedEsModules: false, // Don't transform mixed modules
    },
  },
  // Resolve ESM packages properly
  resolve: {
    // Prefer ESM versions
    mainFields: ['module', 'main'],
  },
});

