// Phase 36: Abnahmetests der Beat-Architekt-Demo.
// Ein Worker: die Audio-Tests messen Zeitverlaeufe (Crossfade-Rampen, Meter-Halten, Worker-Reaktionszeit),
// parallele Laeufe auf einem CI-Runner verfaelschen diese Messungen. Keine automatischen Wiederholungen:
// ein roter Test ist ein Befund, kein Zufall.
const { defineConfig } = require('@playwright/test');

const PORT = Number(process.env.BA_TEST_PORT || 8090);

module.exports = defineConfig({
  testDir: './specs',
  timeout: 180_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    browserName: 'chromium',
    viewport: { width: 1600, height: 1000 },
    acceptDownloads: true,
    trace: 'off',
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] }
  },
  webServer: {
    command: 'node serve.js',
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000
  }
});
