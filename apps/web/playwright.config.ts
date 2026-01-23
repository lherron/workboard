import { defineConfig, devices } from '@playwright/test';

const webServerEnv = {
  ...process.env,
  VITE_DISABLE_WEBHOOKS: '1',
};

// Use external server if PLAYWRIGHT_BASE_URL is set
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5160';
const useExternalServer = !!process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Only start dev server if not using external server
  ...(!useExternalServer && {
    webServer: {
      command: 'pnpm dev',
      url: 'http://localhost:5160',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
      env: webServerEnv,
    },
  }),
});
