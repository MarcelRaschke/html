// Pattern-Crossfade (#299), KI-Mix-Pause (#300), Gain-Sicherheit (#301), Frequenzbalance und Bass-Toleranz (#302, #303)
const { test, expect } = require('../helpers');

async function twoPatterns(app, page, name) {
  await app.load();
  await app.openBeatArchitekt();
  await app.fillPattern();
  return page.evaluate(async name => {
    setBPM(240); // 1 Takt = 1 s
    await savePattern(name + '_A'); const idA = currentPatternId;
    await savePattern(name + '_B'); const idB = currentPatternId;
    await loadPatternById(idA);
    return { idA, idB };
  }, name);
}

test.describe('Pattern-Crossfade ueber globalMasterGain', () => {
  test('blendet aus, wechselt das Pattern und stellt den Pegel wieder her; Abbruch und MIDI im Fade', async ({ app, page }) => {
    const ids = await twoPatterns(app, page, 'XF');
    await app.play(); await page.waitForTimeout(500);
    const normal = await page.evaluate(async ids => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      setUserMasterVolume(0.8); await sleep(50);
      queuePattern(ids.idB, 1);
      const trace = []; const t0 = performance.now();
      while (performance.now() - t0 < 2600) { trace.push(globalMasterGain.gain.value); await sleep(100); }
      await sleep(300);
      return { min: Math.min(...trace), finalGain: globalMasterGain.gain.value, onB: currentPattern.id === ids.idB, active: sequencerState.crossfade.active };
    }, ids);
    expect(normal.min, 'im Fade muss der Pegel deutlich sinken').toBeLessThan(0.3);
    expect(normal.finalGain).toBeCloseTo(0.8, 2);
    expect(normal.onB).toBe(true);
    expect(normal.active).toBe(false);

    const abort = await page.evaluate(async ids => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      queuePattern(ids.idA, 1); await sleep(1500);
      const mid = globalMasterGain.gain.value;
      abortCrossfade(); await sleep(150);
      return { mid, after: globalMasterGain.gain.value, onB: currentPattern.id === ids.idB };
    }, ids);
    expect(abort.mid).toBeLessThan(0.8);
    expect(abort.after).toBeCloseTo(0.8, 2);
    expect(abort.onB).toBe(true);

    const midi = await page.evaluate(async ids => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      queuePattern(ids.idA, 1); await sleep(1400);
      handleMIDIKnob(midiMapping.knobs.volume, 0.5);
      await sleep(1200);
      return { finalGain: globalMasterGain.gain.value, onA: currentPattern.id === ids.idA };
    }, ids);
    expect(midi.finalGain, 'MIDI-Wert gilt ab dem naechsten Pattern').toBeCloseTo(0.5, 2);
    expect(midi.onA).toBe(true);
  });
});

test.describe('KI-Mix', () => {
  test('pausiert waehrend des Crossfades und greift danach wieder', async ({ app, page }) => {
    const ids = await twoPatterns(app, page, 'AI');
    await app.play(); await page.waitForTimeout(500);
    const r = await page.evaluate(async ids => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const g = () => globalMasterGain.gain.value;
      const rec = { type: 'loudness', suggestion: 2, priority: 'high', message: 'test' };
      setUserMasterVolume(0.8); await sleep(60);
      queuePattern(ids.idB, 1);
      await sleep(1300); // im Fade
      const g1 = g(); applyRecommendation(rec); aiMixing.recommendations = [rec]; aiMixing.autoApplyEnabled = true;
      analyzeCurrentMix(); await sleep(150); const g2 = g();
      const during = { inProgress: crossfadeInProgress(), rampContinues: g2 < g1, notice: (document.getElementById('recommendationsList') || {}).textContent || '' };
      aiMixing.autoApplyEnabled = false;
      await sleep(1200);
      const afterGain = g(), inProgress = crossfadeInProgress();
      applyRecommendation(rec); await sleep(80);
      return { during, after: { inProgress, gain: afterGain, onB: currentPattern.id === ids.idB, applied: g() } };
    }, ids);
    expect(r.during.inProgress).toBe(true);
    expect(r.during.rampContinues, 'Empfehlung darf die Ausblend-Rampe nicht unterbrechen').toBe(true);
    expect(r.during.notice).toMatch(/pausiert/i);
    expect(r.after.inProgress).toBe(false);
    expect(r.after.onB).toBe(true);
    expect(r.after.applied, 'nach dem Fade wirkt die Empfehlung wieder').toBeGreaterThan(r.after.gain + 0.05);
  });

  test('Nutzer-Lautstaerke und KI-Trim bleiben getrennt, Trim begrenzt, stumm ohne Empfehlung', async ({ app, page }) => {
    const ids = await twoPatterns(app, page, 'GS');
    await app.play(); await page.waitForTimeout(600);
    const r = await page.evaluate(async ids => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const knob = midiMapping.knobs.volume;
      const st = () => ({ user: masterGainState.user, aiTrim: masterGainState.aiTrim, gain: globalMasterGain.gain.value });
      const out = {};
      handleMIDIKnob(knob, 0.2); await sleep(800);
      aiMixing.autoApplyEnabled = true; analyzeCurrentMix(); await sleep(300); aiMixing.autoApplyEnabled = false;
      out.userDown = { ...st(), upRecs: aiMixing.recommendations.filter(x => x.type === 'loudness' && x.suggestion > 0).length };
      handleMIDIKnob(knob, 0.6); await sleep(100);
      for (let i = 0; i < 3; i++) applyRecommendation({ type: 'loudness', suggestion: 5, priority: 'high' });
      await sleep(400); out.aiUp = st();
      handleMIDIKnob(knob, 0.4); await sleep(300); out.userAfterAI = st();
      handleMIDIKnob(knob, 0); await sleep(300); analyzeCurrentMix(); await sleep(100);
      out.muted = aiMixing.recommendations.filter(x => x.type === 'loudness').length;
      handleMIDIKnob(knob, 0.5); await sleep(300);
      applyRecommendation({ type: 'loudness', suggestion: -6, priority: 'high' }); await sleep(300);
      queuePattern(ids.idB, 1); await sleep(1500);
      handleMIDIKnob(knob, 0.8);
      await sleep(1100);
      out.crossfade = { ...st(), expected: 0.8 * masterGainState.aiTrim };
      return out;
    }, ids);
    expect(r.userDown.user).toBeCloseTo(0.2, 3);
    expect(r.userDown.aiTrim, 'KI arbeitet nicht gegen den leisen Regler').toBeCloseTo(1.0, 3);
    expect(r.userDown.upRecs).toBe(0);
    expect(r.aiUp.user).toBeCloseTo(0.6, 3);
    expect(20 * Math.log10(r.aiUp.aiTrim), 'Trim-Obergrenze +3,5 dB').toBeCloseTo(3.5, 1);
    expect(r.userAfterAI.user).toBeCloseTo(0.4, 3);
    expect(r.userAfterAI.aiTrim).toBeCloseTo(r.aiUp.aiTrim, 3);
    expect(r.muted).toBe(0);
    expect(r.crossfade.gain).toBeCloseTo(r.crossfade.expected, 2);
  });

  test('Frequenzbalance: rosa Rauschen neutral, Bass-Toleranz je Profil, pegelunabhaengig, Profil gespeichert', async ({ app, page }) => {
    await app.load();
    await app.initAudio();
    expect(await page.evaluate(() => aiMixing.balanceProfile)).toBe('electronic');
    await app.play(); await page.waitForTimeout(1000);
    const r = await page.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const n = audioCtx.sampleRate * 4, buf = audioCtx.createBuffer(2, n, audioCtx.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.96900 * b2 + w * 0.1538520;
          b3 = 0.86650 * b3 + w * 0.3104856; b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.03; b6 = w * 0.115926; } }
      const out = {};
      for (const shelf of [0, -6, 15]) {
        const src = audioCtx.createBufferSource(); src.buffer = buf; src.loop = true;
        const f = audioCtx.createBiquadFilter(); f.type = 'lowshelf'; f.frequency.value = 250; f.gain.value = shelf;
        src.connect(f); f.connect(globalMasterGain); src.start(); await sleep(300); resetAIMixSpectrum(); await sleep(2500);
        const row = {};
        for (const prof of ['neutral', 'electronic']) { setAIMixBalanceProfile(prof); analyzeCurrentMix(); row[prof] = aiMixing.recommendations.filter(x => x.type !== 'loudness').map(x => x.type + (x.suggestion > 0 ? '+' : '-')); }
        row.balance = { ...aiMixing.frequencyBalance };
        if (shelf === 15) { // Pegelunabhaengigkeit: Nutzer-Lautstaerke 1,0 vs. 0,3
          setUserMasterVolume(0.3); await sleep(300); resetAIMixSpectrum(); await sleep(2500); analyzeCurrentMix();
          row.levelDiff = Math.max(...['bass', 'mids', 'treble'].map(k => Math.abs(aiMixing.frequencyBalance[k] - row.balance[k])));
          setUserMasterVolume(1.0);
        }
        out['shelf' + shelf] = row;
        src.stop(); src.disconnect(); f.disconnect(); await sleep(800);
      }
      // Profilwechsel loest kein Auto-Apply aus
      let applied = 0; const orig = window.applyRecommendation; window.applyRecommendation = () => { applied++; };
      aiMixing.autoApplyEnabled = true; aiMixing.frequencyBalance = { bass: 14, mids: -7, treble: -7 };
      setAIMixBalanceProfile('neutral'); setAIMixBalanceProfile('electronic');
      aiMixing.autoApplyEnabled = false; window.applyRecommendation = orig;
      out.autoApplied = applied;
      out.invalidAccepted = setAIMixBalanceProfile('gibtsnicht');
      setAIMixBalanceProfile('neutral');
      return out;
    });
    for (const k of ['bass', 'mids', 'treble']) expect(Math.abs(r.shelf0.balance[k]), `rosa Rauschen ${k}`).toBeLessThan(1.5);
    expect(r.shelf0.neutral).toEqual([]);
    expect(r.shelf0.electronic).toEqual([]);
    expect(r['shelf-6'].neutral).toEqual([]);
    expect(r['shelf-6'].electronic).toEqual(['bass+']);
    expect(r.shelf15.neutral).toContain('bass-');
    expect(r.shelf15.electronic).toEqual([]);
    expect(r.shelf15.levelDiff).toBeLessThan(1.5);
    expect(r.autoApplied).toBe(0);
    expect(r.invalidAccepted).toBe(false);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => typeof aiMixing !== 'undefined');
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => [aiMixing.balanceProfile, document.getElementById('aiMixProfileSelect').value])).toEqual(['neutral', 'neutral']);
  });
});
