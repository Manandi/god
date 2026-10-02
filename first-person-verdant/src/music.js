// Mycel's theme: an original lofi forest loop, synthesised in the browser (no
// audio files, nothing copyrighted). Warm electric-piano chords on a descending
// Fmaj7 · Em7 · Dm7 · Cmaj7 progression, a round bass, a soft swung beat, a
// breathy pentatonic flute, vinyl crackle and the odd bird. It plays while
// Mycel talks (the intro and the rest of onboarding) and fades out after.
//
// Browsers only start audio after a click or key press, so the loop waits for
// the first one. MUSIC ON/OFF is remembered in localStorage.

const PREF = 'hollow-roots-music';
const BPM = 72, BEAT = 60 / BPM, BAR = BEAT * 4, SWING = .16;
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
// Chord voicings (MIDI) and their bass roots.
const CHORDS = [
  { notes: [53, 57, 60, 64, 67], root: 41 },   // Fmaj9
  { notes: [52, 55, 59, 62, 66], root: 40 },   // Em9
  { notes: [50, 53, 57, 60, 64], root: 38 },   // Dm9
  { notes: [48, 52, 55, 59, 62], root: 36 }    // Cmaj9
];
// F major pentatonic for the flute, and an eight-bar phrase of [beat, step, length]
// (step indexes the scale; null bars rest so the tune breathes).
const SCALE = [65, 67, 69, 72, 74, 77, 79, 81];
const PHRASES = [
  [[0, 4, 1.5], [1.5, 3, .5], [2, 2, 2]],
  [[.5, 1, .5], [1, 2, 1], [2.5, 0, 1.5]],
  null,
  [[0, 2, 1], [1, 3, 1], [2, 4, .5], [2.5, 5, 1.5]],
  [[0, 6, 2], [2.5, 5, .5], [3, 4, 1]],
  [[0, 3, 1.5], [2, 2, 2]],
  [[1, 1, .5], [1.5, 2, .5], [2, 0, 2]],
  null
];

function enabledPref() { try { return localStorage.getItem(PREF) !== 'off'; } catch { return true; } }

export function createLofi() {
  let ctx = null, master = null, bus = null, noise = null, timer = null, nextBar = 0, bar = 0, wanted = false, enabled = enabledPref();
  const listeners = new Set();

  function setup() {
    if (ctx) return true;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return false; }
    master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    const warm = ctx.createBiquadFilter(); warm.type = 'lowpass'; warm.frequency.value = 3800;
    bus = ctx.createGain(); bus.connect(warm).connect(comp).connect(master).connect(ctx.destination);
    // One second of white noise, reused by the drums, the crackle and the flute's breath.
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    crackle();
    return true;
  }
  const noiseSrc = () => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; return s; };
  function env(g, t, a, peak, hold, rel) {
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * .55, t + a, hold * .5); g.gain.setTargetAtTime(0, t + a + hold, rel);
  }
  // Electric piano: a sine with a soft overtone and tremolo.
  function keys(midi, t, len, vol = .05) {
    const g = ctx.createGain(), o = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = ctx.createGain();
    o.type = 'sine'; o.frequency.value = hz(midi); o2.type = 'triangle'; o2.frequency.value = hz(midi) * 2; g2.gain.value = .18;
    const trem = ctx.createOscillator(), tg = ctx.createGain(); trem.frequency.value = 4.2; tg.gain.value = vol * .25; trem.connect(tg).connect(g.gain);
    o.connect(g); o2.connect(g2).connect(g); g.connect(bus); env(g, t, .04, vol, len * .6, .5);
    for (const x of [o, o2, trem]) { x.start(t); x.stop(t + len + 2); }
  }
  function bass(midi, t, len) {
    const g = ctx.createGain(), o = ctx.createOscillator(), f = ctx.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = hz(midi); f.type = 'lowpass'; f.frequency.value = 420;
    o.connect(f).connect(g).connect(bus); env(g, t, .02, .11, len * .5, .18); o.start(t); o.stop(t + len + 1);
  }
  function kick(t) {
    const g = ctx.createGain(), o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + .18);
    g.gain.setValueAtTime(.32, t); g.gain.exponentialRampToValueAtTime(.001, t + .35); o.connect(g).connect(bus); o.start(t); o.stop(t + .4);
  }
  function brush(t, vol, freq, len) {
    const s = noiseSrc(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = .8;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0008, t + len);
    s.connect(f).connect(g).connect(bus); s.start(t, Math.random() * .8); s.stop(t + len + .05);
  }
  // A breathy flute: sine with delayed vibrato and a little filtered air.
  function flute(midi, t, len) {
    const g = ctx.createGain(), o = ctx.createOscillator(), vib = ctx.createOscillator(), vg = ctx.createGain();
    o.type = 'sine'; o.frequency.value = hz(midi); vib.frequency.value = 5.2; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(hz(midi) * .012, t + .35);
    vib.connect(vg).connect(o.frequency); o.connect(g).connect(bus); env(g, t, .09, .045, len * .8, .25);
    const air = noiseSrc(), af = ctx.createBiquadFilter(), ag = ctx.createGain(); af.type = 'bandpass'; af.frequency.value = hz(midi) * 2; af.Q.value = 6;
    air.connect(af).connect(ag).connect(bus); env(ag, t, .05, .012, len * .5, .2);
    for (const x of [o, vib]) { x.start(t); x.stop(t + len + 1.2); } air.start(t, Math.random() * .5); air.stop(t + len + 1);
  }
  function bird(t) {
    const g = ctx.createGain(), o = ctx.createOscillator(); o.type = 'sine';
    const f0 = 2600 + Math.random() * 1200;
    for (let i = 0; i < 3; i++) { const s = t + i * .11; o.frequency.setValueAtTime(f0, s); o.frequency.exponentialRampToValueAtTime(f0 * 1.35, s + .06); }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.012, t + .02); g.gain.setTargetAtTime(0, t + .32, .05);
    o.connect(g).connect(bus); o.start(t); o.stop(t + .5);
  }
  // Vinyl: a quiet hiss and random little clicks, running for as long as the music does.
  function crackle() {
    const hiss = noiseSrc(), hf = ctx.createBiquadFilter(), hg = ctx.createGain();
    hf.type = 'highpass'; hf.frequency.value = 5000; hg.gain.value = .006; hiss.connect(hf).connect(hg).connect(bus); hiss.start();
  }
  function scheduleBar(t, n) {
    const chord = CHORDS[n % 4];
    // Chords: on the one, with a lazy re-strike on the "and" of three.
    chord.notes.forEach((m, i) => { keys(m, t + i * .012, BAR * .9, .038); });
    chord.notes.slice(1, 4).forEach((m, i) => keys(m + 12, t + BEAT * 2.5 + SWING * BEAT + i * .01, BEAT * 1.2, .02));
    bass(chord.root, t, BEAT * 1.8); bass(chord.root, t + BEAT * 2.5 + SWING * BEAT, BEAT); bass(chord.root + 7, t + BEAT * 3.5 + SWING * BEAT, BEAT * .5);
    // Beat (from bar 2): kick on 1 and the "and" of 2, brushes on 2 and 4, swung hats.
    if (n >= 1) {
      kick(t); kick(t + BEAT * 1.5 + SWING * BEAT);
      brush(t + BEAT, .09, 1800, .22); brush(t + BEAT * 3, .09, 1800, .22);
      for (let i = 0; i < 8; i++) brush(t + i * BEAT / 2 + (i % 2 ? SWING * BEAT : 0), i % 2 ? .016 : .028, 8000, .05);
    }
    // Flute (from bar 4), on an eight-bar phrase.
    const phrase = n >= 4 ? PHRASES[(n - 4) % PHRASES.length] : null;
    if (phrase) for (const [b, step, len] of phrase) flute(SCALE[step], t + b * BEAT + (b % 1 ? SWING * BEAT : 0), len * BEAT);
    if (Math.random() < .35) bird(t + Math.random() * BAR);
  }
  function tick() {
    while (nextBar < ctx.currentTime + .6) { scheduleBar(nextBar, bar++); nextBar += BAR; }
  }
  function run() {
    if (!setup()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value, now); master.gain.linearRampToValueAtTime(.55, now + 2.5);
    if (!timer) { nextBar = now + .1; bar = 0; tick(); timer = setInterval(tick, 150); }
  }
  function halt(fade = 2) {
    if (!ctx || !timer) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value, now); master.gain.linearRampToValueAtTime(0, now + fade);
    clearInterval(timer); timer = null;
  }
  const sync = () => { if (wanted && enabled) run(); else halt(); listeners.forEach(f => f()); };
  // The first click or key press lets the browser start audio.
  const unlock = () => { if (wanted && enabled) run(); };
  addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
  return {
    get enabled() { return enabled; },
    get playing() { return !!timer && ctx?.state === 'running'; },
    /** Should Mycel's theme be playing now? (the view decides; the player's setting has the last word) */
    want(on) { if (wanted === on) return; wanted = on; sync(); },
    toggle() { enabled = !enabled; try { localStorage.setItem(PREF, enabled ? 'on' : 'off'); } catch { /* private mode */ } sync(); return enabled; },
    onChange(f) { listeners.add(f); }
  };
}
