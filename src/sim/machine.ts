// The complete typewriter as one physical system, plus the bookkeeping that turns contacts into ink.

import { Body, Constraint, System } from './solver';
import { CHAR_PITCH, ESC, F, KeyGeom, P0, PAPER, PLATEN_AXIS, PLATEN_R, RIBBON, R_SEG, TOOTH_PITCH, U, buildKeys } from './layout';
import { Core, CoreState, Group, GroupName, buildCore, coreLogic, SPEC } from './mechanism';
import { Train, buildTrain, setTrainAwake, trainAtRest } from './typeaction';
import { Finger, FingerOptions, FingerPhase, ReturnHand, HandPhase } from './actuators';
import type { Vec3 } from './vec';

export interface Mark {
  seq: number;
  /** Simulation time of the impact. */
  t: number;
  ch: string;
  key: string;
  /** Position on the sheet (m): u from the left edge, v from the top edge. */
  u: number;
  v: number;
  /** 0..1 darkness of the impression. */
  ink: number;
  /** Peak force of the type face on the paper (N) and its speed on arrival (m/s). */
  force: number;
  speed: number;
  /** Fraction of the character covered by ribbon at impact. */
  cover: number;
}

export interface SimEvent { t: number; type: string; id?: string; value?: number; mark?: Mark }

export interface FingerSpec { id: string; force: number; hold: boolean; servo: boolean }

export interface Snapshot {
  time: number; steps: number;
  q: Float64Array; v: Float64Array;
  awake: boolean[];
  core: CoreState;
  marks: number; seq: number;
  fingers: Array<{ spec: FingerSpec; phase: FingerPhase; released: boolean; q: number; v: number; work: number; push: number; t0: number; tLift: number; depth: number }>;
  hand: { phase: HandPhase; push: number; t0: number; work: number };
  fingerWork: number;
  detent: number;
}

interface Watcher { c: Constraint; was: boolean; fire: () => void }

const GLYPH_HALF = 0.0017;
/** Peak force (N) at which a character prints at about 63% of full darkness. */
export const INK_FORCE = 45;
const GROUP_ORDER: GroupName[] = ['space', 'back', 'shift', 'feed', 'bell', 'esc'];

export class Typewriter {
  readonly sys = new System();
  readonly keys: KeyGeom[] = buildKeys();
  readonly core: Core;
  readonly trains: Train[] = [];
  readonly byCode = new Map<string, Train>();
  readonly hand: ReturnHand;
  fingers: Finger[] = [];
  private fingerSpecs = new Map<Finger, FingerSpec>();
  /** Guided-press depth targets (m), keyed by finger id. */
  readonly servoDepth = new Map<string, number>();
  events: SimEvent[] = [];
  marks: Mark[] = [];
  private seq = 0;
  /** Default strike force of a finger (N): the typist's "touch". */
  touch = 3.2;
  private fingerWorkDone = 0;
  private readonly permanent: number;
  private coreWatch: Watcher[] = [];
  private trainWatch = new Map<Train, Watcher[]>();
  private awakeTrains: Train[] = [];
  private heldByLoose = true;
  private detentIndex = 0;
  /** Hook for the typist scheduler, called every 10 substeps (and once per advance while everything rests). */
  schedule: (() => void) | null = null;

  constructor() {
    const sys = this.sys;
    this.core = buildCore(sys);
    for (const k of this.keys) {
      const t = buildTrain(sys, k, this.core.cradle, this.core.ubar);
      this.trains.push(t);
      this.byCode.set(k.code, t);
    }
    this.hand = new ReturnHand(sys, this.core);
    this.permanent = sys.bodies.length;
    sys.preStep.push(() => this.pre());
    sys.postStep.push(() => this.post());

    const c = this.core;
    const w = (list: Watcher[], con: Constraint, fire: () => void) => list.push({ c: con, was: true, fire });
    w(this.coreWatch, c.bellStop, () => this.emit('bell', undefined, Math.abs(c.bellStop.vnPre)));
    w(this.coreWatch, c.marginLeft, () => this.emit('marginStop', undefined, Math.abs(c.marginLeft.vnPre)));
    w(this.coreWatch, c.marginRight, () => this.emit('lineEnd', undefined, Math.abs(c.marginRight.vnPre)));
    w(this.coreWatch, c.cradleUp, () => { if (c.cradleUp.vnPre < -0.03) this.emit('shiftUp', undefined, -c.cradleUp.vnPre); });
    w(this.coreWatch, c.cradleDown, () => { if (c.cradleDown.vnPre < -0.03) this.emit('shiftDown', undefined, -c.cradleDown.vnPre); });
    for (const t of this.trains) {
      const list: Watcher[] = [];
      w(list, t.ubar, () => { if (t.bar.v > 1 && t.ubar.vnPre < -0.2) this.emit('pickup', t.geom.code, -t.ubar.vnPre); });
      w(list, t.pad, () => { if (t.bar.v < -2) this.emit('barRest', t.geom.code, -t.bar.v); });
      w(list, t.stop, () => this.emit('keyBottom', t.geom.code, t.lever.v));
      this.trainWatch.set(t, list);
    }
  }

  private emit(type: string, id?: string, value?: number, mark?: Mark): void { this.events.push({ t: this.sys.time, type, id, value, mark }); }

  get time(): number { return this.sys.time; }
  /** Current print column (0 = left edge of the sheet). */
  get column(): number { return this.core.carriage.q / CHAR_PITCH; }
  /** Lines fed since the sheet was loaded. */
  get line(): number { return (this.core.platen.q * SPEC.lineTeeth) / (2 * Math.PI); }
  /** The escapement has no letter space left before the right margin stop: the line lock holds the keys. */
  get atLineEnd(): boolean {
    const st = this.core.state;
    return (st.toothLoose - st.ratchet) * CHAR_PITCH >= this.core.limits.cRight - 1e-9 || this.core.carriage.q >= this.core.limits.cRight - 1e-4;
  }
  /** Nothing is moving and nobody is touching the machine. */
  get idle(): boolean {
    if (this.awakeTrains.length || this.fingers.length || this.hand.busy) return false;
    const g = this.core.groups;
    return !(g.esc.awake || g.shift.awake || g.feed.awake || g.space.awake || g.back.awake || g.bell.awake);
  }
  get movingTrains(): readonly Train[] { return this.awakeTrains; }

  // --- Rest management ---------------------------------------------------------------------------

  wake(name: GroupName): void {
    const g = this.core.groups[name];
    g.quiet = 0;
    if (g.awake) return;
    g.awake = true;
    for (const b of g.bodies) b.awake = true;
    for (const c of g.cons) c.enabled = true;
    for (const f of g.forces) f.enabled = true;
  }

  private rest(g: Group): void {
    g.awake = false;
    for (const b of g.bodies) { b.awake = false; b.v = 0; }
    for (const c of g.cons) c.enabled = false;
    for (const f of g.forces) f.enabled = false;
  }

  private wakeTrain(t: Train): void {
    if (!t.awake) { setTrainAwake(t, true); this.awakeTrains.push(t); }
    this.wake('esc');
  }

  private fingerOn(id: string, moving: boolean): boolean {
    return this.fingers.some((f) => (f.id === id || (id === 'Shift' && f.id.startsWith('Shift'))) && (!moving || f.phase === 'press' || f.phase === 'lift'));
  }

  private isQuiet(name: GroupName): boolean {
    const c = this.core, g = c.groups;
    switch (name) {
      case 'esc':
        return this.awakeTrains.length === 0 && !g.space.awake && !g.back.awake && !this.hand.busy && Math.abs(c.carriage.v) < 2e-4 && c.ubar.q < 2e-5 &&
          Math.abs(c.ubar.v) < 1e-3 && c.rocker.q < 2e-4 && Math.abs(c.rocker.v) < 0.02 && Math.abs(c.vibrator.v) < 1e-3 && c.state.looseIn;
      case 'shift':
        return Math.abs(c.shift.v) < 2e-3 && Math.abs(c.cradle.v) < 2e-4 && !this.fingerOn('Shift', true) && (this.fingerOn('Shift', false) || c.shift.q < 3e-4);
      case 'space': return !this.fingerOn('Space', false) && c.space.q < 2e-4 && Math.abs(c.space.v) < 2e-3;
      case 'back': return !this.fingerOn('Backspace', false) && c.backspace.q < 2e-4 && Math.abs(c.backspace.v) < 2e-3;
      case 'feed': return !this.hand.busy && c.lineLever.q < 2e-4 && Math.abs(c.lineLever.v) < 2e-3 && Math.abs(c.platen.v) < 2e-3 && Math.abs(Math.sin(SPEC.lineTeeth * c.platen.q)) < 0.08;
      case 'bell': return Math.abs(c.hammer.q) < 3e-3 && Math.abs(c.hammer.v) < 0.08 && !this.inBellZone();
    }
  }

  private inBellZone(): boolean {
    const x = this.core.carriage.q - this.core.limits.cBell;
    return this.core.state.bellArmed && x > -SPEC.bellRamp - 6e-4 && x < 2e-4;
  }

  // --- Typist's actions -------------------------------------------------------------------------

  /** Put a finger on a key. Returns it, or null if that key is already under a finger. */
  keyDown(id: string, o: { force?: number; hold?: boolean; servo?: boolean } = {}): Finger | null {
    if (this.fingers.some((f) => f.id === id && f.phase !== 'done')) return null;
    return this.makeFinger({ id, force: o.force ?? this.touch, hold: o.hold ?? false, servo: o.servo ?? false });
  }

  private makeFinger(spec: FingerSpec): Finger | null {
    const c = this.core;
    let target: Body, top: Vec3, landed: () => boolean;
    // Line lock: at the right margin a bar blocks the character keys and the space bar.
    if (this.atLineEnd && !spec.id.startsWith('Shift') && spec.id !== 'Backspace') { this.emit('locked', spec.id); return null; }
    if (spec.id === 'Space') { target = c.space; top = c.points.spaceTop; landed = () => c.space.q > c.limits.spaceMax * 0.97; this.wake('space'); this.wake('esc'); }
    else if (spec.id === 'ShiftLeft' || spec.id === 'ShiftRight') {
      target = c.shift; top = spec.id === 'ShiftLeft' ? c.points.shiftTopL : c.points.shiftTopR;
      landed = () => c.cradleUp.active || c.shift.q > c.limits.shiftMax * 0.97;
      this.wake('shift');
    } else if (spec.id === 'Backspace') { target = c.backspace; top = c.points.backTop; landed = () => c.backspace.q > c.limits.backMax * 0.97; this.wake('back'); this.wake('esc'); }
    else {
      const t = this.byCode.get(spec.id);
      if (!t) return null;
      target = t.lever; top = t.geom.top;
      landed = () => t.hit[0].active || t.hit[1].active || t.lever.q > t.geom.keyAngle * 0.995;
      this.wakeTrain(t);
      t.fingers++;
    }
    const opts: FingerOptions = { force: spec.force, hold: spec.hold, landed };
    if (spec.servo) opts.servo = () => this.servoDepth.get(spec.id) ?? 0;
    const f = new Finger(this.sys, spec.id, target, top, opts);
    this.fingers.push(f);
    this.fingerSpecs.set(f, spec);
    this.emit('fingerDown', spec.id, spec.force);
    return f;
  }

  keyUp(id: string): void {
    for (const f of this.fingers) if (f.id === id) { f.release(); if (id.startsWith('Shift')) this.wake('shift'); }
  }
  isDown(id: string): boolean { return this.fingers.some((f) => f.id === id && f.phase !== 'done' && f.phase !== 'lift'); }

  returnCarriage(): void { if (this.hand.busy) return; this.wake('feed'); this.wake('esc'); this.hand.start(); }

  /** Feed in a fresh sheet: clears the ink and rewinds the paper to its first line. */
  newSheet(): void { this.marks = []; this.core.platen.q = 0; this.core.platen.v = 0; this.detentIndex = 0; this.emit('newSheet'); }

  /**
   * Set the machine down, at rest, with the carriage at a given column (a demonstration aid: it is the state
   * you would reach by typing that many spaces, without having to watch them).
   */
  placeCarriage(column: number): void {
    const c = this.core, st = c.state, col = Math.round(column);
    for (const name of GROUP_ORDER) this.wake(name);
    c.carriage.q = col * CHAR_PITCH; c.carriage.v = 0;
    c.wheel.q = (col * TOOTH_PITCH) / ESC.wheelR; c.wheel.v = 0;
    c.looseDog.q = 0; c.looseDog.v = 0; c.rocker.q = 0; c.rocker.v = 0; c.ubar.q = 0; c.ubar.v = 0;
    st.toothLoose = col; st.backTooth = col; st.ratchet = 0; st.toothFixed = 0; st.looseIn = true; st.fixedIn = false;
    st.bellArmed = c.carriage.q < c.limits.cBell - SPEC.bellRamp;
    c.hammer.q = 0; c.hammer.v = 0;
    this.heldByLoose = true;
  }

  step(): void { this.sys.step(); }

  /** Advance by about dt seconds. While the whole machine rests, time passes without any solver work. */
  advance(dt: number): number {
    const sys = this.sys, total = Math.max(0, Math.round(dt / sys.h));
    for (let n = total; n > 0; n--) {
      if (this.idle) {
        this.schedule?.();
        if (this.idle) { sys.time += n * sys.h; sys.steps += n; break; }
      }
      sys.step();
    }
    return total;
  }

  /** Cumulative work by fingers and by the return hand since the start (J). */
  get fingerWork(): number { let w = this.fingerWorkDone; for (const f of this.fingers) w += f.work; return w; }
  get handWork(): number { return this.hand.work; }
  /** Energy still wound into the mainspring, relative to the carriage at its right-hand limit (J). */
  get springEnergy(): number {
    const pe = (c: number) => -SPEC.bandTension * c + 0.5 * SPEC.bandRate * c * c;
    return pe(this.core.carriage.q) - pe(this.core.limits.cRight);
  }

  // --- Per-substep hooks ------------------------------------------------------------------------

  private pre(): void {
    const c = this.core;
    if (c.groups.esc.awake) coreLogic(c, (e) => this.emit(e.type === 'bellArm' ? 'bellRelease' : e.type, undefined, e.value));
    let anyDone = false;
    for (const f of this.fingers) { f.update(); if (f.phase === 'done') anyDone = true; }
    if (anyDone) {
      for (const f of this.fingers) if (f.phase === 'done') {
        this.fingerWorkDone += f.work;
        const t = this.byCode.get(f.id);
        if (t) t.fingers--;
        this.fingerSpecs.delete(f);
        this.emit('fingerUp', f.id);
      }
      this.fingers = this.fingers.filter((f) => f.phase !== 'done');
    }
    if (this.hand.update()) this.emit('returnDone');
    if (this.sys.steps % 10 === 0) {
      if (c.groups.esc.awake && !c.groups.bell.awake && this.inBellZone()) this.wake('bell');
      this.schedule?.();
    }
  }

  private post(): void {
    const c = this.core, sys = this.sys;
    for (const t of this.awakeTrains) {
      if (!t.hit[0].active && !t.hit[1].active) t.approach = t.bar.v;
      for (let g = 0; g < 2; g++) {
        const hit = t.hit[g];
        if (hit.active) {
          if (hit.force > t.peak[g]) {
            const first = t.peak[g] === 0;
            t.peak[g] = hit.force;
            const s = t.peakState[g] ?? (t.peakState[g] = { t: 0, point: [0, 0, 0], carriage: 0, platen: 0, shift: 0, lift: 0, speed: 0 });
            s.t = sys.time; s.point[0] = hit.point[0]; s.point[1] = hit.point[1]; s.point[2] = hit.point[2];
            s.carriage = c.carriage.q; s.platen = c.platen.q; s.shift = c.cradle.q; s.lift = c.vibrator.q;
            if (first) s.speed = Math.abs(t.approach) * R_SEG;
          }
        } else if (t.peak[g] > 0) { this.imprint(t, g); t.peak[g] = 0; }
      }
      for (const w of this.trainWatch.get(t)!) { const on = w.c.active; if (on && !w.was) w.fire(); w.was = on; }
    }
    for (const w of this.coreWatch) { const on = w.c.active; if (on && !w.was) w.fire(); w.was = on; }

    // A letter space is complete when the next tooth has carried the loose dog back onto its stop.
    if (c.groups.esc.awake) {
      const held = c.state.looseIn && c.holdLoose.active;
      if (held && !this.heldByLoose) this.emit('step', undefined, Math.abs(c.holdLoose.vnPre));
      if (held) this.heldByLoose = true;
      else if (!c.state.looseIn || c.holdLoose.value > 2e-5) this.heldByLoose = false;
    }
    if (c.groups.feed.awake) {
      const idx = Math.round((c.platen.q * SPEC.lineTeeth) / (2 * Math.PI));
      if (idx !== this.detentIndex) { this.detentIndex = idx; this.emit('lineClick', undefined, c.platen.v); }
    }

    if (sys.steps % 40 === 0) {
      let slept = false;
      for (const t of this.awakeTrains) if (trainAtRest(t)) { setTrainAwake(t, false); slept = true; }
      if (slept) this.awakeTrains = this.awakeTrains.filter((t) => t.awake);
      for (const name of GROUP_ORDER) {
        const g = c.groups[name];
        if (!g.awake) continue;
        g.quiet = this.isQuiet(name) ? g.quiet + 1 : 0;
        if (g.quiet >= 4) this.rest(g);
      }
    }
  }

  /** The type face has just left the paper: record what it printed, from the geometry at peak pressure. */
  private imprint(t: Train, g: number): void {
    const s = t.peakState[g];
    if (!s) return;
    // Where on the platen's circumference did the face land? (angle from the print line, positive up the sheet)
    const ay = PLATEN_AXIS[1] + U[1] * s.shift, az = PLATEN_AXIS[2] + U[2] * s.shift;
    const ry = s.point[1] - ay, rz = s.point[2] - az;
    const delta = Math.atan2(ry * U[1] + rz * U[2], ry * F[1] + rz * F[2]);
    const v = PAPER.topMargin + PLATEN_R * (s.platen - delta);
    const u = s.carriage + s.point[0];
    // Is there ribbon between the face and the paper?
    const h = (s.point[1] - P0[1]) * U[1] + (s.point[2] - P0[2]) * U[2];
    const top = RIBBON.restTop + s.lift, bottom = top - RIBBON.width;
    const cover = Math.max(0, Math.min(h + GLYPH_HALF, top) - Math.max(h - GLYPH_HALF, bottom)) / (2 * GLYPH_HALF);
    const force = t.peak[g];
    // Ink transfer rises steeply with pressure and then saturates: a 40 N blow is clearly grey, 90 N is black.
    const ink = cover * (1 - Math.exp(-((force / INK_FORCE) ** 2)));
    const mark: Mark = { seq: this.seq++, t: s.t, ch: g === 0 ? t.geom.lower : t.geom.upper, key: t.geom.code, u, v, ink, force, speed: s.speed, cover };
    this.marks.push(mark);
    this.emit('impact', t.geom.code, force, mark);
  }

  // --- Snapshots (for stepping back in the guided tour) -------------------------------------------

  snapshot(): Snapshot {
    const n = this.permanent, b = this.sys.bodies;
    const q = new Float64Array(n), v = new Float64Array(n);
    for (let i = 0; i < n; i++) { q[i] = b[i].q; v[i] = b[i].v; }
    return {
      time: this.sys.time, steps: this.sys.steps, q, v, awake: this.trains.map((t) => t.awake), core: { ...this.core.state },
      marks: this.marks.length, seq: this.seq,
      fingers: this.fingers.map((f) => ({ spec: { ...this.fingerSpecs.get(f)! }, phase: f.phase, released: f.released, q: f.body.q, v: f.body.v, work: f.work, push: f.push, t0: f.t0, tLift: f.tLift, depth: this.servoDepth.get(f.id) ?? 0 })),
      hand: { phase: this.hand.phase, push: this.hand.push, t0: this.hand.t0, work: this.hand.force.work },
      fingerWork: this.fingerWorkDone, detent: this.detentIndex,
    };
  }

  restore(s: Snapshot): void {
    for (const f of this.fingers) f.dispose();
    this.fingers = [];
    this.fingerSpecs.clear();
    for (const name of GROUP_ORDER) this.wake(name);
    for (const t of this.trains) { t.fingers = 0; t.peak = [0, 0]; t.peakState = [null, null]; }
    this.trains.forEach((t, i) => setTrainAwake(t, s.awake[i]));
    this.awakeTrains = this.trains.filter((t) => t.awake);
    const b = this.sys.bodies;
    for (let i = 0; i < this.permanent; i++) { b[i].q = s.q[i]; b[i].v = s.v[i]; }
    // Contact flags belong to the moment being left, not the one being restored.
    for (const c of this.sys.constraints) { c.active = false; c.force = 0; c.lambda = 0; }
    Object.assign(this.core.state, s.core);
    this.sys.time = s.time;
    this.sys.steps = s.steps;
    this.marks.length = Math.min(this.marks.length, s.marks);
    this.seq = s.seq;
    for (const fs of s.fingers) {
      this.servoDepth.set(fs.spec.id, fs.depth);
      const f = this.makeFinger(fs.spec);
      if (!f) continue;
      f.phase = fs.phase; f.released = fs.released; f.body.q = fs.q; f.body.v = fs.v; f.work = fs.work; f.push = fs.push; f.t0 = fs.t0; f.tLift = fs.tLift;
    }
    this.events = [];
    this.hand.phase = s.hand.phase; this.hand.push = s.hand.push; this.hand.t0 = s.hand.t0; this.hand.force.work = s.hand.work;
    this.fingerWorkDone = s.fingerWork;
    this.detentIndex = s.detent;
    for (const w of this.coreWatch) w.was = true;
    for (const list of this.trainWatch.values()) for (const w of list) w.was = true;
    this.heldByLoose = true;
  }
}
