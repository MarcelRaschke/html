// Master-Pfad: Sample-Player (#297), Master-Recorder (#290) und Video-Export (#291)
const { test, expect } = require('../helpers');
const fs = require('fs');

test.describe('Sample-Player auf dem Master-Pfad', () => {
  test('Samples, Slices und Loop-Vorschau laufen durch Limiter und Meter', async ({ app, page }) => {
    await app.load();
    await app.initAudio();
    await page.waitForTimeout(1200);
    const r = await page.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const fs = audioCtx.sampleRate, n = fs * 2, buf = audioCtx.createBuffer(2, n, fs);
      for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = 1.3 * Math.sin(2 * Math.PI * 220 * i / fs); } // +2,28 dBTP
      sampleLibrary.push({ id: 'test_loud', buffer: buf, playbackRate: 1, detectedBPM: 120, onsets: [0, 0.5, 1.0, 1.5] });
      sliceSequencerState.sliceLibrary.push({ id: 'slice_loud', sampleId: 'test_loud', startSample: 0, duration: 0.5 });
      const measure = async (fn, ms = 900) => {
        resetLiveTruePeak(); masteringState.meters.truePeak.ignoreUntil = 0; masteringState.meterHistory = [];
        fn(); const t0 = performance.now();
        while (performance.now() - t0 < ms) { captureMeteringFrame(); await sleep(33); }
        return masteringState.meters.truePeak.max;
      };
      const out = { outputIsMaster: sampleOutputNode() === effectsNodes.masterOut, limiter: !!liveLimiter.node };
      out.sample = await measure(() => playSample('test_loud', audioCtx.currentTime, 1.0, 1.0));
      await sleep(1500);
      out.slice = await measure(() => playSlice('slice_loud', audioCtx.currentTime + 0.05, 1.0), 600);
      await sleep(600);
      out.loopError = null; try { previewLoop('test_loud', 0); } catch (e) { out.loopError = e.message; }
      await sleep(2500);
      setLiveLimiterEnabled(false);
      out.sampleNoLimiter = await measure(() => playSample('test_loud', audioCtx.currentTime, 1.0, 1.0));
      setLiveLimiterEnabled(true);
      return out;
    });
    expect(r.outputIsMaster).toBe(true);
    expect(r.limiter).toBe(true);
    expect(r.sample, 'Sample mit Limiter (dBTP)').toBeLessThanOrEqual(-0.9);
    expect(r.slice, 'Slice mit Limiter (dBTP)').toBeLessThanOrEqual(-0.9);
    expect(r.sample, 'Sample muss am Meter ankommen').toBeGreaterThan(-6);
    expect(r.loopError).toBeNull();
    expect(r.sampleNoLimiter, 'ohne Limiter sichtbare Uebersteuerung').toBeGreaterThan(1.5);
  });
});

for (const fallback of [false, true]) {
  test.describe(`Master-Recorder${fallback ? ' (ScriptProcessor-Fallback)' : ' (AudioWorklet)'}`, () => {
    test('nimmt Play bis Stop auf und exportiert eine gueltige WAV-Datei', async ({ app, page }, testInfo) => {
      await app.load(fallback ? () => { delete window.AudioWorkletNode; } : undefined);
      await app.openBeatArchitekt();
      await app.fillPattern();
      await page.click('#playBtn'); await page.waitForTimeout(3000);
      await page.click('#playBtn'); await page.waitForTimeout(1600);
      const take1 = await page.evaluate(() => { const b = playbackState.audioBuffer; if (!b) return null;
        let s = 0; const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) s += d[i] * d[i];
        return { mode: masterRecorder.mode, dur: b.duration, ch: b.numberOfChannels, rmsDb: 10 * Math.log10(s / d.length) }; });
      expect(take1).not.toBeNull();
      expect(take1.mode).toBe(fallback ? 'scriptprocessor' : 'worklet');
      expect(take1.dur).toBeGreaterThan(3);
      expect(take1.dur).toBeLessThan(5.5);
      expect(take1.ch).toBe(2);
      expect(take1.rmsDb).toBeGreaterThan(-60);
      // schneller Wechsel: neuer Take ersetzt den alten, kein haengender Recorder
      await page.click('#playBtn'); await page.waitForTimeout(300); await page.click('#playBtn'); await page.waitForTimeout(200);
      await page.click('#playBtn'); await page.waitForTimeout(1500); await page.click('#playBtn'); await page.waitForTimeout(1600);
      const take2 = await page.evaluate(() => ({ dur: playbackState.audioBuffer.duration, recording: masterRecorder.recording }));
      expect(take2.dur).toBeGreaterThan(1.4);
      expect(take2.dur).toBeLessThan(3.2);
      expect(take2.recording).toBe(false);
      // Export ueber das YouTube-Preset (WAV 24 Bit, 48 kHz)
      await page.evaluate(() => { document.getElementById('phase30ExportPanel').style.display = 'block'; queueExport('youtube'); });
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('#phase30ProcessBtn')]);
      const file = testInfo.outputPath(dl.suggestedFilename());
      await dl.saveAs(file);
      const b = fs.readFileSync(file);
      expect(dl.suggestedFilename()).toMatch(/\.wav$/);
      expect(b.toString('ascii', 0, 4)).toBe('RIFF');
      expect(b.toString('ascii', 8, 12)).toBe('WAVE');
      expect(b.readUInt16LE(22)).toBe(2);
      expect(b.readUInt32LE(24)).toBe(48000);
      expect(b.readUInt16LE(34)).toBe(24);
      expect(await page.evaluate(() => exportState.queue.map(q => q.status))).toEqual(['completed']);
    });
  });
}

test.describe('Video-Export', () => {
  test('vor dem ersten Play ein Hinweis statt Fehler, danach WebM aus dem Master-Ausgang', async ({ app, page }, testInfo) => {
    // Chromium im Container hat keine MediaStreamAudioDestination: Shim zaehlt, ob der Master-Bus angeschlossen wird
    await app.load(() => {
      window.__shim = { created: 0, connected: 0, disconnected: 0 };
      if (typeof AudioContext.prototype.createMediaStreamAudioDestination !== 'function') {
        AudioContext.prototype.createMediaStreamAudioDestination = function () { const g = this.createGain(); g.stream = new MediaStream(); window.__shim.created++; return g; };
      }
      const conn = AudioNode.prototype.connect, disc = AudioNode.prototype.disconnect;
      AudioNode.prototype.connect = function (d, ...r) { if (d && d.stream instanceof MediaStream) window.__shim.connected++; return conn.call(this, d, ...r); };
      AudioNode.prototype.disconnect = function (d, ...r) { if (d && d.stream instanceof MediaStream) window.__shim.disconnected++; return disc.call(this, d, ...r); };
    });
    app.allowErrors(/^dialog: Bitte zuerst Play/);
    await page.evaluate(() => startVideoExport());
    expect(app.errors.filter(e => e.startsWith('pageerror'))).toEqual([]);
    expect(app.errors.some(e => /^dialog: Bitte zuerst Play/.test(e))).toBe(true);
    await app.openBeatArchitekt();
    await app.fillPattern();
    await app.play(); await page.waitForTimeout(500);
    await page.evaluate(() => { document.getElementById('videoExportPanel').style.display = 'block'; });
    await page.click('#videoExportStartBtn');
    await page.waitForTimeout(2500);
    const mid = await page.evaluate(() => ({ state: mediaRecorder && mediaRecorder.state, analyser: !!analyser }));
    expect(mid.state).toBe('recording');
    expect(mid.analyser).toBe(true);
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#videoExportStopBtn')]);
    const file = testInfo.outputPath('video.webm');
    await dl.saveAs(file);
    const b = fs.readFileSync(file);
    expect(b.slice(0, 4).toString('hex')).toBe('1a45dfa3'); // EBML
    expect(b.length).toBeGreaterThan(10000);
    const after = await page.evaluate(() => ({ shim: window.__shim, destCleared: videoExportAudioDest === null }));
    expect(after.shim.connected).toBeGreaterThan(0);
    expect(after.shim.disconnected).toBeGreaterThan(0);
    expect(after.destCleared).toBe(true);
  });
});
