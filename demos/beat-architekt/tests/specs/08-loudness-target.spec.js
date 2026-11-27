// Phase 37: Lautheitsziel zuverlaessig treffen, Limiting begrenzen, Abweichungen begruenden.
const { test, expect } = require('../helpers');

// Testmaterial (20 s, 48 kHz): Sustain (Bass, Pad, Hochton) traegt die Lautheit, kurze Klicks (2 ms, 1,5 kHz)
// setzen die Spitzen. Die Klick-Amplituden ergeben einen PLR (True Peak minus LUFS) von 8, 14 und 20 dB.
// "Kick-dominiert": fast nur Kick, die Spitzen tragen die Lautheit selbst; -14 LUFS waeren nur mit rund 37 dB
// Limiting erreichbar.
async function master(page) {
  return page.evaluate(async () => {
    const fs = 48000, n = fs * 20;
    const make = fn => {
      const b = audioCtx.createBuffer(2, n, fs);
      for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = fn(i / fs, ch); }
      return b;
    };
    const sustain = (t, ch, a) => a * (Math.sin(2 * Math.PI * 55 * t) + 0.6 * Math.sin(2 * Math.PI * 440 * t + ch) + 0.4 * Math.sin(2 * Math.PI * 3300 * t));
    const click = (t, a) => { const bt = t % 0.5; return a * Math.exp(-bt * 500) * Math.sin(2 * Math.PI * 1500 * bt); };
    const kick = (t, a) => { const bt = t % 0.5; return a * Math.exp(-bt * 80) * Math.sin(2 * Math.PI * (50 + 100 * Math.exp(-bt * 40)) * bt); };
    const cases = {
      plr8: make((t, ch) => sustain(t, ch, 0.05) + click(t, 0.0997)),
      plr14: make((t, ch) => sustain(t, ch, 0.05) + click(t, 0.2507)),
      plr20: make((t, ch) => sustain(t, ch, 0.05) + click(t, 0.6188)),
      kickDominiert: make((t, ch) => sustain(t, ch, 0.0005) + kick(t, 1))
    };
    const out = {};
    for (const [k, src] of Object.entries(cases)) {
      const m = await masterForDeliveryAsync(src, -14, -1.0);
      out[k] = { plr: measureTruePeak(src) - calculateLUFS(src), lufs: m.lufs, tpMeasured: measureTruePeak(m.buffer), limited: m.limitedDb,
        deviation: m.deviationLU, target: m.targetLUFS, iterations: m.iterations, warnings: m.warnings, mode: m.mode };
    }
    return out;
  });
}

test.describe('Lautheitsziel (Phase 37)', () => {
  test('trifft -14 LUFS auf 0,15 LU, haelt -1 dBTP, begrenzt das Limiting auf 12 dB und begruendet Abweichungen', async ({ app, page }) => {
    await app.load();
    await app.initAudio();
    const r = await master(page);
    expect(r.plr8.mode).toBe('worker');
    for (const [k, plr] of [['plr8', 8], ['plr14', 14], ['plr20', 20]]) {
      expect(Math.abs(r[k].plr - plr), `${k}: PLR des Testmaterials`).toBeLessThan(0.2);
      expect(Math.abs(r[k].lufs + 14), `${k}: ${r[k].lufs.toFixed(2)} LUFS`).toBeLessThanOrEqual(0.15);
      expect(r[k].tpMeasured, `${k}: True Peak`).toBeLessThanOrEqual(-0.99);
      expect(r[k].target).toBe(-14);
      expect(r[k].iterations, `${k}: Durchlaeufe`).toBeLessThanOrEqual(4);
    }
    // Warnung nur bei mehr als 6 dB Limiting
    expect(r.plr8.warnings).toEqual([]);
    expect(r.plr14.warnings).toEqual([]);
    expect(r.plr20.limited).toBeLessThan(-6);
    expect(r.plr20.warnings).toHaveLength(1);
    expect(r.plr20.warnings[0]).toMatch(/Limiter regelt \d+\.\d dB/);
    // Ziel nur mit Zerstoerung der Spitzen erreichbar: Limiting gedeckelt, leiser geliefert, begruendet
    const kd = r.kickDominiert;
    expect(kd.limited, 'Limiting-Grenze 12 dB').toBeGreaterThanOrEqual(-12.05);
    expect(kd.tpMeasured).toBeLessThanOrEqual(-0.99);
    expect(kd.deviation).toBeLessThan(-0.5);
    expect(kd.warnings.join(' ')).toMatch(/nicht erreicht.*mehr als 12 dB Limiting/);
  });

  test('Export-Queue zeigt Ziel, Ist-Wert und Hinweise je Datei', async ({ app, page }) => {
    await app.load();
    await app.openBeatArchitekt();
    await page.evaluate(() => loadPattern('four_floor'));
    await page.click('#playBtn'); await page.waitForTimeout(3000);
    await page.click('#playBtn'); await page.waitForTimeout(1800);
    await page.evaluate(() => { document.getElementById('phase30ExportPanel').style.display = 'block'; queueExport('youtube'); });
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#phase30ProcessBtn')]);
    expect(dl.suggestedFilename()).toMatch(/\.wav$/);
    await page.waitForFunction(() => !exportState.isProcessing);
    const r = await page.evaluate(() => ({ result: exportState.queue[0].result, label: document.getElementById('phase30Loudness').textContent,
      detail: document.querySelector('#phase30QueueInfo .export-detail').textContent,
      shownWarnings: Array.from(document.querySelectorAll('#phase30QueueInfo .export-warning')).map(e => e.textContent) }));
    expect(r.label).toContain('(Ziel -13.0)');
    expect(r.detail).toContain('(Ziel -13.0)');
    expect(r.result.targetLUFS).toBe(-13);
    expect(r.result.truePeak).toBeLessThanOrEqual(-0.99);
    expect(r.result.limitedDb).toBeGreaterThanOrEqual(-12.05);
    // Abweichung ueber 0,5 LU nur mit Begruendung
    if (Math.abs(r.result.deviationLU) > 0.5) expect(r.result.warnings.length).toBeGreaterThan(0);
    expect(r.shownWarnings).toEqual(r.result.warnings.map(w => 'Hinweis: ' + w));
  });
});
