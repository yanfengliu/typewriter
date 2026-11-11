// The typist's side of the machine: fingers that strike or hold keys, and the left hand that works the
// carriage-return lever. They are physical bodies and forces, so the keys only move because they are pushed.

import { Body, System } from './solver';
import { AppliedForce, FnForce, PointPlane } from './elements';
import type { Core } from './mechanism';
import type { Vec3 } from './vec';

export const FINGER = {
  mass: 0.02,
  /** Fingertip pad stiffness and damping. */
  padK: 3e4,
  padC: 10,
  hover: 0.001,
  liftK: 800,
  liftC: 6,
  rise: 0.002,
  /** A guided (slow) finger does not push harder than this (N), whatever depth it is asked for. */
  maxPush: 10,
};

export type FingerPhase = 'press' | 'hold' | 'lift' | 'done';

export interface FingerOptions {
  /** Peak push of the strike (N). */
  force: number;
  /** Keep pressing until release() instead of letting go at the strike. */
  hold?: boolean;
  /** Called every substep while pressing; return true once the stroke has "landed" (e.g. type hit the platen). */
  landed?: () => boolean;
  /** Drive the fingertip position directly (slow, guided presses). Value = target depth in metres. */
  servo?: () => number;
}

export class Finger {
  readonly body: Body;
  readonly contact: PointPlane;
  private readonly drive: FnForce;
  phase: FingerPhase = 'press';
  released = false;
  /** Work done by the finger's muscles (J). */
  work = 0;
  /** Current muscle force (N, positive pushes the key down). */
  push = 0;
  t0: number;
  tLift = 0;

  constructor(private sys: System, readonly id: string, readonly target: Body, readonly top: Vec3, readonly opts: FingerOptions) {
    this.body = sys.addBody({ name: `finger:${id}`, kind: 'slide', axis: [0, -1, 0], inertia: FINGER.mass });
    const tip: Vec3 = [top[0], top[1] + FINGER.hover, top[2]];
    // The keytop must stay below the fingertip: point = fingertip, plane = keytop (normal up).
    this.contact = new PointPlane(this.body, tip, target, top, [0, 1, 0]);
    this.contact.stiffness = FINGER.padK;
    this.contact.dampingCoef = FINGER.padC;
    sys.add(this.contact, `fingerPad:${id}`);
    this.drive = sys.addForce(new FnForce(() => { this.body.f += this.push; }), `fingerDrive:${id}`);
    this.t0 = sys.time;
    if (opts.servo) this.body.kinematic = true;
  }

  /** Depth the fingertip has travelled below its hover position (m). */
  get depth(): number { return this.body.q; }
  /** Force between fingertip and key (N). */
  get padForce(): number { return this.contact.force; }

  release(): void { this.released = true; }

  /** Advance the finger's control program by one substep. */
  update(): void {
    const sys = this.sys, b = this.body, t = sys.time - this.t0;
    if (this.opts.servo && this.phase !== 'lift' && this.phase !== 'done') {
      // Guided press: follow the requested depth with a bounded, smooth approach.
      const target = this.released ? -FINGER.rise : this.opts.servo();
      b.v = Math.max(-0.25, Math.min(0.25, (target - b.q) / 0.02));
      if (b.v > 0 && this.contact.force > FINGER.maxPush) b.v = 0;
      this.work += this.contact.force * b.v * sys.h;
      if (this.released && b.q <= -FINGER.rise * 0.9) this.finish();
      return;
    }
    if (this.phase === 'press') {
      this.push = this.opts.force * Math.min(1, t / 0.002);
      const landed = (this.opts.landed?.() ?? false) || t > 0.25;
      if (landed) {
        if (this.opts.hold && !this.released) this.phase = 'hold';
        else this.startLift();
      }
    } else if (this.phase === 'hold') {
      if (this.released) this.startLift();
    } else if (this.phase === 'lift') {
      this.push = -FINGER.liftK * (b.q + FINGER.rise * 2) - FINGER.liftC * b.v;
      if (b.q < -FINGER.rise || sys.time - this.tLift > 0.08) this.finish();
    }
    if (this.phase === 'press' || this.phase === 'hold') this.work += this.push * b.v * sys.h;
  }

  private startLift(): void { this.phase = 'lift'; this.tLift = this.sys.time; }

  private finish(): void {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.sys.remove(this.contact);
    this.sys.removeForce(this.drive);
    this.sys.removeBody(this.body);
  }

  /** Remove immediately (used when restoring a snapshot). */
  dispose(): void { this.finish(); }
}

export type HandPhase = 'idle' | 'lever' | 'push' | 'release';

/** The left hand on the carriage-return lever: first it swings the lever (line feed), then shoves the carriage home. */
export class ReturnHand {
  readonly force: AppliedForce;
  phase: HandPhase = 'idle';
  /** Current push along +X (N). */
  push = 0;
  t0 = 0;
  speed = 0.9;
  maxForce = 16;

  constructor(private sys: System, private core: Core) {
    this.force = sys.addForce(new AppliedForce(core.lineLever, core.points.leverHandle), 'returnHand');
  }

  get busy(): boolean { return this.phase !== 'idle'; }
  get work(): number { return this.force.work; }

  start(): void {
    if (this.phase !== 'idle') return;
    this.phase = 'lever';
    this.t0 = this.sys.time;
  }

  /** Returns true on the substep the return completes. */
  update(): boolean {
    const { core, sys } = this;
    const t = sys.time - this.t0;
    let done = false;
    if (this.phase === 'lever') {
      // Swing the lever at a steady, unhurried rate: this is the stroke that feeds the paper one line.
      this.push = Math.max(0.2, Math.min(5, 0.5 + 0.6 * (5 - core.lineLever.v)));
      if (core.lineLever.q > core.limits.leverMax() - 0.012 || t > 0.4) { this.phase = 'push'; this.t0 = sys.time; }
    } else if (this.phase === 'push') {
      // Speed control: the hand accelerates the carriage to a brisk pace and holds it there.
      // Ease off before the margin stop: the mainspring alone brakes the carriage at about 6 m/s².
      const remaining = Math.max(0, core.carriage.q - core.limits.cLeft);
      const want = Math.min(this.speed * Math.min(1, t / 0.06 + 0.15), Math.sqrt(12 * remaining) + 0.1);
      const back = -core.carriage.v;
      this.push = Math.max(1.5, Math.min(this.maxForce, 2.5 + 60 * (want - back)));
      if (core.carriage.q <= core.limits.cLeft + 2e-4 || core.marginLeft.active || t > 1.5) { this.phase = 'release'; this.t0 = sys.time; }
    } else if (this.phase === 'release') {
      this.push = Math.max(0, 2.5 * (1 - t / 0.03));
      if (t > 0.03) { this.phase = 'idle'; this.push = 0; done = true; }
    } else this.push = 0;
    this.force.set([this.push, 0, 0]);
    return done;
  }
}
