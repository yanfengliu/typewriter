// The typist: turns a stream of requested characters into finger strikes the mechanism can actually take.
// Nothing typed is ever dropped. Each request waits in order until the machine is physically ready for it:
// the previous typebar has cleared the printing point, the escapement has let go, Shift has settled, and
// the carriage is not being returned. This is the rhythm a trained typist keeps to avoid clashing typebars.

import { GLYPH_PITCH, TRAVEL } from './layout';
import type { Typewriter } from './machine';
import type { Train } from './typeaction';

export type Stroke =
  | { kind: 'char'; code: string; shift: boolean; force?: number }
  | { kind: 'space' }
  | { kind: 'backspace' }
  | { kind: 'return' };

const DEG = Math.PI / 180;

export class Typist {
  readonly queue: Stroke[] = [];
  /** Random variation of strike force between keystrokes (fraction), like a human hand. */
  unevenness = 0.08;
  /** Force used on the Shift key (it lifts the whole carriage). */
  shiftForce = 5.5;
  /** Return the carriage automatically when the line is full (off = authentic: the keys lock until you return). */
  autoReturn = false;
  /** True while the end-of-line lock is holding typed characters back. */
  lineLocked = false;
  /** Called when the state the UI shows (pending count, line lock) changes. */
  onChange: (() => void) | null = null;
  private holdingShift = false;
  /** The train most recently struck, until its type has hit the paper. */
  private flying: Train | null = null;
  private flyingSince = 0;
  private reachedPlaten = false;
  private returning = false;
  private seed = 12345;

  constructor(private tw: Typewriter) {
    tw.schedule = () => this.update();
  }

  get pending(): number { return this.queue.length; }

  enqueue(s: Stroke): void { this.queue.push(s); this.onChange?.(); }
  clear(): void { this.queue.length = 0; this.setLocked(false); this.onChange?.(); }

  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  private setLocked(v: boolean): void { if (v !== this.lineLocked) { this.lineLocked = v; this.onChange?.(); } }

  /** Has every moving typebar fallen back far enough to let another one through to the printing point? */
  private basketClear(except: Train | null): boolean {
    for (const t of this.tw.movingTrains) {
      if (t === except) continue;
      if (t.bar.q > TRAVEL - 38 * DEG || (t.bar.v > 1 && t.bar.q > 4 * DEG)) return false;
    }
    return true;
  }

  private shiftSettled(up: boolean): boolean {
    const c = this.tw.core;
    return Math.abs(c.cradle.v) < 0.004 && (up ? c.cradle.q > GLYPH_PITCH - 6e-5 : c.cradle.q < 6e-5);
  }

  private update(): void {
    const tw = this.tw, c = tw.core;
    // One type at a time on its way to the paper: the next strike waits until this one has printed and fallen back.
    if (this.flying) {
      const bar = this.flying.bar;
      if (bar.q > TRAVEL - 10 * DEG) this.reachedPlaten = true;
      const fellBack = this.reachedPlaten && bar.v < 0 && bar.q < TRAVEL - 25 * DEG;
      if (fellBack || tw.time - this.flyingSince > 0.35 || !this.flying.awake) this.flying = null;
    }
    if (this.returning) {
      // Wait for the carriage to settle on the dog and the platen to click into its new line.
      if (tw.hand.busy || Math.abs(c.carriage.v) > 2e-3 || !c.state.looseIn || c.lineLever.q > 0.02 || Math.abs(c.platen.v) > 0.05 || Math.abs(Math.sin(24 * c.platen.q)) > 0.15) return;
      this.returning = false;
    }
    let s = this.queue[0];
    // At the right margin the keys lock. A carriage return waiting further back in the queue is what frees them,
    // so it is taken first; the characters typed before it then print on the new line, still in order.
    if (s && s.kind !== 'return' && s.kind !== 'backspace' && tw.atLineEnd && !this.returning) {
      const i = this.queue.findIndex((q) => q.kind === 'return');
      if (i > 0) this.queue.unshift(...this.queue.splice(i, 1));
      else if (this.autoReturn) this.queue.unshift({ kind: 'return' });
      s = this.queue[0];
    }
    if (!s) {
      if (this.holdingShift && !this.flying) { tw.keyUp('ShiftLeft'); this.holdingShift = false; }
      this.setLocked(false);
      return;
    }
    if (tw.hand.busy) return;

    if (s.kind === 'char') {
      const t = tw.byCode.get(s.code);
      if (!t) { this.done(); return; }
      if (tw.atLineEnd) { this.setLocked(true); return; }
      this.setLocked(false);
      // Shift may only move while no type is on its way to the paper.
      const locked = c.state.shiftLocked;
      if (!locked && s.shift !== this.holdingShift) {
        if (this.flying) return;
        if (s.shift) tw.keyDown('ShiftLeft', { hold: true, force: this.shiftForce }); else tw.keyUp('ShiftLeft');
        this.holdingShift = s.shift;
        return;
      }
      if (this.flying || !this.shiftSettled(locked || s.shift)) return;
      if (c.groups.back.awake && (c.backspace.q > 0.002 || Math.abs(c.carriage.v) > 2e-3)) return;
      if (t.fingers > 0 || t.bar.q > 8 * DEG || Math.abs(t.bar.v) > 3) return;
      if (!this.basketClear(t)) return;
      if (c.rocker.q > 0.012 || tw.isDown('Space') || tw.isDown('Backspace')) return;
      const force = (s.force ?? tw.touch) * (1 + this.unevenness * (2 * this.random() - 1));
      if (tw.keyDown(s.code, { force })) { this.flying = t; this.flyingSince = tw.time; this.reachedPlaten = false; this.done(); }
      return;
    }

    if (s.kind === 'space') {
      if (tw.atLineEnd) { this.setLocked(true); return; }
      this.setLocked(false);
      if (this.flying || !this.basketClear(null) || c.rocker.q > 0.012 || c.space.q > 0.004 || tw.isDown('Space') || tw.isDown('Backspace')) return;
      if (tw.keyDown('Space', { force: 2.2 })) this.done();
      return;
    }

    // Backspace and carriage return wait for the type action to come fully to rest.
    if (this.flying || tw.movingTrains.length || tw.fingers.some((f) => !f.id.startsWith('Shift'))) return;
    if (Math.abs(c.carriage.v) > 2e-3 || !c.state.looseIn || c.rocker.q > 0.012) return;
    if (s.kind === 'backspace') {
      if (c.backspace.q > 0.003) return;
      if (tw.keyDown('Backspace', { force: 4.5 })) this.done();
    } else {
      this.setLocked(false);
      tw.returnCarriage();
      this.returning = true;
      this.done();
    }
  }

  private done(): void { this.queue.shift(); this.onChange?.(); }
}
