// Constrained multibody dynamics in generalized coordinates.
//
// Every moving part is a Body with ONE degree of freedom relative to its parent
// (a hinge about a fixed axis, or a slide along a fixed direction).  Pivots are
// therefore exact by construction.  Everything that closes a loop between parts
// (wire links, contacts, stops, cams, ratchets) is a Constraint C(q) = 0 or
// C(q) >= 0 that is solved every substep with the XPBD "small steps" scheme:
//
//   v += h * f(q, v) / m ;  q += h * v           (springs, gravity, applied forces)
//   for each constraint:  dλ = (-C - α̃λ - γ ∇C·Δq) / ((1+γ) Σ ∇C²/m + α̃) ;  q += ∇C dλ / m
//   v = (q - q_prev) / h                          (constraint forces enter here)
//
// λ/h² is the physical force carried by the constraint (rod tension, contact
// force), which the viewer uses to show the load path.  Geometry is authored in
// "assembly coordinates": world positions when every q is zero.

import type { Vec3 } from './vec';

export type JointKind = 'hinge' | 'slide';

/** Bumped whenever the set of awake bodies or enabled elements changes, so systems rebuild their active lists. */
export const structure = { epoch: 0 };

export interface BodyDef {
  name: string;
  parent?: Body;
  kind: JointKind;
  /** A point on the hinge axis (assembly coords). Ignored for slides. */
  origin?: Vec3;
  /** Unit hinge axis / slide direction (assembly coords). */
  axis: Vec3;
  /** Generalized inertia: kg·m² about the axis for hinges, kg for slides. */
  inertia: number;
  /** Mass and centre of mass, used for gravity on this body's own coordinate. */
  mass?: number;
  com?: Vec3;
  /** Viscous generalized damping (N·m·s/rad or N·s/m). */
  damping?: number;
  /** Coulomb generalized friction magnitude (N·m or N). */
  friction?: number;
}

export class Body {
  readonly name: string;
  readonly parent: Body | null;
  readonly kind: JointKind;
  readonly origin: Vec3;
  readonly axis: Vec3;
  inertia: number;
  mass: number;
  com: Vec3;
  damping: number;
  friction: number;

  q = 0;
  v = 0;
  qPrev = 0;
  vPre = 0;
  f = 0;
  private _awake = true;
  private _kinematic = false;
  /** Sleeping bodies are frozen and skipped by the solver. */
  get awake(): boolean { return this._awake; }
  set awake(v: boolean) { if (v !== this._awake) { this._awake = v; structure.epoch++; } }
  /** Kinematic bodies follow a prescribed q (infinite mass for the solver). */
  get kinematic(): boolean { return this._kinematic; }
  set kinematic(v: boolean) { if (v !== this._kinematic) { this._kinematic = v; structure.epoch++; } }
  index = -1;

  // World frame: p_world = R * p0 + t. axisW / originW describe the joint in world.
  readonly R = new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  readonly t = new Float64Array(3);
  readonly axisW = new Float64Array(3);
  readonly originW = new Float64Array(3);
  private frameQ = NaN;
  frameVer = 0;
  private parentVer = -1;

  constructor(def: BodyDef) {
    this.name = def.name;
    this.parent = def.parent ?? null;
    this.kind = def.kind;
    this.origin = def.origin ?? [0, 0, 0];
    this.axis = def.axis;
    this.inertia = def.inertia;
    this.mass = def.mass ?? 0;
    this.com = def.com ?? this.origin;
    this.damping = def.damping ?? 0;
    this.friction = def.friction ?? 0;
  }

  get invMass(): number {
    return this._awake && !this._kinematic ? 1 / this.inertia : 0;
  }

  /** Recompute the world frame if q (or any ancestor frame) changed. */
  ensureFrame(): void {
    const p = this.parent;
    if (p) p.ensureFrame();
    if (this.frameQ === this.q && (!p || this.parentVer === p.frameVer)) return;
    this.frameQ = this.q;
    if (p) this.parentVer = p.frameVer;
    this.frameVer++;
    const R = this.R, t = this.t, aw = this.axisW, ow = this.originW;
    const [ax, ay, az] = this.axis;
    const [ox, oy, oz] = this.origin;
    if (p) {
      const P = p.R, pt = p.t;
      aw[0] = P[0] * ax + P[1] * ay + P[2] * az;
      aw[1] = P[3] * ax + P[4] * ay + P[5] * az;
      aw[2] = P[6] * ax + P[7] * ay + P[8] * az;
      ow[0] = P[0] * ox + P[1] * oy + P[2] * oz + pt[0];
      ow[1] = P[3] * ox + P[4] * oy + P[5] * oz + pt[1];
      ow[2] = P[6] * ox + P[7] * oy + P[8] * oz + pt[2];
    } else {
      aw[0] = ax; aw[1] = ay; aw[2] = az;
      ow[0] = ox; ow[1] = oy; ow[2] = oz;
    }
    if (this.kind === 'slide') {
      if (p) { for (let i = 0; i < 9; i++) R[i] = p.R[i]; t[0] = p.t[0]; t[1] = p.t[1]; t[2] = p.t[2]; }
      else { R[0] = 1; R[1] = 0; R[2] = 0; R[3] = 0; R[4] = 1; R[5] = 0; R[6] = 0; R[7] = 0; R[8] = 1; t[0] = 0; t[1] = 0; t[2] = 0; }
      t[0] += aw[0] * this.q; t[1] += aw[1] * this.q; t[2] += aw[2] * this.q;
      return;
    }
    // Local rotation about the (assembly-frame) axis, then the parent rotation.
    const c = Math.cos(this.q), s = Math.sin(this.q), k = 1 - c;
    const l0 = k * ax * ax + c, l1 = k * ax * ay - s * az, l2 = k * ax * az + s * ay;
    const l3 = k * ax * ay + s * az, l4 = k * ay * ay + c, l5 = k * ay * az - s * ax;
    const l6 = k * ax * az - s * ay, l7 = k * ay * az + s * ax, l8 = k * az * az + c;
    if (p) {
      const P = p.R;
      R[0] = P[0] * l0 + P[1] * l3 + P[2] * l6; R[1] = P[0] * l1 + P[1] * l4 + P[2] * l7; R[2] = P[0] * l2 + P[1] * l5 + P[2] * l8;
      R[3] = P[3] * l0 + P[4] * l3 + P[5] * l6; R[4] = P[3] * l1 + P[4] * l4 + P[5] * l7; R[5] = P[3] * l2 + P[4] * l5 + P[5] * l8;
      R[6] = P[6] * l0 + P[7] * l3 + P[8] * l6; R[7] = P[6] * l1 + P[7] * l4 + P[8] * l7; R[8] = P[6] * l2 + P[7] * l5 + P[8] * l8;
    } else {
      R[0] = l0; R[1] = l1; R[2] = l2; R[3] = l3; R[4] = l4; R[5] = l5; R[6] = l6; R[7] = l7; R[8] = l8;
    }
    t[0] = ow[0] - (R[0] * ox + R[1] * oy + R[2] * oz);
    t[1] = ow[1] - (R[3] * ox + R[4] * oy + R[5] * oz);
    t[2] = ow[2] - (R[6] * ox + R[7] * oy + R[8] * oz);
  }

  /** World position of a point given in assembly coordinates. */
  world(p0: Vec3, out: Float64Array | number[] = [0, 0, 0]): Vec3 {
    this.ensureFrame();
    const R = this.R, t = this.t;
    out[0] = R[0] * p0[0] + R[1] * p0[1] + R[2] * p0[2] + t[0];
    out[1] = R[3] * p0[0] + R[4] * p0[1] + R[5] * p0[2] + t[1];
    out[2] = R[6] * p0[0] + R[7] * p0[1] + R[8] * p0[2] + t[2];
    return out as Vec3;
  }

  /** World direction of a direction given in assembly coordinates. */
  worldDir(d0: Vec3, out: Float64Array | number[] = [0, 0, 0]): Vec3 {
    this.ensureFrame();
    const R = this.R;
    out[0] = R[0] * d0[0] + R[1] * d0[1] + R[2] * d0[2];
    out[1] = R[3] * d0[0] + R[4] * d0[1] + R[5] * d0[2];
    out[2] = R[6] * d0[0] + R[7] * d0[1] + R[8] * d0[2];
    return out as Vec3;
  }

  /** World velocity of a material point currently at world position p. */
  pointVelocity(p: Vec3): Vec3 {
    const out: Vec3 = [0, 0, 0];
    for (let b: Body | null = this; b; b = b.parent) {
      b.ensureFrame();
      const a = b.axisW;
      if (b.kind === 'slide') { out[0] += a[0] * b.v; out[1] += a[1] * b.v; out[2] += a[2] * b.v; continue; }
      const rx = p[0] - b.originW[0], ry = p[1] - b.originW[1], rz = p[2] - b.originW[2];
      out[0] += (a[1] * rz - a[2] * ry) * b.v;
      out[1] += (a[2] * rx - a[0] * rz) * b.v;
      out[2] += (a[0] * ry - a[1] * rx) * b.v;
    }
    return out;
  }
}

const MAX_GRAD = 8;

/** Base class: a scalar constraint C(q) with a sparse gradient over bodies. */
export abstract class Constraint {
  name = '';
  private _enabled = true;
  get enabled(): boolean { return this._enabled; }
  set enabled(v: boolean) { if (v !== this._enabled) { this._enabled = v; structure.epoch++; } }
  /** Unilateral constraints keep C >= 0 and can only push (λ >= 0). */
  unilateral = false;
  /** 1/stiffness in constraint units, integrated implicitly (XPBD). 0 = rigid. */
  compliance = 0;
  /**
   * If > 0 the constraint is an elastic contact (Kelvin-Voigt spring-damper, force = k·depth - c·dC/dt, never
   * pulling) integrated explicitly with the other forces. Used for impacts whose duration and peak force
   * matter (type slug on the rubber platen): the implicit XPBD form would damp a 0.3 ms impact numerically.
   */
  stiffness = 0;
  /** Damping coefficient c (force per unit rate of C) of an elastic contact (stiffness > 0). */
  dampingCoef = 0;
  /** Coefficient of restitution for rigid unilateral contacts. */
  restitution = 0;

  lambda = 0;
  /** Force carried during the last substep (N or N·m in constraint units). */
  force = 0;
  active = false;
  /** Last evaluated constraint value. */
  value = 0;
  vnPre = 0;

  n = 0;
  readonly gb: Body[] = [];
  readonly gv = new Float64Array(MAX_GRAD);

  /** Evaluate C and fill the gradient (via addChain/addCoord). */
  abstract eval(): number;

  protected reset(): void { this.n = 0; }

  protected addCoord(b: Body, g: number): void {
    for (let i = 0; i < this.n; i++) if (this.gb[i] === b) { this.gv[i] += g; return; }
    this.gb[this.n] = b;
    this.gv[this.n++] = g;
  }

  /** Add d(dir · p)/dq for a point p (world) rigidly attached to body b, times sign. */
  protected addChain(b: Body | null, px: number, py: number, pz: number, dx: number, dy: number, dz: number, sign: number): void {
    for (; b; b = b.parent) {
      const a = b.axisW;
      let g: number;
      if (b.kind === 'slide') g = dx * a[0] + dy * a[1] + dz * a[2];
      else {
        const rx = px - b.originW[0], ry = py - b.originW[1], rz = pz - b.originW[2];
        g = dx * (a[1] * rz - a[2] * ry) + dy * (a[2] * rx - a[0] * rz) + dz * (a[0] * ry - a[1] * rx);
      }
      this.addCoord(b, sign * g);
    }
  }
}

/** A force element adds generalized forces to bodies each substep. */
export abstract class Force {
  name = '';
  private _enabled = true;
  get enabled(): boolean { return this._enabled; }
  set enabled(v: boolean) { if (v !== this._enabled) { this._enabled = v; structure.epoch++; } }
  abstract apply(sys: System): void;
  /** Stored potential energy (J), if any. */
  energy(): number { return 0; }
}

export class System {
  readonly bodies: Body[] = [];
  readonly constraints: Constraint[] = [];
  readonly forces: Force[] = [];
  /** Substep (s). 25 µs resolves the ~0.3 ms type-slug impact with ~12 steps. */
  h = 25e-6;
  /** Gauss-Seidel passes over the rigid constraints per substep. */
  iterations = 2;
  time = 0;
  steps = 0;
  gravity = 9.81;
  /** Velocity scale for Coulomb friction regularization. */
  frictionEps = 1e-3;
  /** Hooks for discrete machine logic (latches, ratchets, event detection). */
  preStep: Array<(sys: System) => void> = [];
  postStep: Array<(sys: System) => void> = [];

  // Only awake bodies and enabled elements are visited each substep; the lists are rebuilt when that set changes.
  private seen = -1;
  private aBodies: Body[] = [];
  private aElastic: Constraint[] = [];
  private aRigid: Constraint[] = [];
  private aForces: Force[] = [];

  addBody(def: BodyDef): Body {
    const b = new Body(def);
    b.index = this.bodies.length;
    this.bodies.push(b);
    structure.epoch++;
    return b;
  }
  add<T extends Constraint>(c: T, name = ''): T { if (name) c.name = name; this.constraints.push(c); structure.epoch++; return c; }
  addForce<T extends Force>(f: T, name = ''): T { if (name) f.name = name; this.forces.push(f); structure.epoch++; return f; }

  /** Remove a body. The caller removes the constraints and forces that referenced it. */
  removeBody(b: Body): void { const i = this.bodies.indexOf(b); if (i >= 0) this.bodies.splice(i, 1); structure.epoch++; }
  remove(c: Constraint): void { const i = this.constraints.indexOf(c); if (i >= 0) this.constraints.splice(i, 1); structure.epoch++; }
  removeForce(f: Force): void { const i = this.forces.indexOf(f); if (i >= 0) this.forces.splice(i, 1); structure.epoch++; }

  private rebuild(): void {
    this.seen = structure.epoch;
    this.aBodies = this.bodies.filter((b) => b.awake || b.kinematic);
    this.aElastic = this.constraints.filter((c) => c.enabled && c.stiffness > 0);
    this.aRigid = this.constraints.filter((c) => c.enabled && c.stiffness <= 0);
    this.aForces = this.forces.filter((f) => f.enabled);
    for (const c of this.constraints) if (!c.enabled) { c.active = false; c.force = 0; c.lambda = 0; }
  }

  step(): void {
    const h = this.h, g = this.gravity;
    for (const fn of this.preStep) fn(this);
    if (this.seen !== structure.epoch) this.rebuild();
    const bodies = this.aBodies, rigid = this.aRigid;

    // 1. Forces.
    for (const b of bodies) b.f = 0;
    for (const b of bodies) {
      if (b.kinematic) continue;
      if (b.mass > 0) {
        b.ensureFrame();
        if (b.kind === 'hinge') {
          const R = b.R, t = b.t, c0 = b.com, a = b.axisW, o = b.originW;
          const rx = R[0] * c0[0] + R[1] * c0[1] + R[2] * c0[2] + t[0] - o[0];
          const rz = R[6] * c0[0] + R[7] * c0[1] + R[8] * c0[2] + t[2] - o[2];
          // d(com_y)/dq = (a × r)_y ; generalized gravity force = -m g * that
          b.f -= b.mass * g * (a[2] * rx - a[0] * rz);
        } else b.f -= b.mass * g * b.axisW[1];
      }
      if (b.damping) b.f -= b.damping * b.v;
      if (b.friction) b.f -= b.friction * Math.tanh(b.v / this.frictionEps);
    }
    for (const f of this.aForces) f.apply(this);
    for (const c of this.aElastic) {
      c.active = false; c.force = 0;
      const C = c.eval();
      c.value = C;
      if (C >= 0) continue;
      let rate = 0;
      for (let i = 0; i < c.n; i++) rate += c.gv[i] * c.gb[i].v;
      const F = -c.stiffness * C - c.dampingCoef * rate;
      if (F <= 0) continue;
      c.force = F;
      c.active = true;
      c.vnPre = rate;
      for (let i = 0; i < c.n; i++) c.gb[i].f += c.gv[i] * F;
    }

    // 2. Integrate (semi-implicit Euler).
    for (const b of bodies) {
      b.qPrev = b.q;
      if (b.kinematic) { b.q += h * b.v; b.vPre = b.v; continue; }
      b.v += (h * b.f) / b.inertia;
      b.vPre = b.v;
      b.q += h * b.v;
    }

    // 3. Position-level projection of the rigid constraints.
    const h2 = h * h;
    for (const c of rigid) { c.lambda = 0; c.active = false; c.force = 0; }
    for (let it = 0; it < this.iterations; it++) {
      for (const c of rigid) {
        const C = c.eval();
        if (it === 0) c.value = C;
        if (c.unilateral && C >= 0 && c.lambda === 0) continue;
        let w = 0;
        for (let i = 0; i < c.n; i++) { const gi = c.gv[i]; w += gi * gi * c.gb[i].invMass; }
        if (w < 1e-30) continue;
        const alpha = c.compliance / h2;
        let dl = (-C - alpha * c.lambda) / (w + alpha);
        if (c.unilateral && c.lambda + dl < 0) dl = -c.lambda;
        if (dl === 0) continue;
        if (!c.active) {
          let vn = 0;
          for (let i = 0; i < c.n; i++) vn += c.gv[i] * c.gb[i].vPre;
          c.vnPre = vn;
          c.active = true;
        }
        c.lambda += dl;
        for (let i = 0; i < c.n; i++) { const b = c.gb[i]; b.q += c.gv[i] * dl * b.invMass; }
      }
    }

    // 4. Velocities from positions, then restitution for rigid contacts.
    const invH = 1 / h;
    for (const b of bodies) if (!b.kinematic) b.v = (b.q - b.qPrev) * invH;
    for (const c of rigid) {
      c.force = c.lambda / h2;
      if (c.lambda === 0) { c.active = false; continue; }
      if (!c.unilateral || c.compliance > 0) continue;
      let w = 0, vn = 0;
      for (let i = 0; i < c.n; i++) { const b = c.gb[i], gi = c.gv[i]; w += gi * gi * b.invMass; vn += gi * b.v; }
      if (w < 1e-30) continue;
      const target = c.vnPre < -1e-3 ? -c.restitution * c.vnPre : 0;
      const dv = target - vn;
      if (dv <= 0) continue;
      const j = dv / w;
      for (let i = 0; i < c.n; i++) { const b = c.gb[i]; b.v += c.gv[i] * j * b.invMass; }
    }

    this.time += h;
    this.steps++;
    for (const fn of this.postStep) fn(this);
  }

  /** Advance by (about) dt seconds; returns the number of substeps taken. */
  advance(dt: number): number {
    const n = Math.max(0, Math.round(dt / this.h));
    for (let i = 0; i < n; i++) this.step();
    return n;
  }

  kinetic(): number {
    let e = 0;
    for (const b of this.bodies) if (!b.kinematic && b.awake) e += 0.5 * b.inertia * b.v * b.v;
    return e;
  }

  /** Gravitational + elastic potential energy (J). */
  potential(): number {
    let e = 0;
    const tmp: Vec3 = [0, 0, 0];
    for (const b of this.bodies) if (b.mass > 0) e += b.mass * this.gravity * b.world(b.com, tmp)[1];
    for (const f of this.forces) if (f.enabled) e += f.energy();
    for (const c of this.constraints) {
      if (!c.enabled || !c.active) continue;
      if (c.stiffness > 0) e += 0.5 * c.stiffness * c.value * c.value;
      else if (c.compliance > 0) e += 0.5 * c.force * c.force * c.compliance;
    }
    return e;
  }
}
