// Unabhaengige Pruefung exportierter Audiodateien mit ffprobe/ffmpeg (Phase 35/36).
const { execFileSync } = require('child_process');

function probe(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], { encoding: 'utf8' });
  const j = JSON.parse(out);
  const audio = j.streams.find(s => s.codec_type === 'audio');
  const tags = {};
  for (const [k, v] of Object.entries({ ...(j.format.tags || {}), ...((audio && audio.tags) || {}) })) tags[k.toLowerCase()] = v;
  return { format: j.format, audio, hasCover: j.streams.some(s => s.codec_type === 'video'), tags };
}

// Rueckdecodieren nach Float32 Stereo bei gegebener Rate
function decode(file, sampleRate) {
  const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:a:0', '-f', 'f32le', '-ac', '2', '-ar', String(sampleRate), '-'],
    { maxBuffer: 1 << 28 });
  const f = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  const n = f.length / 2, L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = f[2 * i]; R[i] = f[2 * i + 1]; }
  return { L, R };
}

// Referenz wie im Browser-Test: links 440 Hz, rechts 660 Hz, -12 dBFS, 3 s, 10-ms-Rampen
function reference(sampleRate, channel) {
  const n = sampleRate * 3, a = Math.pow(10, -12 / 20), ramp = sampleRate / 100, f = channel === 0 ? 440 : 660;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = a * Math.min(1, i / ramp, (n - 1 - i) / ramp) * Math.sin(2 * Math.PI * f * i / sampleRate);
  return out;
}

// Versatz zweistufig: grob ueber den Signaleinsatz, fein per Kreuzkorrelation in +/-40 Samples.
// Reine Kreuzkorrelation waere bei zwei Sinustoenen periodisch mehrdeutig (gemeinsame Periode 220 Hz).
function findLag(L, R, rL, rR) {
  const onset = (a, b) => { for (let i = 0; i < a.length; i++) if (Math.abs(a[i]) + Math.abs(b[i]) > 0.02) return i; return -1; };
  const coarse = onset(L, R) - onset(rL, rR);
  let best = coarse, bestAcc = -Infinity;
  const s = Math.floor(rL.length / 3), n = 8192;
  for (let lag = coarse - 40; lag <= coarse + 40; lag++) {
    let acc = 0;
    for (let i = s; i < s + n; i += 2) { const j = i + lag; if (j >= 0 && j < L.length) acc += L[j] * rL[i] + R[j] * rR[i]; }
    if (acc > bestAcc) { bestAcc = acc; best = lag; }
  }
  return best;
}

// Signal-Rausch-Abstand und Spitzenfehler im Mittelteil (Rampen ausgenommen)
function compare(x, ref, lag) {
  const s = Math.floor(ref.length / 10), e = ref.length - s;
  let sig = 0, err = 0, peak = 0;
  for (let i = s; i < e; i++) {
    const j = i + lag;
    if (j < 0 || j >= x.length) return { snr: -Infinity, peak: Infinity };
    const d = x[j] - ref[i]; sig += ref[i] * ref[i]; err += d * d; peak = Math.max(peak, Math.abs(d));
  }
  return { snr: err > 0 ? 10 * Math.log10(sig / err) : Infinity, peak };
}

module.exports = { probe, decode, reference, findLag, compare };
