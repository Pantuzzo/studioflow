import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests run against a *production build* served by `vite preview`,
 * with `VITE_ENABLE_MOCKS=true` so the whole app runs on the same MSW handlers
 * the unit suite uses. No database, no API process, no fixtures to reset: each
 * test gets a fresh page, and the mock database lives in that page.
 *
 * That is also exactly the artefact a demo deployment would serve, so this
 * suite tests the thing that ships rather than a development server.
 *
 * What belongs here is written down in e2e/README.md, and it is a short list.
 * The 191 tests in the unit suite already drive this app through the real data
 * layer; repeating them in a browser would triple the CI time and prove
 * nothing new.
 */
const PORT = 4173
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),

  /*
   * No retries, deliberately. A suite that goes green on the second attempt
   * teaches you to stop reading it, which is worse than a suite that fails —
   * that lesson cost a week earlier in this project. If something here is
   * flaky, the flake is the bug.
   */
  retries: 0,
  workers: process.env['CI'] ? 1 : undefined,

  reporter: process.env['CI']
    ? [['github'], ['html', { open: 'never' }]]
    : [['list']],

  use: {
    baseURL,
    // Retries are off, so a trace on failure is the only chance to see what
    // happened. It is written once and only when something breaks.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  /*
   * Chromium only. The value of this suite is behaviour the unit tests cannot
   * reach — real layout, real focus, real print media — not rendering
   * differences between engines. Adding two more browsers would triple the run
   * to re-answer a question nothing here asks.
   */
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    // Built into its own directory so the bundle budget keeps measuring the
    // real `dist`, which does not contain the mock layer.
    command: 'pnpm build:e2e && pnpm preview:e2e',
    url: baseURL,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
    // Vite applies prefixed variables from process.env after the .env files,
    // so this wins over whatever apps/web/.env says locally.
    env: { VITE_ENABLE_MOCKS: 'true' },
  },
})
