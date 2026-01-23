import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Workboard API/BFF URL (proxies to control-plane)
// Default to dev port (18461), override with API_PORT or API_TARGET for other stacks
const apiTarget =
  process.env.API_TARGET || `http://localhost:${process.env.API_PORT || 18461}`;

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
    port: 5160,
    host: true,
    allowedHosts: ['max3', 'max3.local', 'max3.tail53cc3b.ts.net', 'max3.lan'],
    proxy: {
      '/admin': apiTarget,
      '/api': apiTarget,
    },
  },
});
