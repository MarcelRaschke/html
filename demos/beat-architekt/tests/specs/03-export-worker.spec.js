// Export-Mastering im Web Worker (#294): Ergebnis identisch zum Haupt-Thread, Oberflaeche bleibt reaktionsfaehig
const { test, expect } = require('../helpers');

async function runMastering(page) {
  return page.evaluate(async () => {
    const fs = 44100, n = fs * 30;
    const src = audioCtx.createBuffer(2, n, fs);
    for (let ch = 0; ch < 2; ch++) { const d = src.getChannelData(ch);
      for (let i = 0; i < n; i++) { const t = i / fs, beat = t % 0.5;
        d[i] = 0.6 * Math.exp(-beat * 25) * Math.sin(2 * Math.PI * (55 + 120 * Math.exp(-beat * 40)) * beat) + 0.2 * Math.sin(2 * Math.PI * 110 * t)
          + 0.25 * (Math.floor(t * 8) % 2) * Math.exp(-(t % 0.125) * 60) * Math.sin(2 * Math.PI * 11800 * t + ch); } }
    const probe = () => { let last = performance.now(), maxGap = 0, on = true;
      const tick = () => { const now = performance.now(); maxGap = Math.max(maxGap, now - last); last = now; if (on) setTimeout(tick, 16); };
      setTimeout(tick, 16); return () => { on = false; return maxGap; }; };
    const stop = probe();
    const a = await masterForDeliveryAsync(src, -9, -1.0);
    const maxGap = stop();
    const s = masterForDelivery(src, -9, -1.0);
    let maxDiff = 0;
    for (let ch = 0; ch < 2; ch++) { const x = a.buffer.getChannelData(ch), y = s.buffer.getChannelData(ch); for (let i = 0; i < n; i++) maxDiff = Math.max(maxDiff, Math.abs(x[i] - y[i])); }
    let silentError = null;
    try { await masterForDeliveryAsync(audioCtx.createBuffer(2, fs, fs), -14, -1); } catch (e) { silentError = e.message; }
    return { mode: a.mode, maxGap, maxDiff, tp: a.truePeak, lufsDiff: Math.abs(a.lufs - s.lufs), silentError };
  });
}

test.describe('Export-Worker', () => {
  test('Worker liefert dasselbe Ergebnis wie der Haupt-Thread und blockiert die Oberflaeche nicht', async ({ app, page }) => {
    await app.load();
    await app.initAudio();
    const r = await runMastering(page);
    expect(r.mode).toBe('worker');
    expect(r.maxDiff).toBeLessThan(1e-6);
    expect(r.lufsDiff).toBeLessThan(0.01);
    expect(r.tp).toBeLessThanOrEqual(-0.99);
    expect(r.maxGap, 'laengste Timer-Luecke waehrend des Worker-Laufs (ms)').toBeLessThan(400);
    expect(r.silentError).toBeTruthy();
  });

  test('ohne Worker-Unterstuetzung faellt das Mastering auf den Haupt-Thread zurueck', async ({ app, page }) => {
    await app.load(() => { delete window.Worker; });
    await app.initAudio();
    const r = await runMastering(page);
    expect(r.mode).not.toBe('worker');
    expect(r.maxDiff).toBeLessThan(1e-6);
    expect(r.tp).toBeLessThanOrEqual(-0.99);
  });
});
