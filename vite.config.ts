import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: ['terminal.local']
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
