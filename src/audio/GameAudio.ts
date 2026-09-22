type Track = 'ambient' | 'boss' | 'intro';
type Sfx = 'stomp' | 'hit' | 'portal' | 'roar' | 'charge';

/** Original procedural audio: every note and effect is synthesized at runtime,
 * so the game ships without borrowed recordings or third-party music rights. */
export class GameAudio {
  private static context?: AudioContext;
  private static master?: GainNode;
  private static music?: GainNode;
  private static sfxBus?: GainNode;
  private static timer?: number;
  private static track?: Track;
  private static readonly musicVoices = new Set<AudioScheduledSourceNode>();

  static unlock(): void {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.music = this.context.createGain();
      this.sfxBus = this.context.createGain();
      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 14;
      compressor.ratio.value = 5;
      this.master.gain.value = 0.9;
      this.music.gain.value = 0.58;
      this.sfxBus.gain.value = 0.92;
      this.music.connect(this.master);
      this.sfxBus.connect(this.master);
      this.master.connect(compressor).connect(this.context.destination);
    }
    if (this.context.state === 'suspended') void this.context.resume();
  }

  static startAmbient(): void { this.startTrack('ambient'); }
  static startBoss(): void { this.startTrack('boss'); }
  static startIntro(): void { this.startTrack('intro'); }

  private static startTrack(track: Track): void {
    this.unlock();
    if (!this.context || !this.music || (this.track === track && this.timer !== undefined)) return;
    const changed = this.track !== track;
    this.track = track;
    if (this.timer !== undefined) window.clearInterval(this.timer);
    this.timer = undefined;
    if (changed) this.stopMusicVoices();
    const begin = (): void => {
      if (!this.context || !this.music || this.track !== track || this.timer !== undefined) return;
      const now = this.context.currentTime;
      this.music.gain.cancelScheduledValues(this.context.currentTime);
      this.music.gain.setValueAtTime(0.0001, now);
      const level = track === 'boss' ? 0.78 : track === 'intro' ? 0.5 : 0.58;
      this.music.gain.linearRampToValueAtTime(level, now + (track === 'intro' ? 1.6 : 0.06));
      this.playPhrase(track);
      // The intro loop is four bars at 72 BPM.
      const period = track === 'boss' ? 2857 : track === 'intro' ? Math.round((60 / 72) * 16 * 1000) : 4000;
      this.timer = window.setInterval(() => this.playPhrase(track), period);
    };
    if (this.context.state === 'running') begin();
    else void this.context.resume().then(begin);
  }

  private static playPhrase(track: Track): void {
    const ctx = this.context;
    const output = this.music;
    if (!ctx || !output) return;
    const start = ctx.currentTime + 0.04;
    if (track === 'ambient') {
      const chords = [[110, 130.81, 164.81], [98, 123.47, 146.83], [87.31, 110, 130.81], [98, 123.47, 164.81]];
      chords.forEach((chord, index) => chord.forEach((frequency, voice) => {
        this.tone(frequency, start + index, 0.98, voice === 0 ? 'sine' : 'triangle', voice === 0 ? 0.11 : 0.075, output, 1050);
      }));
      [329.63, 392, 440, 392, 293.66, 329.63, 246.94, 293.66].forEach((frequency, index) => {
        this.tone(frequency, start + index * 0.5, 0.28, 'sine', 0.065, output, 1800);
      });
      for (let i = 0; i < 8; i += 1) {
        if (i % 4 === 0) this.sweep(82, 48, start + i * 0.5, 0.14, 'sine', 0.16, output);
        if (i % 4 === 2) this.noise(start + i * 0.5, 0.11, 0.055, output, 1250);
        this.noise(start + i * 0.5 + 0.25, 0.025, 0.018, output, 4200);
      }
    } else if (track === 'intro') {
      // Lo-fi at 72 BPM: a ii-V-I-vi turnaround on a detuned Rhodes-ish pad,
      // swung hats, a soft kick and rim, and a bed of vinyl crackle. Written
      // rather than sampled, so it carries no licence with it.
      const beat = 60 / 72;
      const bar = beat * 4;
      const chords: Array<{ bass: number; voices: number[] }> = [
        { bass: 73.42, voices: [146.83, 174.61, 220, 261.63, 329.63] }, // Dm9
        { bass: 49.00, voices: [123.47, 174.61, 196, 246.94, 329.63] }, // G13
        { bass: 65.41, voices: [130.81, 164.81, 196, 246.94, 293.66] }, // Cmaj9
        { bass: 55.00, voices: [110, 130.81, 164.81, 196, 246.94] }     // Am7
      ];

      chords.forEach((chord, index) => {
        const at = start + index * bar;
        // Bass sits slightly behind the beat, the way a sampled loop drags.
        this.tone(chord.bass, at + 0.02, bar * 0.92, 'sine', 0.17, output, 320);
        this.tone(chord.bass * 2, at + 0.03, bar * 0.5, 'triangle', 0.05, output, 520);
        chord.voices.forEach((frequency, voice) => {
          const stagger = voice * 0.022;
          const level = voice === 0 ? 0.062 : 0.042;
          // Two voices a few cents apart give the pad its tape-warped shimmer.
          this.tone(frequency, at + 0.18 + stagger, bar * 0.62, 'triangle', level, output, 1150);
          this.tone(frequency * 1.004, at + 0.19 + stagger, bar * 0.6, 'triangle', level * 0.7, output, 980);
        });
      });

      for (let b = 0; b < chords.length; b += 1) {
        const barStart = start + b * bar;
        this.sweep(105, 44, barStart, 0.24, 'sine', 0.36, output);
        this.sweep(98, 42, barStart + beat * 2.5, 0.22, 'sine', 0.3, output);
        this.noise(barStart + beat, 0.12, 0.10, output, 2100);
        this.noise(barStart + beat * 3, 0.13, 0.11, output, 1900);
        for (let eighth = 0; eighth < 8; eighth += 1) {
          // Swung offbeats: the second eighth of each beat lands late.
          const swing = eighth % 2 === 0 ? 0 : 0.12;
          this.noise(barStart + (eighth / 2 + swing) * beat, 0.03, eighth % 2 === 0 ? 0.035 : 0.022, output, 7200);
        }
      }

      // Vinyl surface noise, irregular on purpose.
      for (let i = 0; i < 46; i += 1) {
        this.noise(start + Math.random() * bar * chords.length, 0.012, 0.012 + Math.random() * 0.012, output, 5200);
      }
      this.noise(start, bar * chords.length, 0.008, output, 900);
    } else {
      // Original 168 BPM battle cue: rapid monster-battle energy without
      // borrowing a melody or recording from an existing game.
      const beat = 60 / 168;
      const bass = [82.41, 82.41, 98, 110, 82.41, 123.47, 110, 98];
      bass.forEach((frequency, index) => {
        this.tone(frequency, start + index * beat, beat * 0.72, 'sawtooth', 0.14, output, 820);
      });
      const lead = [329.63, 392, 493.88, 587.33, 493.88, 659.25, 587.33, 493.88, 349.23, 440, 523.25, 698.46, 659.25, 523.25, 440, 392];
      lead.forEach((frequency, index) => {
        this.tone(frequency, start + index * beat / 2, beat * 0.38, index % 4 === 3 ? 'sawtooth' : 'square', 0.065, output, 2600);
      });
      const stabs = [[164.81, 196, 246.94], [146.83, 196, 220], [164.81, 207.65, 246.94], [146.83, 185, 220]];
      stabs.forEach((chord, index) => chord.forEach(frequency => {
        this.tone(frequency, start + index * beat * 2, beat * 0.7, 'triangle', 0.075, output, 1500);
      }));
      for (let i = 0; i < 16; i += 1) {
        const hit = start + i * beat / 2;
        if (i % 2 === 0) this.sweep(92, 45, hit, 0.13, 'sine', 0.3, output);
        if (i % 4 === 2) this.noise(hit, 0.13, 0.12, output, 1500);
        this.noise(hit + beat * 0.25, 0.028, 0.04, output, 5200);
      }
    }
  }

  static playSfx(kind: Sfx): void {
    this.unlock();
    const ctx = this.context;
    const output = this.sfxBus;
    if (!ctx || !output) return;
    const play = (): void => {
      const now = ctx.currentTime + 0.01;
      if (kind === 'stomp') {
        this.sweep(190, 46, now, 0.2, 'triangle', 0.48, output);
        this.noise(now, 0.12, 0.24, output, 1050);
      } else if (kind === 'hit') {
        this.sweep(340, 92, now, 0.12, 'square', 0.3, output);
        this.noise(now, 0.08, 0.2, output, 2200);
      } else if (kind === 'portal') {
        [196, 293.66, 440, 659.25].forEach((frequency, index) => this.tone(frequency, now + index * 0.08, 0.6, 'sine', 0.22, output, 2800));
        this.sweep(70, 420, now, 0.7, 'triangle', 0.2, output);
      } else if (kind === 'roar') {
        this.sweep(128, 38, now, 0.92, 'sawtooth', 0.55, output);
        this.sweep(86, 31, now + 0.05, 0.88, 'square', 0.25, output);
        this.noise(now, 0.78, 0.38, output, 760);
      } else {
        this.sweep(72, 390, now, 0.42, 'sawtooth', 0.4, output);
        this.noise(now + 0.1, 0.24, 0.22, output, 1900);
        this.sweep(120, 52, now + 0.32, 0.18, 'triangle', 0.36, output);
      }
    };
    if (ctx.state === 'running') play();
    else void ctx.resume().then(play);
  }

  private static tone(frequency: number, start: number, duration: number, type: OscillatorType, volume: number, output: AudioNode, cutoff: number): void {
    const ctx = this.context!;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(filter).connect(gain).connect(output);
    this.trackMusicVoice(oscillator, output);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  private static sweep(from: number, to: number, start: number, duration: number, type: OscillatorType, volume: number, output: AudioNode): void {
    const ctx = this.context!;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(output);
    this.trackMusicVoice(oscillator, output);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private static noise(start: number, duration: number, volume: number, output: AudioNode, cutoff: number): void {
    const ctx = this.context!;
    const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * duration)), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(output);
    this.trackMusicVoice(source, output);
    source.start(start);
  }

  private static trackMusicVoice(source: AudioScheduledSourceNode, output: AudioNode): void {
    if (output !== this.music) return;
    this.musicVoices.add(source);
    source.addEventListener('ended', () => this.musicVoices.delete(source), { once: true });
  }

  private static stopMusicVoices(): void {
    for (const source of this.musicVoices) {
      try { source.stop(); } catch { /* A voice may already have ended. */ }
    }
    this.musicVoices.clear();
  }
}
