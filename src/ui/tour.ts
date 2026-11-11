// Guided tour engine. Every step replays the real simulation from a clean machine: the action is fast-forwarded
// (unseen) to where the step begins, then played in slow motion until the moment the step is about.
// Nothing shown is an animation; rewinding a step simply runs the same physics again.

import type { App } from '../app';
import type { Mark, Snapshot } from '../sim/machine';
import type { ShellMode } from '../view/modes';
import type { Sys } from '../view/rig';
import { clear, h } from './dom';
import type { Shot } from './camera';

export interface StepView {
  shot: string | Shot;
  shell?: ShellMode;
  focus?: Sys[] | null;
  explode?: number;
  color?: boolean;
  /** Show only this key's train out of the 44. */
  solo?: string | null;
  highlight?: string[];
  labels?: string[];
  slice?: number | null;
  /** Left face of the slab when slicing (see ViewModes.sliceBack). */
  sliceBack?: number | null;
  /** Draw the force arrows. */
  forces?: boolean;
}

export interface TourCtl {
  app: App;
  /** Run the simulation unseen until the condition holds (to set the scene). */
  skipTo(cond: () => boolean, maxSeconds?: number): void;
  /** Play at the step's speed until the condition holds, then pause. */
  playTo(cond: () => boolean, maxSeconds?: number): Promise<void>;
  /** Play until an event of this type has occurred since the step began. */
  playToEvent(type: string, maxSeconds?: number): Promise<void>;
  seen(type: string): boolean;
  speed(scale: number): void;
}

export interface TourStep {
  chapter: string;
  title: string;
  body: string;
  view: StepView;
  /** Simulated seconds per real second while the action plays. */
  speed?: number;
  run?: (c: TourCtl) => Promise<void>;
  /** Live numbers shown under the text. */
  readouts?: Array<[string, (app: App) => string]>;
  /** Let the user type during this step. */
  free?: boolean;
}

export interface TourHost {
  applyView(v: StepView, seconds: number): void;
  setSpeed(scale: number): void;
  setPaused(p: boolean): void;
  onTourChange(): void;
}

export class Tour {
  active = false;
  index = 0;
  running = false;
  readonly panel: HTMLElement;
  private token = 0;
  private pristine: Snapshot;
  private seenEvents = new Set<string>();
  private readoutEls: Array<[HTMLElement, (app: App) => string]> = [];
  /** The user's own machine and page, put back when the tour ends. */
  private own: { state: Snapshot; marks: Mark[] } | null = null;

  constructor(private app: App, private host: TourHost, readonly steps: TourStep[]) {
    this.pristine = app.tw.snapshot();
    this.panel = h('section', { class: 'panel tour', 'aria-label': 'Guided tour' });
    this.panel.hidden = true;
  }

  get step(): TourStep { return this.steps[this.index]; }
  get typingAllowed(): boolean { return !this.active || !!this.step.free; }

  start(index = 0): void {
    this.active = true;
    this.panel.hidden = false;
    this.go(index);
  }

  /** Before the tour takes the machine over: let anything in flight finish, then set the user's machine and page aside. */
  private setAside(): void {
    if (this.own) return;
    const tw = this.app.tw;
    this.app.typist.clear();
    for (const f of tw.fingers) f.release();
    for (let i = 0; i < 400 && !tw.idle; i++) tw.advance(0.005);
    this.own = { state: tw.snapshot(), marks: tw.marks.slice() };
  }

  /** Give the user their own machine and page back (when the tour ends, or reaches a step where they type). */
  private giveBack(): void {
    this.app.typist.clear();
    if (!this.own) return;
    this.app.tw.restore(this.own.state);
    this.app.tw.marks = this.own.marks;
    this.own = null;
    this.app.resetHistory();
  }

  stop(): void {
    this.token++;
    this.active = false;
    this.running = false;
    this.panel.hidden = true;
    this.app.stopWhen = null;
    this.host.setPaused(false);
    this.host.setSpeed(1);
    // Hand the machine back whole, however deep in a close-up the tour was left.
    this.giveBack();
    this.host.applyView({ shot: 'typist', shell: 'glass' }, 1.0);
    this.host.onTourChange();
  }

  next(): void { if (this.index < this.steps.length - 1) this.go(this.index + 1); }
  prev(): void { if (this.index > 0) this.go(this.index - 1); }
  again(): void { this.go(this.index); }

  /** Feed simulation events to the tour so steps can wait for them. */
  observe(type: string): void { if (this.running) this.seenEvents.add(type); }

  private reset(): void {
    const { app } = this;
    app.typist.clear();
    app.tw.restore(this.pristine);
    app.resetHistory();
    this.seenEvents.clear();
  }

  go(i: number): void {
    const my = ++this.token;
    this.index = Math.max(0, Math.min(this.steps.length - 1, i));
    const step = this.step, app = this.app;
    app.stopWhen = null;
    this.host.setPaused(false);
    if (step.free) this.giveBack();
    else { this.setAside(); this.reset(); }
    this.host.applyView(step.view, 1.2);
    this.render();
    this.host.onTourChange();
    if (!step.run) { this.running = false; this.host.setSpeed(1); return; }
    this.running = true;
    this.host.setSpeed(step.speed ?? 0.05);
    const alive = () => my === this.token;
    const ctl: TourCtl = {
      app,
      skipTo: (cond, max = 1) => {
        const t0 = app.tw.time;
        while (!cond() && app.tw.time - t0 < max) { app.tw.advance(0.0001); for (const e of app.tw.events) this.seenEvents.add(e.type); app.tw.events = []; }
        app.resetHistory();
      },
      playTo: (cond, max = 1.5) => new Promise<void>((resolve) => {
        const t0 = app.tw.time;
        this.host.setPaused(false);
        app.stopWhen = () => {
          if (!alive()) return true;
          if (!cond() && app.tw.time - t0 < max) return false;
          app.stopWhen = null;
          this.host.setPaused(true);
          resolve();
          return true;
        };
      }),
      playToEvent: (type, max) => ctl.playTo(() => this.seenEvents.has(type), max),
      seen: (type) => this.seenEvents.has(type),
      speed: (s) => this.host.setSpeed(s),
    };
    // Give the camera a moment to arrive before anything moves.
    this.host.setPaused(true);
    window.setTimeout(() => {
      if (!alive()) return;
      this.host.setPaused(false);
      void step.run!(ctl).then(() => { if (alive()) { this.running = false; this.render(); this.host.onTourChange(); } });
    }, 900);
  }

  /** Refresh the live numbers (call a few times a second). */
  refresh(): void { for (const [el, fn] of this.readoutEls) el.textContent = fn(this.app); }

  private render(): void {
    const s = this.step, p = this.panel;
    clear(p);
    this.readoutEls = [];
    const chapters = [...new Set(this.steps.map((x) => x.chapter))];
    p.append(
      h('header', {}, h('span', { class: 'eyebrow' }, `${s.chapter} · step ${this.index + 1} of ${this.steps.length}`), h('button', { class: 'icon', title: 'Leave the tour', 'aria-label': 'Leave the tour', onclick: () => this.stop() }, '×')),
      h('div', { class: 'dots' }, ...chapters.map((c) => h('button', {
        class: 'dot' + (c === s.chapter ? ' on' : ''), title: c, 'aria-label': `Go to chapter: ${c}`,
        onclick: () => this.go(this.steps.findIndex((x) => x.chapter === c)),
      }, c))),
      h('h2', {}, s.title),
      h('div', { class: 'body', html: s.body }),
    );
    if (s.readouts) {
      const list = h('dl', { class: 'readouts' });
      for (const [label, fn] of s.readouts) {
        const dd = h('dd', {}, fn(this.app));
        this.readoutEls.push([dd, fn]);
        list.append(h('dt', {}, label), dd);
      }
      p.append(list);
    }
    p.append(h('footer', {},
      h('button', { class: 'btn', disabled: this.index === 0, onclick: () => this.prev() }, '← Back'),
      s.run ? h('button', { class: 'btn', onclick: () => this.again(), title: 'Run this step again from the start' }, '↻ Again') : null,
      this.index < this.steps.length - 1
        ? h('button', { class: 'btn primary', onclick: () => this.next() }, 'Next →')
        : h('button', { class: 'btn primary', onclick: () => this.stop() }, 'Start typing'),
    ));
  }
}
