// Gemeinsame Fixtures und Helfer fuer die Beat-Architekt-Tests.
const { test: base, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');

// Fixture "app": laedt die Demo, sammelt Seiten- und Konsolenfehler und schlaegt am Testende fehl,
// wenn unerwartete Fehler aufgetreten sind. Erwartete Fehler meldet ein Test ueber app.allowErrors(/muster/).
const test = base.extend({
  app: async ({ page }, use, testInfo) => {
    const errors = [];
    const allowed = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss().catch(() => {}); });
    const app = {
      page,
      errors,
      allowErrors: re => allowed.push(re),
      async load(initScript) {
        if (initScript) await page.addInitScript(initScript);
        await page.goto('/index.html', { waitUntil: 'load' });
        await page.waitForFunction(() => typeof masteringState !== 'undefined' && typeof togglePlay === 'function'
          && !!document.getElementById('playBtn'));
        await page.waitForTimeout(800); // verzoegerte Panel-Initialisierungen (setTimeout im Init-Code)
      },
      async openBeatArchitekt() {
        await page.click('.nav-btn:has-text("Beat Architekt")');
        await page.waitForTimeout(200);
      },
      // Einmal Play/Stop: legt AudioContext, Effektkette, Meter, Limiter und KI-Abgriff an
      async initAudio() {
        await this.openBeatArchitekt();
        await page.click('#playBtn'); await page.waitForTimeout(400);
        await page.click('#playBtn'); await page.waitForTimeout(300);
        await page.waitForFunction(() => !!audioCtx && !!masteringState.meterBus);
      },
      // Jeder vierte Step aktiv: hoerbares Signal fuer Meter-, Limiter- und KI-Tests
      async fillPattern() {
        await page.evaluate(() => {
          const cells = document.querySelectorAll('.step, .cell, [data-step]');
          let n = 0;
          for (const c of cells) { if (n % 4 === 0) c.click(); n++; if (n > 64) break; }
        });
      },
      async play() { if (!(await page.evaluate(() => isPlaying))) await page.click('#playBtn'); },
      async stop() { if (await page.evaluate(() => isPlaying)) await page.click('#playBtn'); }
    };
    await use(app);
    await app.stop().catch(() => {});
    const unexpected = errors.filter(e => !allowed.some(re => re.test(e)));
    if (unexpected.length) await testInfo.attach('fehler.txt', { body: unexpected.join('\n'), contentType: 'text/plain' });
    expect(unexpected, 'unerwartete Seiten- oder Konsolenfehler').toEqual([]);
  }
});

// ffmpeg/ffprobe fuer die Format-Pruefung (Phase 35). Lokal optional, in CI Pflicht.
function hasFfmpeg() {
  try { execFileSync('ffprobe', ['-version'], { stdio: 'ignore' }); execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; }
}

module.exports = { test, expect, hasFfmpeg };
