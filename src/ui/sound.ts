// Sound synthesised from the physics: every click and clack is triggered by a contact in the simulation and
// scaled by how hard that contact was. No recordings.

import type { SimEvent } from '../sim/machine';

export class Sound {
  enabled = true;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastAt = new Map<string, number>();

  /** Must be called from a user gesture before anything can be heard. */
  unlock(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = 0.002; comp.release.value = 0.12;
    this.master = ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(comp).connect(ctx.destination);
    const n = (this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate));
    const d = n.getChannelData(0);
    let s = 22222;
    for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 1073741823.5) - 1; }
  }

  private burst(freq: number, q: number, dur: number, gain: number, rate: number, type: BiquadFilterType = 'bandpass', delay = 0): void {
    const ctx = this.ctx!, t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = rate;
    src.loopStart = Math.random() * 0.5; src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq * rate; f.Q.value = q;
    const g = ctx.createGain();
    const d = dur / rate;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.0008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t, Math.random() * 0.4);
    src.stop(t + d + 0.02);
  }

  private tone(freq: number, dur: number, gain: number, rate: number, type: OscillatorType = 'sine', delay = 0): void {
    const ctx = this.ctx!, t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq * rate;
    const g = ctx.createGain();
    const d = dur / rate;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + d + 0.02);
  }

  /** Play the sound of one simulation event. timeScale < 1 lowers pitch, like slowed tape. */
  play(e: SimEvent, timeScale: number): void {
    if (!this.enabled || !this.ctx || !this.master || this.ctx.state !== 'running') return;
    if (timeScale < 0.02) return;
    const rate = Math.max(0.35, Math.min(1, Math.pow(timeScale, 0.3)));
    const v = e.value ?? 0;
    // Chattering contacts would otherwise machine-gun the same sound.
    const gate = (key: string, ms: number): boolean => {
      const now = performance.now(), last = this.lastAt.get(key) ?? -1e9;
      if (now - last < ms) return false;
      this.lastAt.set(key, now);
      return true;
    };
    switch (e.type) {
      case 'impact': {
        const k = Math.min(1, v / 110);
        if (k < 0.03) return;
        this.burst(2600, 1.2, 0.035, 0.9 * k, rate);
        this.burst(900, 0.8, 0.06, 0.55 * k, rate, 'bandpass');
        this.tone(170, 0.07, 0.5 * k, rate);
        break;
      }
      case 'barRest': if (gate('rest' + e.id, 40)) { const k = Math.min(1, v / 40); this.burst(420, 0.7, 0.05, 0.35 * k, rate, 'lowpass'); this.tone(110, 0.05, 0.22 * k, rate); } break;
      case 'keyBottom': if (gate('kb' + e.id, 40)) this.burst(300, 0.7, 0.04, 0.22, rate, 'lowpass'); break;
      case 'pickup': if (gate('pk' + e.id, 30)) this.burst(5200, 3, 0.008, 0.1 * Math.min(1, v), rate); break;
      case 'trip': this.burst(4200, 4, 0.006, 0.16, rate); break;
      case 'step': if (gate('step', 12)) { const k = Math.min(1, 0.25 + v * 3); this.burst(1900, 2.5, 0.02, 0.42 * k, rate); this.tone(640, 0.03, 0.16 * k, rate, 'triangle'); } break;
      case 'ratchet': this.burst(3400, 5, 0.006, 0.2, rate); break;
      case 'lineClick': this.burst(1500, 3, 0.012, 0.3, rate); this.tone(380, 0.02, 0.1, rate, 'triangle'); break;
      case 'marginStop': if (gate('ms', 60)) { const k = Math.min(1, 0.3 + v * 2); this.burst(260, 0.7, 0.09, 0.7 * k, rate, 'lowpass'); this.tone(85, 0.12, 0.5 * k, rate); } break;
      case 'lineEnd': if (gate('le', 60)) this.burst(300, 0.7, 0.05, 0.35, rate, 'lowpass'); break;
      case 'shiftUp': case 'shiftDown': if (gate('sh', 50)) { const k = Math.min(1, 0.3 + v * 4); this.burst(240, 0.7, 0.07, 0.5 * k, rate, 'lowpass'); this.tone(95, 0.09, 0.3 * k, rate); } break;
      case 'locked': if (gate('lk', 120)) this.burst(200, 0.8, 0.05, 0.3, rate, 'lowpass'); break;
      case 'bell': if (gate('bell', 150)) {
        const k = Math.min(1, 0.25 + v / 40);
        // A small cup bell: a few inharmonic partials ringing down over a second.
        for (const [f, g, d] of [[2180, 0.34, 1.5], [5290, 0.2, 0.9], [9100, 0.1, 0.5], [3460, 0.08, 0.7]] as Array<[number, number, number]>) this.tone(f, d, g * k, rate);
        this.burst(6000, 2, 0.01, 0.2 * k, rate);
      } break;
    }
  }
}
