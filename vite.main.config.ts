import { defineConfig } from 'vite';
import { copyLlmFiles } from './vite-plugins/copy-llm-files';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [copyLlmFiles()],
});
