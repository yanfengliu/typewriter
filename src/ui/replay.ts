// Instant replay. While the machine runs, its full pose is recorded every quarter millisecond of simulated
// time into a ring buffer. Pausing lets you scrub back through the last seconds in any view: the model is
// posed from the recording, and ink struck after the scrub time is hidden.

import type { App } from '../app';

const SAMPLE = 0.00025;
const CAPACITY = 24000; // 6 s of motion
const MAX_FINGERS = 3;

export class Replay {
  private readonly n: number;
  private readonly stride: number;
  private readonly data: Float32Array;
  private readonly times: Float64Array;
  private head = 0;
  private count = 0;
  private lastT = -1;
  /** Live pose saved while the model is showing a recorded one. */
  private live: Float64Array | null = null;
  /** Index (0 = oldest) being shown, or -1 when live. */
  cursor = -1;
  /** Fingertip positions at the shown sample: [x, y, z] triples. */
  readonly fingers: number[] = [];
  handPush = 0;

  constructor(private app: App) {
    this.n = app.tw.sys.bodies.filter((b) => !b.name.startsWith('finger:')).length;
    this.stride = this.n + 1 + MAX_FINGERS * 3 + 1;
    this.data = new Float32Array(CAPACITY * this.stride);
    this.times = new Float64Array(CAPACITY);
  }

  get length(): number { return this.count; }
  get active(): boolean { return this.cursor >= 0; }
  get span(): number { return this.count < 2 ? 0 : this.timeAt(this.count - 1) - this.timeAt(0); }
  timeAt(i: number): number { return this.times[(this.head - this.count + i + CAPACITY * 2) % CAPACITY]; }

  /** Record the current pose if the machine is moving and enough simulated time has passed. */
  record(): void {
    const tw = this.app.tw;
    if (this.active || tw.idle || tw.time - this.lastT < SAMPLE) return;
    this.lastT = tw.time;
    const o = this.head * this.stride, d = this.data, b = tw.sys.bodies;
    for (let i = 0; i < this.n; i++) d[o + i] = b[i].q;
    const f = tw.fingers;
    d[o + this.n] = Math.min(f.length, MAX_FINGERS);
    for (let i = 0; i < MAX_FINGERS; i++) {
      const p = i < f.length ? f[i].body.world(f[i].contact.pa) : [0, 0, 0];
      d[o + this.n + 1 + i * 3] = p[0]; d[o + this.n + 2 + i * 3] = p[1]; d[o + this.n + 3 + i * 3] = p[2];
    }
    d[o + this.stride - 1] = tw.hand.push;
    this.times[this.head] = tw.time;
    this.head = (this.head + 1) % CAPACITY;
    this.count = Math.min(CAPACITY, this.count + 1);
  }

  /** Forget the recording (after a restore or a new sheet the past no longer matches). */
  reset(): void { this.exit(); this.count = 0; this.head = 0; this.lastT = -1; }

  /** Show recorded sample i (0 = oldest .. length-1 = newest). */
  show(i: number): void {
    if (this.count === 0) return;
    const tw = this.app.tw, b = tw.sys.bodies;
    if (!this.live) { this.live = new Float64Array(this.n); for (let k = 0; k < this.n; k++) this.live[k] = b[k].q; }
    this.cursor = Math.max(0, Math.min(this.count - 1, Math.round(i)));
    const slot = (this.head - this.count + this.cursor + CAPACITY * 2) % CAPACITY, o = slot * this.stride, d = this.data;
    for (let k = 0; k < this.n; k++) b[k].q = d[o + k];
    this.fingers.length = 0;
    const nf = d[o + this.n];
    for (let k = 0; k < nf * 3; k++) this.fingers.push(d[o + this.n + 1 + k]);
    this.handPush = d[o + this.stride - 1];
    this.app.paper.visibleUntil = this.times[slot];
  }

  /** Return to the live present. */
  exit(): void {
    if (!this.live) { this.cursor = -1; return; }
    const b = this.app.tw.sys.bodies;
    for (let k = 0; k < this.n; k++) b[k].q = this.live[k];
    this.live = null;
    this.cursor = -1;
    this.fingers.length = 0;
    this.app.paper.visibleUntil = Infinity;
  }
}
