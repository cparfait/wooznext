import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // Séquentiel : les tests partagent la même BDD (anti-doublon téléphone, etc.)
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${process.env.PORT || 3002}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: `http://localhost:${process.env.PORT || 3002}`,
    // Réutilise le serveur si déjà lancé (développement local)
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
