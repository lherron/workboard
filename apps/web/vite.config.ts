import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Static workboard ports — must match apps/api/src/dev.js. No env overrides
// (env vars leak between sibling stacks like taskboard and silently misroute).
const API_PORT = 18461;
const WEB_PORT = 18460;
const apiTarget = `http://localhost:${API_PORT}`;

export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'TOOL_'],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@workboard/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
  server: {
    port: WEB_PORT,
    strictPort: true,
    host: true,
    allowedHosts: ['max3', 'max3.local', 'max3.tail53cc3b.ts.net', 'max3.lan'],
    proxy: {
      '/admin': apiTarget,
      '/api': apiTarget,
    },
  },
});
