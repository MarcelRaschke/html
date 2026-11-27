// True Peak (BS.1770-4 Annex 2) und Export-Limiter (#293)
const { test, expect } = require('../helpers');

test.describe('True Peak und Export-Limiter', () => {
  test.beforeEach(async ({ app }) => { await app.load(); await app.initAudio(); });

  test('True-Peak-Messung: Fehler zwischen -0,35 und +0,05 dB bis 20 kHz, Inter-Sample-Peaks erkannt', async ({ page }) => {
    const rows = await page.evaluate(() => {
      const mk = (fs, sec, fn) => { const n = Math.round(fs * sec), b = audioCtx.createBuffer(2, n, fs);
        for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = fn(i / fs, ch); } return b; };
      const out = [];
      for (const [f, fs] of [[997, 48000], [5000, 44100], [12000, 48000], [11025, 44100], [16000, 48000], [20000, 48000], [20000, 44100]]) {
        let lo = 99, hi = -99;
        for (let deg = 0; deg < 180; deg += 15) {
          const fade = t => Math.min(1, t / 0.01, (0.2 - t) / 0.01);
          const b = mk(fs, 0.2, t => fade(t) * 0.5 * Math.sin(2 * Math.PI * f * t + deg * Math.PI / 180));
          const err = measureTruePeak(b) + 6.0206; // Sollwert -6,02 dBTP
          lo = Math.min(lo, err); hi = Math.max(hi, err);
        }
        out.push({ name: `${f} Hz @${fs}`, lo, hi });
      }
      // fs/4 mit 45 Grad: Samples bei 0,707 A, wahre Spitze A -> Sample-Peak 3 dB zu niedrig, True Peak korrekt
      const isp = mk(48000, 0.2, t => Math.min(1, t / 0.01, (0.2 - t) / 0.01) * 0.9 * Math.sin(2 * Math.PI * 12000 * t + Math.PI / 4));
      let sp = 0; for (let i = 0; i < isp.length; i++) sp = Math.max(sp, Math.abs(isp.getChannelData(0)[i]));
      out.push({ name: 'ISP', tp: measureTruePeak(isp), sp: 20 * Math.log10(sp) });
      return out;
    });
    for (const r of rows.filter(r => r.name !== 'ISP')) {
      expect(r.lo, r.name).toBeGreaterThanOrEqual(-0.35);
      expect(r.hi, r.name).toBeLessThanOrEqual(0.05);
    }
    const isp = rows.find(r => r.name === 'ISP');
    expect(Math.abs(isp.tp - 20 * Math.log10(0.9))).toBeLessThan(0.1);
    expect(isp.sp).toBeLessThan(isp.tp - 2.5);
  });

  test('Mastering fuer die Auslieferung haelt -1 dBTP und limitiert leises Material nicht', async ({ page }) => {
    const r = await page.evaluate(() => {
      const mk = (fs, sec, fn) => { const n = Math.round(fs * sec), b = audioCtx.createBuffer(2, n, fs);
        for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = fn(i / fs, ch); } return b; };
      const sp = b => { let m = 0; for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); } return 20 * Math.log10(m); };
      const loud = mk(48000, 10, (t, ch) => {
        const beat = t % 0.5, kick = Math.exp(-beat * 25) * Math.sin(2 * Math.PI * (55 + 120 * Math.exp(-beat * 40)) * beat);
        const hat = (Math.floor(t * 8) % 2) * Math.exp(-(t % 0.125) * 60) * Math.sin(2 * Math.PI * 11800 * t + ch);
        return 0.6 * kick + 0.2 * Math.sin(2 * Math.PI * 110 * t) + 0.25 * hat;
      });
      const m1 = masterForDelivery(loud, -9, -1.0);
      const quiet = mk(48000, 5, t => Math.pow(10, -30 / 20) * Math.sin(2 * Math.PI * 1000 * t));
      const m2 = masterForDelivery(quiet, -18, -1.0);
      return { loud: { tp: m1.truePeak, measuredTp: measureTruePeak(m1.buffer), sp: sp(m1.buffer), limited: m1.limitedDb },
        quiet: { lufs: m2.lufs, tp: m2.truePeak, limited: m2.limitedDb } };
    });
    expect(r.loud.measuredTp).toBeLessThanOrEqual(-0.99);
    expect(r.loud.sp).toBeLessThanOrEqual(r.loud.measuredTp + 0.01);
    expect(r.loud.limited).toBeLessThan(0);
    expect(Math.abs(r.quiet.lufs + 18)).toBeLessThanOrEqual(0.1);
    expect(r.quiet.limited).toBeGreaterThan(-0.01);
  });
});
