type Track = 'ambient' | 'boss';
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

  static unlock(): void {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.music = this.context.createGain();
      this.sfxBus = this.context.createGain();
      this.master.gain.value = 0.72;
      this.music.gain.value = 0.22;
      this.sfxBus.gain.value = 0.5;
      this.music.connect(this.master);
      this.sfxBus.connect(this.master);
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') void this.context.resume();
  }

  static startAmbient(): void { this.startTrack('ambient'); }
  static startBoss(): void { this.startTrack('boss'); }

  private static startTrack(track: Track): void {
    this.unlock();
    if (!this.context || !this.music || this.track === track) return;
    this.track = track;
    if (this.timer !== undefined) window.clearInterval(this.timer);
    this.music.gain.cancelScheduledValues(this.context.currentTime);
    this.music.gain.setTargetAtTime(track === 'boss' ? 0.3 : 0.22, this.context.currentTime, 0.25);
    this.playPhrase(track);
    this.timer = window.setInterval(() => this.playPhrase(track), track === 'boss' ? 3200 : 6400);
  }

  private static playPhrase(track: Track): void {
    const ctx = this.context;
    const output = this.music;
    if (!ctx || !output) return;
    const start = ctx.currentTime + 0.04;
    if (track === 'ambient') {
      const chords = [[110, 130.81, 164.81], [98, 123.47, 146.83], [87.31, 110, 130.81], [98, 123.47, 164.81]];
      chords.forEach((chord, index) => chord.forEach((frequency, voice) => {
        this.tone(frequency, start + index * 1.6, 1.55, voice === 0 ? 'sine' : 'triangle', 0.045, output, 900);
      }));
      [329.63, 392, 440, 392, 293.66, 329.63, 246.94, 293.66].forEach((frequency, index) => {
        this.tone(frequency, start + index * 0.8, 0.22, 'sine', 0.035, output, 1500);
      });
      for (let i = 0; i < 13; i += 1) this.noise(start + i * 0.48, 0.035, 0.008, output, 2600);
    } else {
      const bass = [82.41, 82.41, 98, 110];
      bass.forEach((frequency, index) => this.tone(frequency, start + index * 0.8, 0.58, 'sawtooth', 0.055, output, 620));
      const arp = [329.63, 392, 493.88, 587.33, 493.88, 392, 349.23, 440, 523.25, 659.25, 523.25, 440, 392, 493.88, 587.33, 698.46];
      arp.forEach((frequency, index) => this.tone(frequency, start + index * 0.2, 0.14, 'square', 0.026, output, 1800));
      for (let i = 0; i < 7; i += 1) {
        this.tone(58, start + i * 0.48, 0.09, 'sine', 0.13, output, 500);
        this.noise(start + i * 0.48 + 0.24, 0.05, 0.025, output, 3200);
      }
    }
  }

  static playSfx(kind: Sfx): void {
    this.unlock();
    const ctx = this.context;
    const output = this.sfxBus;
    if (!ctx || !output) return;
    const now = ctx.currentTime;
    if (kind === 'stomp') {
      this.sweep(150, 58, now, 0.16, 'triangle', 0.24, output);
      this.noise(now, 0.09, 0.12, output, 900);
    } else if (kind === 'hit') {
      this.sweep(260, 105, now, 0.09, 'square', 0.12, output);
      this.noise(now, 0.055, 0.08, output, 1800);
    } else if (kind === 'portal') {
      [196, 293.66, 440, 659.25].forEach((frequency, index) => this.tone(frequency, now + index * 0.08, 0.5, 'sine', 0.11, output, 2400));
    } else if (kind === 'roar') {
      this.sweep(105, 42, now, 0.75, 'sawtooth', 0.28, output);
      this.noise(now, 0.62, 0.16, output, 620);
    } else {
      this.sweep(90, 310, now, 0.34, 'sawtooth', 0.16, output);
      this.noise(now + 0.12, 0.18, 0.09, output, 1500);
    }
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
    source.start(start);
  }
}
