import { defineConfig } from 'vite';

// Vite config for LLM utility process
// Electron Forge specifies the entry, we just need to configure the output filename
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'llm-process.js',
      },
    },
  },
});

