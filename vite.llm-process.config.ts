import { defineConfig } from 'vite';

// Vite config for LLM utility process
// Electron Forge specifies the entry, we just need to configure the output filename
export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        'node-llama-cpp', // Externalize node-llama-cpp since it's a native module
        'electron', // Externalize electron
        /^node:/, // Externalize all Node.js built-ins
      ],
      output: {
        entryFileNames: 'llm-process.js',
      },
    },
  },
});

