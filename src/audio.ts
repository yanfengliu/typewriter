/** Procedural mechanical sound: no audio assets or network requests. */
export class TypewriterAudio {
  enabled = true;
  private context?: AudioContext;
  private noise?: AudioBuffer;

  async unlock(): Promise<void> {
    if (!this.enabled) return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') await this.context.resume();
      if (!this.noise) {
        this.noise = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
        const values = this.noise.getChannelData(0);
        for (let i = 0; i < values.length; i++) values[i] = Math.random() * 2 - 1;
      }
    } catch { /* Browsers may block audio. Writing remains available. */ }
  }

  play(kind: 'strike' | 'space' | 'return' | 'bell' | 'jam', energy = .02): void {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const time = this.context.currentTime;
    if (kind === 'bell') {
      this.tone(1690, .75, .08, time); this.tone(2750, .43, .025, time); return;
    }
    if (kind === 'return') {
      for (let i = 0; i < 11; i++) this.click(.018, .035, 700 + i * 80, time + i * .023);
      this.click(.08, .15, 480, time + .28); return;
    }
    if (kind === 'jam') { this.click(.09, .08, 390, time); return; }
    if (kind === 'space') { this.click(.025, .07, 640, time); this.tone(180, .04, .025, time); return; }
    const level = Math.min(.17, .06 + Math.sqrt(Math.max(0, energy)) * .45);
    this.click(.027, level, 1800, time);
    this.tone(310, .04, level * .35, time);
    this.click(.022, level * .4, 1000, time + .038);
  }

  private tone(frequency: number, duration: number, volume: number, time: number): void {
    const ctx = this.context!;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(gain); gain.connect(ctx.destination);
    oscillator.start(time); oscillator.stop(time + duration);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }

  private click(duration: number, volume: number, frequency: number, time: number): void {
    if (!this.noise) return;
    const ctx = this.context!, source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = this.noise; filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = .65;
    gain.gain.setValueAtTime(volume, time); gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    source.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    source.start(time, Math.random() * .5, duration);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }

  dispose(): void { void this.context?.close(); }
}
