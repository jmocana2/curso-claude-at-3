import { defineConfig, devices } from '@playwright/test'

const raiz_repo = '../..'

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4200',
    viewport: { width: 1280, height: 800 },
    video: { mode: 'on', size: { width: 1280, height: 800 } },
    trace: 'retain-on-failure',
    launchOptions: { slowMo: 250 }
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } }
    }
  ],
  webServer: [
    {
      command: 'npm run dev:api',
      cwd: raiz_repo,
      url: 'http://localhost:3000/health',
      reuseExistingServer: true,
      timeout: 120_000
    },
    {
      command: 'npm run dev:admin',
      cwd: raiz_repo,
      url: 'http://localhost:4200',
      reuseExistingServer: true,
      timeout: 180_000
    }
  ]
})
