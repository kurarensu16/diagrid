import { defineConfig, devices } from '@playwright/test';

const port = 5174;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      // The browser test intercepts every request to this fake host.
      VITE_SUPABASE_URL: 'https://diagrid-e2e.supabase.test',
      VITE_SUPABASE_ANON_KEY: 'diagrid-e2e-anon-key-never-use-for-production',
    },
  },
});
