// Instruments: a strip chart of the last keystroke and an energy ledger, read straight from the simulation.

import type { App } from '../app';
import type { Train } from '../sim/typeaction';
import { MARGIN, R_SEG } from '../sim/layout';
import { TRAIN } from '../sim/typeaction';
import { SPEC } from '../sim/mechanism';
import { h } from './dom';

const WINDOW = 0.2; // seconds of simulated time across the chart
const CAP = 4000;

interface Series { label: string; unit: string; color: string; max: number; get: (app: App, t: Train | null) => number; digits: number }

const SERIES: Series[] = [
  { label: 'Key depth', unit: 'mm', color: '#e8b84a', max: 15, digits: 1, get: (_a, t) => (t ? (t.geom.top[1] - t.lever.world(t.geom.top)[1]) * 1000 : 0) },
  { label: 'Typebar angle', unit: '°', color: '#e8793a', max: 105, digits: 0, get: (_a, t) => (t ? (t.bar.q * 180) / Math.PI : 0) },
  { label: 'Type speed', unit: 'm/s', color: '#f2efe6', max: 6, digits: 2, get: (_a, t) => (t ? Math.abs(t.bar.v) * R_SEG : 0) },
  { label: 'Universal bar', unit: 'mm', color: '#3aa6e8', max: 5.2, digits: 1, get: (a) => a.tw.core.ubar.q * 1000 },
  { label: 'Force on paper', unit: 'N', color: '#d8433f', max: 120, digits: 0, get: (_a, t) => (t ? Math.max(t.hit[0].force, t.hit[1].force) : 0) },
  { label: 'Carriage', unit: 'spaces', color: '#4fc47f', max: 1, digits: 2, get: (a) => a.tw.column - MARGIN.left },
];

export class Scope {
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private legend: HTMLElement[] = [];
  private energy: HTMLElement[] = [];
  private t = new Float64Array(CAP);
  private v = SERIES.map(() => new Float32Array(CAP));
  private head = 0;
  private count = 0;
  private train: Train | null = null;
  private lastT = -1;
  private fingerBase = 0;
  private peak = 0;

  constructor(private app: App) {
    this.canvas = h('canvas', { width: 520, height: 150, 'aria-label': 'Chart of the last keystroke' });
    const legend = h('div', { class: 'scope-legend' }, ...SERIES.map((s) => {
      const val = h('b', {}, '0');
      this.legend.push(val);
      return h('span', {}, h('i', { style: { background: s.color } }), `${s.label} `, val, ` ${s.unit}`);
    }));
    const row = (label: string, title: string) => { const b = h('b', {}, '0'); this.energy.push(b); return h('div', { title }, h('span', {}, label), b); };
    const energy = h('div', { class: 'energy' },
      row('Finger work, this stroke', 'Work done by your fingers since the last key went down'),
      row('Typebar energy, peak', 'Largest kinetic energy the typebar reached on its way to the paper'),
      row('Mainspring store', 'Energy still wound into the carriage spring; each letter space uses about 23 mJ'),
      row('Hand work, returns', 'Work done by the left hand on the return lever: this is what rewinds the spring'));
    this.el = h('section', { class: 'panel scope', 'aria-label': 'Instruments' }, h('h3', {}, 'Instruments'), this.canvas, legend, energy);
    this.el.hidden = true;
  }

  reset(): void { this.count = 0; this.head = 0; this.lastT = -1; this.peak = 0; }

  /** Call every frame. */
  sample(): void {
    const tw = this.app.tw;
    const moving = tw.movingTrains;
    if (moving.length && moving[moving.length - 1] !== this.train) { this.train = moving[moving.length - 1]; this.fingerBase = tw.fingerWork - (tw.fingers[tw.fingers.length - 1]?.work ?? 0); this.peak = 0; }
    if (this.train) this.peak = Math.max(this.peak, 0.5 * TRAIN.barInertia * this.train.bar.v * this.train.bar.v);
    if (tw.time === this.lastT) return;
    this.lastT = tw.time;
    this.t[this.head] = tw.time;
    for (let i = 0; i < SERIES.length; i++) this.v[i][this.head] = SERIES[i].get(this.app, this.train);
    this.head = (this.head + 1) % CAP;
    this.count = Math.min(CAP, this.count + 1);
  }

  /** Redraw (call at a modest rate, only while visible). */
  draw(): void {
    if (this.el.hidden) return;
    const tw = this.app.tw, g = this.canvas.getContext('2d')!;
    const W = this.canvas.width, H = this.canvas.height;
    g.clearRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,0.08)';
    g.lineWidth = 1;
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, (H * i) / 4); g.lineTo(W, (H * i) / 4); g.stroke(); }
    for (let ms = 0; ms <= WINDOW * 1000; ms += 50) { const x = W - (ms / (WINDOW * 1000)) * W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    const tEnd = tw.time;
    for (let s = 0; s < SERIES.length; s++) {
      const ser = SERIES[s], data = this.v[s];
      // The carriage trace is drawn relative to where it stood at the left edge of the window.
      let base = 0;
      if (ser.unit === 'spaces') { base = Infinity; for (let k = 0; k < this.count; k++) { const i = (this.head - 1 - k + CAP * 2) % CAP; if (tEnd - this.t[i] > WINDOW) break; base = Math.min(base, data[i]); } if (!Number.isFinite(base)) base = 0; }
      g.strokeStyle = ser.color;
      g.lineWidth = 1.6;
      g.beginPath();
      let started = false;
      for (let k = 0; k < this.count; k++) {
        const i = (this.head - 1 - k + CAP * 2) % CAP, age = tEnd - this.t[i];
        if (age > WINDOW) break;
        const x = W - (age / WINDOW) * W, y = H - 3 - Math.min(1, Math.max(0, (data[i] - base) / ser.max)) * (H - 6);
        if (started) g.lineTo(x, y); else { g.moveTo(x, y); started = true; }
      }
      g.stroke();
      const last = this.count ? data[(this.head - 1 + CAP) % CAP] : 0;
      this.legend[s].textContent = last.toFixed(ser.digits);
    }
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.font = '10px system-ui, sans-serif';
    g.fillText(`${(WINDOW * 1000).toFixed(0)} ms of machine time →`, 6, 12);
    const mJ = (j: number) => `${(j * 1000).toFixed(j < 0.1 ? 1 : 0)} mJ`;
    this.energy[0].textContent = mJ(tw.fingerWork - this.fingerBase);
    this.energy[1].textContent = mJ(this.peak);
    this.energy[2].textContent = `${mJ(tw.springEnergy)}  (${Math.round(tw.springEnergy / (SPEC.bandTension * 0.00254))} spaces)`;
    this.energy[3].textContent = mJ(tw.handWork);
  }
}
