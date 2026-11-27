// Live-True-Peak-Meter (#295) und Live-Limiter (AudioWorklet, #296)
const { test, expect } = require('../helpers');

test.describe('Live-True-Peak-Meter', () => {
  test('misst Inter-Sample-Peaks, haelt 2 s, faellt danach und erkennt Clipping', async ({ app, page }) => {
    await app.load();
    await app.initAudio();
    const r = await page.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const fs = audioCtx.sampleRate, n = fs * 2, buf = audioCtx.createBuffer(2, n, fs);
      // fs/4 mit 45 Grad, Amplitude 0,9: Sample-Peak -3,93 dBFS, True Peak -0,92 dBTP
      for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = 0.9 * Math.sin(2 * Math.PI * (fs / 4) * i / fs + Math.PI / 4); }
      const src = audioCtx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(masteringState.meterBus); src.start();
      resetLiveTruePeak();
      await sleep(400);
      for (let i = 0; i < 15; i++) { captureMeteringFrame(); await sleep(33); }
      const tp = masteringState.meters.truePeak;
      const sine = { sp: masteringState.meters.samplePeak, tp: tp.value, max: tp.max, readout: document.getElementById('truePeakReadout').textContent };
      src.stop(); src.disconnect();
      const trace = [];
      const t0 = performance.now();
      while (performance.now() - t0 < 3600) { captureMeteringFrame(); trace.push([performance.now() - t0, masteringState.meters.truePeak.value]); await sleep(200); }
      const maxAfter = masteringState.meters.truePeak.max;
      const loud = audioCtx.createBuffer(2, fs, fs);
      for (let ch = 0; ch < 2; ch++) { const d = loud.getChannelData(ch); for (let i = 0; i < fs; i++) d[i] = 1.2 * Math.sin(2 * Math.PI * 1000 * i / fs); }
      const s2 = audioCtx.createBufferSource(); s2.buffer = loud; s2.loop = true; s2.connect(masteringState.meterBus); s2.start();
      await sleep(300); for (let i = 0; i < 5; i++) { captureMeteringFrame(); await sleep(33); }
      const clip = { max: masteringState.meters.truePeak.max, status: masteringState.meters.truePeak.status };
      s2.stop(); s2.disconnect();
      return { sine, trace, maxAfter, clip };
    });
    expect(Math.abs(r.sine.tp + 0.92)).toBeLessThan(0.2);
    expect(Math.abs(r.sine.sp + 3.93)).toBeLessThan(0.2);
    expect(r.sine.readout).toContain('dBTP');
    // Halten: in den ersten 1,5 s nach Signalende hoechstens 0,2 dB unter dem Maximum
    for (const [t, v] of r.trace.filter(([t]) => t < 1500)) expect(v, `Halten bei ${Math.round(t)} ms`).toBeGreaterThan(r.sine.max - 0.2);
    // Abfall: nach 3 s deutlich unter dem Maximum, Maximum selbst bleibt
    const late = r.trace.filter(([t]) => t > 3200).map(([, v]) => v);
    expect(Math.max(...late)).toBeLessThan(r.sine.max - 5);
    expect(Math.abs(r.maxAfter - r.sine.max)).toBeLessThan(0.01);
    expect(r.clip.max).toBeGreaterThan(1.0);
    expect(r.clip.status).toBe('clipped');
  });
});

test.describe('Live-Limiter (AudioWorklet)', () => {
  test('offline: bitgenau unterhalb der Schwelle, -1 dBTP bei Uebersteuerung, Bypass und anderes Ziel', async ({ app, page }) => {
    await app.load();
    const r = await page.evaluate(async () => {
      const fs = 48000;
      const render = async (fn, sec, opts = {}) => {
        const ctx = new OfflineAudioContext(2, fs * sec, fs);
        const url = URL.createObjectURL(new Blob([LIVE_LIMITER_WORKLET], { type: 'application/javascript' }));
        await ctx.audioWorklet.addModule(url);
        const o = liveLimiterOptions(fs);
        Object.assign(o.processorOptions, opts);
        const node = new AudioWorkletNode(ctx, 'live-true-peak-limiter', o);
        const src = ctx.createBufferSource(), buf = ctx.createBuffer(2, fs * sec, fs);
        for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = fn(i / fs, ch); }
        src.buffer = buf; src.connect(node); node.connect(ctx.destination); src.start();
        return { inp: buf, out: await ctx.startRendering(), latency: o.latencySamples };
      };
      const tpAfter = (b, skip) => {
        const n = b.length - skip;
        return frameTruePeak({ numberOfChannels: 2, length: n, sampleRate: fs, getChannelData: c => b.getChannelData(c).subarray(skip) });
      };
      const out = {};
      let t = await render((x, ch) => 0.3 * Math.sin(2 * Math.PI * 440 * x + ch), 1);
      let maxDiff = 0; const L = t.latency;
      for (let ch = 0; ch < 2; ch++) { const a = t.inp.getChannelData(ch), y = t.out.getChannelData(ch); for (let i = L; i < y.length; i++) maxDiff = Math.max(maxDiff, Math.abs(y[i] - a[i - L])); }
      out.quiet = { latencyMs: L / fs * 1000, maxDiff };
      t = await render(x => 1.2 * Math.sin(2 * Math.PI * 1000 * x), 2); out.loudSine = tpAfter(t.out, fs * 0.2);
      t = await render(x => 0.9 * Math.sin(2 * Math.PI * 12000 * x + Math.PI / 4), 1); out.interSample = tpAfter(t.out, fs * 0.2);
      t = await render((x, ch) => { const bt = x % 0.5; return 2.0 * Math.exp(-bt * 30) * Math.sin(2 * Math.PI * (50 + 100 * Math.exp(-bt * 40)) * bt) + 0.1 * Math.sin(2 * Math.PI * 9000 * x + ch); }, 3);
      out.kicks = tpAfter(t.out, 0);
      t = await render(x => 1.2 * Math.sin(2 * Math.PI * 1000 * x), 1, { enabled: false }); out.bypass = tpAfter(t.out, fs * 0.2);
      t = await render(x => 1.2 * Math.sin(2 * Math.PI * 1000 * x), 1, { ceilingDb: 0 }); out.ceiling0 = tpAfter(t.out, fs * 0.2);
      return out;
    });
    expect(r.quiet.maxDiff).toBeLessThan(1e-7);
    expect(r.quiet.latencyMs).toBeLessThan(6);
    expect(r.loudSine).toBeLessThanOrEqual(-0.95);
    expect(r.interSample).toBeLessThanOrEqual(-0.95);
    expect(r.kicks).toBeLessThanOrEqual(-0.95);
    expect(r.bypass).toBeGreaterThan(1.4);
    expect(r.ceiling0).toBeLessThanOrEqual(0.05);
    expect(r.ceiling0).toBeGreaterThan(-0.5);
  });

  test('live: Limiter sitzt im Master-Pfad und haelt das Ziel des Standards', async ({ app, page }) => {
    await app.load();
    await app.openBeatArchitekt();
    await app.fillPattern();
    await app.play();
    await page.waitForTimeout(800);
    await page.evaluate(() => resetLiveTruePeak());
    await page.waitForTimeout(3000);
    const r = await page.evaluate(() => ({ node: !!liveLimiter.node, latencyMs: liveLimiter.latencyMs, tpMax: masteringState.meters.truePeak.max,
      ceiling: liveLimiterOptions(audioCtx.sampleRate).processorOptions.ceilingDb, readout: document.getElementById('limiterGrReadout').textContent }));
    expect(r.node).toBe(true);
    expect(r.latencyMs).toBeLessThan(6);
    expect(r.tpMax).toBeLessThanOrEqual(r.ceiling + 0.1);
    expect(r.readout).toMatch(/dB/);
  });
});
