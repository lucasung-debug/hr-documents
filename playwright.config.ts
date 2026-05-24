import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './scripts',
  testMatch: /demo-record\.spec\.ts/,
  timeout: 180_000,
  expect: {
    timeout: 10_000,
  },
  outputDir: 'test-results/demo-recording',
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    viewport: { width: 1920, height: 1080 },
    video: 'on',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
})
