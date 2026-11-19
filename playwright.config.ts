import { defineConfig } from '@playwright/test';

/**
 * Browser tests for the public site (see docs/design-system.md, section 12).
 * Chromium only. The three viewports are explicit sizes so no WebKit is needed.
 * Run: pnpm e2e   |   screenshots: pnpm e2e:shots
 */
const PORT = 3000;

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { browserName: 'chromium', viewport: { width: 820, height: 1180 }, hasTouch: true } },
    { name: 'mobile', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
  // The site reads the directory on the server, so tests point it at a local mock API (e2e/mock-api.mjs).
  webServer: [
    { command: 'node e2e/mock-api.mjs', url: 'http://127.0.0.1:3999/health', reuseExistingServer: !process.env.CI, timeout: 30_000 },
    {
      command: 'pnpm dev',
      url: `http://localhost:${PORT}`,
      env: { MEDICONNECT_API_URL: 'http://127.0.0.1:3999/api/v1' },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
