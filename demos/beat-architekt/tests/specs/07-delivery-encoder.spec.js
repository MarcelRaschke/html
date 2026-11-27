// Phase 35: Delivery-Encoder. Jede Datei wird unabhaengig mit ffprobe geprueft und mit ffmpeg zurueckdecodiert.
const { test, expect, hasFfmpeg } = require('../helpers');
const { probe, decode, reference, findLag, compare } = require('../media');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const FFMPEG = hasFfmpeg();
// Lokal ohne ffmpeg ueberspringen; in CI ist ffmpeg Pflicht (der Workflow installiert es)
test.skip(!FFMPEG && !process.env.CI, 'ffmpeg/ffprobe nicht installiert');

const META = { title: 'Blue Dimension Test', artist: 'DJ Jesse Jay', album: 'Phase 35', genre: 'Techno', date: '2026-11-26', isrc: 'CHABC2600001' };

// Erzeugt im Browser Testsignal + Cover und ruft encodeToFormat auf; Rueckgabe base64 oder Fehler
async function encodeAll(page, jobs) {
  return page.evaluate(async ({ jobs, meta }) => {
    const mk = sr => {
      const len = sr * 3, buf = new AudioBuffer({ length: len, numberOfChannels: 2, sampleRate: sr });
      const L = buf.getChannelData(0), R = buf.getChannelData(1), a = Math.pow(10, -12 / 20), ramp = sr / 100;
      for (let i = 0; i < len; i++) { const env = Math.min(1, i / ramp, (len - 1 - i) / ramp); L[i] = a * env * Math.sin(2 * Math.PI * 440 * i / sr); R[i] = a * env * Math.sin(2 * Math.PI * 660 * i / sr); }
      return buf;
    };
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'); g.fillStyle = '#ff00aa'; g.fillRect(0, 0, 64, 64);
    const png = await new Promise(r => c.toBlob(r, 'image/png'));
    Object.assign(distributionState.releaseMetadata, { title: meta.title, artist: meta.artist, album: meta.album, genre: meta.genre,
      releaseDate: meta.date, isrc: 'CH-ABC-26-00001', coverArtFile: new File([png], 'cover.png', { type: 'image/png' }) });
    const md = deliveryMetadata('fallback');
    const b64 = async blob => { const u = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
    const out = {};
    for (const j of jobs) {
      try { const r = await encodeToFormat(mk(j.sr), j.format, j.bitrate, md, { bitDepth: j.bitDepth }); out[j.name] = { ext: r.ext, mime: r.mime, data: await b64(r.blob) }; }
      catch (e) { out[j.name] = { error: e.message, type: e.name }; }
    }
    return { out, isrc: md.isrc };
  }, { jobs, meta: META });
}

const CASES = [
  { name: 'wav16', format: 'wav', sr: 48000, bitDepth: 16, codec: 'pcm_s16le', bits: 16 },
  { name: 'wav24', format: 'wav', sr: 48000, bitDepth: 24, codec: 'pcm_s24le', bits: 24 },
  { name: 'aiff16', format: 'aiff', sr: 44100, bitDepth: 16, codec: 'pcm_s16be', bits: 16 },
  { name: 'aiff24', format: 'aiff', sr: 48000, bitDepth: 24, codec: 'pcm_s24be', bits: 24 },
  { name: 'mp3', format: 'mp3', sr: 44100, bitrate: 320, codec: 'mp3', lag: 1105, lagTol: 2, minSnr: 25, cover: true },
  { name: 'opus48', format: 'opus', sr: 48000, bitrate: 160, codec: 'opus', lag: 0, lagTol: 2, minSnr: 25 },
  { name: 'opus44', format: 'opus', sr: 44100, bitrate: 128, codec: 'opus', lag: 0, lagTol: 3, minSnr: 25 }
];

test.describe('Delivery-Encoder (Phase 35)', () => {
  test('WAV, AIFF, MP3 und Opus: Codec, Tags, Laenge, Versatz und Signaltreue', async ({ app, page }, testInfo) => {
    await app.load();
    const { out, isrc } = await encodeAll(page, CASES);
    expect(isrc).toBe('CHABC2600001');
    for (const c of CASES) {
      const r = out[c.name];
      expect(r.error, `${c.name}: Encoderfehler`).toBeUndefined();
      const file = testInfo.outputPath(`${c.name}.${r.ext}`);
      fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
      const p = probe(file);
      expect(p.audio.codec_name, c.name).toBe(c.codec);
      expect(Number(p.audio.sample_rate), c.name).toBe(c.format === 'opus' ? 48000 : c.sr);
      expect(p.audio.channels, c.name).toBe(2);
      // Tags: AIFF kennt nur NAME/AUTH (ffmpeg: title/author), der Rest steht im ANNO-Chunk (comment)
      expect(p.tags.title, `${c.name} title`).toBe(META.title);
      expect(c.format === 'aiff' ? p.tags.author : p.tags.artist, `${c.name} artist`).toBe(META.artist);
      if (c.format !== 'aiff') expect(p.tags.album, `${c.name} album`).toBe(META.album);
      const isrcTag = p.tags.isrc || p.tags.tsrc || p.tags.comment || '';
      expect(isrcTag, `${c.name} ISRC`).toContain('CHABC2600001');
      if (c.cover) expect(p.hasCover, `${c.name} Cover`).toBe(true);

      const { L, R } = decode(file, c.sr);
      const rL = reference(c.sr, 0), rR = reference(c.sr, 1);
      if (c.format === 'opus') expect(L.length, `${c.name}: decodierte Laenge`).toBeGreaterThanOrEqual(c.sr * 3 - (c.sr === 48000 ? 0 : 2));
      if (c.format === 'opus') expect(L.length, `${c.name}: decodierte Laenge`).toBeLessThanOrEqual(c.sr * 3 + 2);
      const lag = findLag(L, R, rL, rR);
      expect(Math.abs(lag - (c.lag || 0)), `${c.name}: Versatz ${lag}`).toBeLessThanOrEqual(c.lagTol || 0);
      const cl = compare(L, rL, lag), cr = compare(R, rR, lag);
      if (c.bits) {
        const lsb = Math.pow(2, -(c.bits - 1));
        expect(Math.max(cl.peak, cr.peak) / lsb, `${c.name}: Fehler in LSB`).toBeLessThanOrEqual(1.6);
      } else {
        expect(Math.min(cl.snr, cr.snr), `${c.name}: SNR`).toBeGreaterThanOrEqual(c.minSnr);
      }
      expect(compare(R, rL, lag).snr, `${c.name}: Kanaele vertauscht`).toBeLessThan(0);
    }
  });

  test('AAC: M4A, wenn der Browser einen AAC-Encoder hat, sonst klarer Fehler statt umbenannter WAV-Datei', async ({ app, page }, testInfo) => {
    await app.load();
    const { out } = await encodeAll(page, [{ name: 'aac', format: 'aac', sr: 48000, bitrate: 256 }, { name: 'flac', format: 'flac', sr: 48000 }]);
    expect(out.flac.type).toBe('DeliveryEncodeError');
    if (out.aac.error) {
      expect(out.aac.type).toBe('DeliveryEncodeError');
      expect(out.aac.error).toMatch(/AAC-Encoder in diesem Browser nicht verfuegbar/);
      testInfo.annotations.push({ type: 'hinweis', description: 'kein AAC-Encoder in diesem Browser, nur Fehlerpfad geprueft' });
      return;
    }
    const file = testInfo.outputPath('aac.m4a');
    fs.writeFileSync(file, Buffer.from(out.aac.data, 'base64'));
    const p = probe(file);
    expect(p.audio.codec_name).toBe('aac');
    expect(p.tags.title).toBe(META.title);
    expect(Math.abs(Number(p.format.duration) - 3)).toBeLessThan(0.05);
  });

  test('M4A-Muxer liefert dieselben Samples wie der AAC-Ausgangsstrom, Edit-Liste und Tags stimmen', async ({ app, page }, testInfo) => {
    await app.load();
    // Referenz-AAC mit ffmpeg erzeugen, ADTS-Header entfernen, AudioSpecificConfig bilden
    const wav = testInfo.outputPath('src.wav'), adts = testInfo.outputPath('ref.aac');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=3', '-ac', '2', wav]);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', wav, '-c:a', 'aac', '-b:a', '256k', '-f', 'adts', adts]);
    const a = fs.readFileSync(adts), frames = [];
    let profile, srIndex, chCfg;
    for (let o = 0; o < a.length;) {
      expect(a[o] === 0xff && (a[o + 1] & 0xf0) === 0xf0, 'ADTS-Sync').toBe(true);
      profile = (a[o + 2] >> 6) & 3; srIndex = (a[o + 2] >> 2) & 15; chCfg = ((a[o + 2] & 1) << 2) | (a[o + 3] >> 6);
      const len = ((a[o + 3] & 3) << 11) | (a[o + 4] << 3) | (a[o + 5] >> 5), hdr = (a[o + 1] & 1) ? 7 : 9;
      frames.push(Array.from(a.subarray(o + hdr, o + len))); o += len;
    }
    const asc = [((profile + 1) << 3) | (srIndex >> 1), ((srIndex & 1) << 7) | (chCfg << 3)];
    const files = await page.evaluate(({ frames, asc, meta }) => {
      const res = {};
      for (const [name, priming] of [['plain', 0], ['primed', 1024]]) {
        res[name] = Array.from(buildM4A({ frames: frames.map(f => Uint8Array.from(f)), asc: Uint8Array.from(asc), sampleRate: 48000, channels: 2,
          bitrate: 256000, metadata: meta, cover: null, primingSamples: priming, totalSamples: 144000 }));
      }
      return res;
    }, { frames, asc, meta: META });
    const plain = testInfo.outputPath('plain.m4a'), primed = testInfo.outputPath('primed.m4a');
    fs.writeFileSync(plain, Buffer.from(files.plain)); fs.writeFileSync(primed, Buffer.from(files.primed));
    const p = probe(plain);
    expect(p.audio.codec_name).toBe('aac');
    expect(p.audio.profile).toBe('LC');
    expect(p.tags.title).toBe(META.title);
    expect(p.tags.isrc).toBe(META.isrc);
    const raw = f => execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-map', '0:a:0', '-f', 'f32le', '-'], { maxBuffer: 1 << 26 });
    const ref = raw(adts), got = raw(plain), gotPrimed = raw(primed);
    expect(Buffer.compare(ref, got), 'M4A ohne Edit-Liste: identische Samples').toBe(0);
    expect(Buffer.compare(ref.subarray(1024 * 8, 1024 * 8 + gotPrimed.length), gotPrimed), 'Edit-Liste ueberspringt 1024 Samples').toBe(0);
    expect(Math.abs(Number(probe(primed).format.duration) - 3)).toBeLessThan(0.001);
  });

  test('Export ueber die Oberflaeche: richtige Endungen, Metadaten aus dem Release-Editor, Fehlergrund in der Queue', async ({ app, page }, testInfo) => {
    await app.load();
    app.allowErrors(/(Performance export error|Export error).*AAC-Encoder/);
    const downloads = [];
    page.on('download', async d => { const f = testInfo.outputPath(d.suggestedFilename()); await d.saveAs(f); downloads.push(f); });
    await app.openBeatArchitekt();
    await page.evaluate(() => loadPattern('four_floor'));
    await page.click('#playBtn'); await page.waitForTimeout(3500);
    await page.click('#playBtn'); await page.waitForTimeout(1800);
    await page.evaluate(() => {
      Object.assign(distributionState.releaseMetadata, { title: 'Peak Time Loop', artist: 'DJ Jesse Jay', album: 'Blue Dimension', genre: 'Techno', releaseDate: '2026-11-26', isrc: 'CH-ABC-26-00002' });
      document.getElementById('phase30ExportPanel').style.display = 'block';
      document.getElementById('phase30Filename').value = 'peak';
      for (const p of ['spotify', 'appleMusic', 'youtube', 'archiveQuality', 'webOpus']) queueExport(p);
    });
    await page.click('#phase30ProcessBtn');
    await page.waitForFunction(() => !exportState.isProcessing && exportState.queue.every(t => t.status !== 'queued'), null, { timeout: 120000 });
    await page.waitForTimeout(1500);
    const queue = await page.evaluate(() => exportState.queue.map(t => ({ preset: t.preset, status: t.status, error: t.error, info: t.result && t.result.info })));
    const shown = await page.evaluate(() => Array.from(document.querySelectorAll('#phase30QueueInfo .export-detail')).map(e => e.textContent.trim()));
    const byPreset = Object.fromEntries(queue.map(q => [q.preset, q]));
    for (const p of ['spotify', 'youtube', 'archiveQuality', 'webOpus']) expect(byPreset[p].status, p).toBe('completed');
    const names = downloads.map(f => path.basename(f)).sort();
    const want = ['peak_archiveQuality.aiff', 'peak_spotify.mp3', 'peak_webOpus.opus', 'peak_youtube.wav'];
    if (byPreset.appleMusic.status === 'completed') want.push('peak_appleMusic.m4a');
    else expect(byPreset.appleMusic.error).toMatch(/AAC-Encoder/);
    expect(names).toEqual(want.sort());
    expect(shown.length).toBe(5);
    for (const f of downloads) {
      const p = probe(f);
      expect(p.tags.title, path.basename(f)).toBe('Peak Time Loop');
    }
    expect(probe(downloads.find(f => f.endsWith('.wav'))).audio.bits_per_sample).toBe(24);
    expect(probe(downloads.find(f => f.endsWith('.aiff'))).audio.codec_name).toBe('pcm_s24be');
  });
});
