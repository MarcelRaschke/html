// Lautheit nach ITU-R BS.1770-4 / EBU R128 (Phasen 30.1, #292)
const { test, expect } = require('../helpers');

test.describe('Loudness (BS.1770-4)', () => {
  test('K-Filter-Koeffizienten bei 48 kHz entsprechen BS.1770-4', async ({ app, page }) => {
    await app.load();
    const err = await page.evaluate(() => {
      const k = kWeightingCoefficients(48000);
      const shelf = [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585];
      const hp = [-1.99004745483398, 0.99007225036621];
      const got = [k.shelf.b[0], k.shelf.b[1], k.shelf.b[2], k.shelf.a[1], k.shelf.a[2]];
      return Math.max(...got.map((v, i) => Math.abs(v - shelf[i])), Math.abs(k.highpass.a[1] - hp[0]), Math.abs(k.highpass.a[2] - hp[1]));
    });
    expect(err).toBeLessThan(1e-6);
  });

  test('integrierte Lautheit erfuellt EBU Tech 3341 (Faelle 1 bis 5, +/-0,1 LU)', async ({ app, page }) => {
    await app.load();
    const res = await page.evaluate(() => {
      const make = (fs, segs) => {
        const n = segs.reduce((a, [, s]) => a + Math.round(s * fs), 0);
        const L = new Float32Array(n); let o = 0;
        for (const [db, sec] of segs) {
          const amp = Math.pow(10, db / 20), m = Math.round(sec * fs);
          for (let i = 0; i < m; i++) L[o + i] = amp * Math.sin(2 * Math.PI * 1000 * (o + i) / fs);
          o += m;
        }
        return { numberOfChannels: 2, length: n, sampleRate: fs, getChannelData: () => L };
      };
      const cases = {
        'Fall 1': [[[-23, 20]], -23], 'Fall 2': [[[-33, 20]], -33],
        'Fall 3 (relatives Gate)': [[[-36, 10], [-23, 60], [-36, 10]], -23],
        'Fall 4 (absolutes + relatives Gate)': [[[-72, 10], [-36, 10], [-23, 60], [-36, 10], [-72, 10]], -23],
        'Fall 5': [[[-26, 20], [-20, 20.1], [-26, 20]], -23]
      };
      const out = [];
      for (const fs of [48000, 44100]) for (const [name, [segs, want]] of Object.entries(cases)) out.push({ name: `${name} @${fs}`, got: calculateLUFS(make(fs, segs)), want });
      out.push({ name: 'Stille', got: calculateLUFS({ numberOfChannels: 2, length: 48000, sampleRate: 48000, getChannelData: () => new Float32Array(48000) }), want: -Infinity });
      out.push({ name: 'kurzes Signal 200 ms', got: calculateLUFS(make(48000, [[-23, 0.2]])), want: -23 });
      return out;
    });
    for (const r of res) {
      if (r.want === -Infinity) expect(r.got, r.name).toBe(-Infinity);
      else expect(Math.abs(r.got - r.want), `${r.name}: ${r.got.toFixed(2)} LUFS`).toBeLessThanOrEqual(r.name.startsWith('kurz') ? 0.3 : 0.1);
    }
  });

  test('Normalisierung bringt -30 dBFS auf -14 LUFS', async ({ app, page }) => {
    await app.load();
    await app.initAudio();
    const r = await page.evaluate(() => {
      const fs = audioCtx.sampleRate, n = fs * 5, buf = audioCtx.createBuffer(2, n, fs);
      for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = Math.pow(10, -30 / 20) * Math.sin(2 * Math.PI * 1000 * i / fs); }
      return calculateLUFS(normalizeToLoudness(buf, -14, calculateLUFS(buf)));
    });
    expect(Math.abs(r + 14)).toBeLessThanOrEqual(0.1);
  });

  test('Live-Meter ist K-gewichtet und zeigt -23 dBFS-Sinus als -23 LUFS', async ({ app, page }) => {
    await app.load();
    await app.initAudio();
    const r = await page.evaluate(async () => {
      const osc = audioCtx.createOscillator(); osc.frequency.value = 1000;
      const g = audioCtx.createGain(); g.gain.value = Math.pow(10, -23 / 20);
      const m = audioCtx.createChannelMerger(2); osc.connect(g); g.connect(m, 0, 0); g.connect(m, 0, 1);
      m.connect(masteringState.meterBus); osc.start();
      masteringState.meterHistory = [];
      await new Promise(r => setTimeout(r, 600));
      const v = [];
      for (let i = 0; i < 20; i++) { captureMeteringFrame(); v.push(masteringState.meters.loudness.value); await new Promise(r => setTimeout(r, 33)); }
      osc.stop(); m.disconnect();
      return { kWeighted: !!masteringState.analyserKL, min: Math.min(...v), max: Math.max(...v) };
    });
    expect(r.kWeighted).toBe(true);
    expect(r.min).toBeGreaterThan(-23.5);
    expect(r.max).toBeLessThan(-22.5);
  });
});
