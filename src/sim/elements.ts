// Concrete constraints and force elements used to assemble the typewriter.

import { Body, Constraint, Force, System } from './solver';
import type { Vec3 } from './vec';

const P = new Float64Array(3);
const Q = new Float64Array(3);
const N = new Float64Array(3);

/** Rigid link between a point on A and a point on B (null = frame). */
export class Rod extends Constraint {
  /** 'rigid' keeps the distance; 'tension' is a wire (can go slack); 'compression' is a push-rod with free play. */
  mode: 'rigid' | 'tension' | 'compression' = 'rigid';
  constructor(public a: Body | null, public pa: Vec3, public b: Body | null, public pb: Vec3, public length: number) {
    super();
  }
  /** Current world end points. */
  ends(outA: Vec3, outB: Vec3): void {
    if (this.a) this.a.world(this.pa, outA); else { outA[0] = this.pa[0]; outA[1] = this.pa[1]; outA[2] = this.pa[2]; }
    if (this.b) this.b.world(this.pb, outB); else { outB[0] = this.pb[0]; outB[1] = this.pb[1]; outB[2] = this.pb[2]; }
  }
  eval(): number {
    this.ends(P as unknown as Vec3, Q as unknown as Vec3);
    const dx = P[0] - Q[0], dy = P[1] - Q[1], dz = P[2] - Q[2];
    const l = Math.hypot(dx, dy, dz) || 1e-12;
    const s = this.mode === 'tension' ? -1 : 1;
    const nx = (dx / l) * s, ny = (dy / l) * s, nz = (dz / l) * s;
    this.reset();
    this.addChain(this.a, P[0], P[1], P[2], nx, ny, nz, 1);
    this.addChain(this.b, Q[0], Q[1], Q[2], nx, ny, nz, -1);
    this.unilateral = this.mode !== 'rigid';
    return s * (l - this.length);
  }
  /** Signed axial load: positive = tension. */
  get tension(): number {
    return this.mode === 'tension' ? this.force : -this.force;
  }
}

/** A point on body A must stay on the positive side of a plane fixed to body B. */
export class PointPlane extends Constraint {
  offset = 0;
  /** Optional gate: contact only exists while this returns true (finite contact patch). */
  gate: (() => boolean) | null = null;
  constructor(public a: Body | null, public pa: Vec3, public b: Body | null, public pb: Vec3, public nb: Vec3) {
    super();
    this.unilateral = true;
  }
  eval(): number {
    if (this.gate && !this.gate()) { this.reset(); return 1; }
    if (this.a) this.a.world(this.pa, P); else { P[0] = this.pa[0]; P[1] = this.pa[1]; P[2] = this.pa[2]; }
    if (this.b) { this.b.world(this.pb, Q); this.b.worldDir(this.nb, N); }
    else { Q[0] = this.pb[0]; Q[1] = this.pb[1]; Q[2] = this.pb[2]; N[0] = this.nb[0]; N[1] = this.nb[1]; N[2] = this.nb[2]; }
    this.reset();
    this.addChain(this.a, P[0], P[1], P[2], N[0], N[1], N[2], 1);
    // The plane body's Jacobian is taken at the contact point (see derivation in docs/physics.md).
    this.addChain(this.b, P[0], P[1], P[2], N[0], N[1], N[2], -1);
    return (P[0] - Q[0]) * N[0] + (P[1] - Q[1]) * N[1] + (P[2] - Q[2]) * N[2] - this.offset;
  }
}

/** A point on body A must stay outside a cylinder fixed to body B (the platen). */
export class PointCylinder extends Constraint {
  /** Radial unit vector at the last evaluation (world). */
  readonly normal = new Float64Array(3);
  /** World contact point at the last evaluation. */
  readonly point = new Float64Array(3);
  constructor(public a: Body, public pa: Vec3, public b: Body | null, public c0: Vec3, public d0: Vec3, public radius: number) {
    super();
    this.unilateral = true;
  }
  eval(): number {
    this.a.world(this.pa, P);
    if (this.b) { this.b.world(this.c0, Q); this.b.worldDir(this.d0, N); }
    else { Q[0] = this.c0[0]; Q[1] = this.c0[1]; Q[2] = this.c0[2]; N[0] = this.d0[0]; N[1] = this.d0[1]; N[2] = this.d0[2]; }
    let rx = P[0] - Q[0], ry = P[1] - Q[1], rz = P[2] - Q[2];
    const along = rx * N[0] + ry * N[1] + rz * N[2];
    rx -= along * N[0]; ry -= along * N[1]; rz -= along * N[2];
    const d = Math.hypot(rx, ry, rz) || 1e-12;
    const nx = rx / d, ny = ry / d, nz = rz / d;
    this.normal[0] = nx; this.normal[1] = ny; this.normal[2] = nz;
    this.point[0] = P[0]; this.point[1] = P[1]; this.point[2] = P[2];
    this.reset();
    this.addChain(this.a, P[0], P[1], P[2], nx, ny, nz, 1);
    this.addChain(this.b, P[0], P[1], P[2], nx, ny, nz, -1);
    return d - this.radius;
  }
}

/** One-sided stop on a single coordinate: sign * (q - bound) >= 0. */
export class Limit extends Constraint {
  constructor(public body: Body, public bound: number, public sign: 1 | -1) {
    super();
    this.unilateral = true;
  }
  eval(): number {
    this.reset();
    this.addCoord(this.body, this.sign);
    return this.sign * (this.body.q - this.bound);
  }
}

/** Constraint defined by a callback (cams, ratchets, tooth/dog contact). */
export class FnConstraint extends Constraint {
  constructor(private fn: (c: FnConstraint) => number, unilateral = true) {
    super();
    this.unilateral = unilateral;
  }
  begin(): void { this.reset(); }
  coord(b: Body, g: number): void { this.addCoord(b, g); }
  chain(b: Body | null, p: ArrayLike<number>, d: ArrayLike<number>, sign: number): void {
    this.addChain(b, p[0], p[1], p[2], d[0], d[1], d[2], sign);
  }
  eval(): number {
    this.reset();
    return this.fn(this);
  }
}

/** Add a world force F acting at world point p on body b (and its carriers). Returns the power F·v. */
export function applyPointForce(b: Body | null, px: number, py: number, pz: number, fx: number, fy: number, fz: number): number {
  let power = 0;
  for (; b; b = b.parent) {
    b.ensureFrame();
    const a = b.axisW;
    let g: number;
    if (b.kind === 'slide') g = fx * a[0] + fy * a[1] + fz * a[2];
    else {
      const rx = px - b.originW[0], ry = py - b.originW[1], rz = pz - b.originW[2];
      g = fx * (a[1] * rz - a[2] * ry) + fy * (a[2] * rx - a[0] * rz) + fz * (a[0] * ry - a[1] * rx);
    }
    b.f += g;
    power += g * b.v;
  }
  return power;
}

/** Linear spring on one coordinate: f = -k (q - q0) + preload. */
export class CoordSpring extends Force {
  constructor(public body: Body, public k: number, public q0 = 0, public preload = 0) { super(); }
  apply(): void { this.body.f += -this.k * (this.body.q - this.q0) + this.preload; }
  override energy(): number { const d = this.body.q - this.q0; return 0.5 * this.k * d * d - this.preload * d; }
}

/** Coil spring stretched between a point on A and a point on B (null = frame). */
export class PointSpring extends Force {
  /** Current length and tension (N), refreshed each substep. */
  length = 0;
  tension = 0;
  constructor(public a: Body | null, public pa: Vec3, public b: Body | null, public pb: Vec3, public k: number, public restLength: number, public damping = 0) {
    super();
  }
  ends(outA: Vec3, outB: Vec3): void {
    if (this.a) this.a.world(this.pa, outA); else { outA[0] = this.pa[0]; outA[1] = this.pa[1]; outA[2] = this.pa[2]; }
    if (this.b) this.b.world(this.pb, outB); else { outB[0] = this.pb[0]; outB[1] = this.pb[1]; outB[2] = this.pb[2]; }
  }
  apply(): void {
    const A: Vec3 = [0, 0, 0], B: Vec3 = [0, 0, 0];
    this.ends(A, B);
    const dx = A[0] - B[0], dy = A[1] - B[1], dz = A[2] - B[2];
    const l = Math.hypot(dx, dy, dz) || 1e-12;
    const nx = dx / l, ny = dy / l, nz = dz / l;
    let rate = 0;
    if (this.damping) {
      const va = this.a ? this.a.pointVelocity(A) : [0, 0, 0];
      const vb = this.b ? this.b.pointVelocity(B) : [0, 0, 0];
      rate = (va[0] - vb[0]) * nx + (va[1] - vb[1]) * ny + (va[2] - vb[2]) * nz;
    }
    const T = this.k * (l - this.restLength) + this.damping * rate;
    this.length = l;
    this.tension = T;
    applyPointForce(this.a, A[0], A[1], A[2], -T * nx, -T * ny, -T * nz);
    applyPointForce(this.b, B[0], B[1], B[2], T * nx, T * ny, T * nz);
  }
  override energy(): number { const d = this.length - this.restLength; return 0.5 * this.k * d * d; }
}

/** External world-space force at a material point of a body (finger, hand). Tracks work done. */
export class AppliedForce extends Force {
  fx = 0; fy = 0; fz = 0;
  work = 0;
  constructor(public body: Body, public p0: Vec3) { super(); }
  set(f: Vec3): void { this.fx = f[0]; this.fy = f[1]; this.fz = f[2]; }
  apply(sys: System): void {
    if (this.fx === 0 && this.fy === 0 && this.fz === 0) return;
    this.body.world(this.p0, P);
    this.work += applyPointForce(this.body, P[0], P[1], P[2], this.fx, this.fy, this.fz) * sys.h;
  }
}

/** Force defined by a callback. */
export class FnForce extends Force {
  constructor(private fn: (sys: System) => void, private pe: (() => number) | null = null) { super(); }
  apply(sys: System): void { this.fn(sys); }
  override energy(): number { return this.pe ? this.pe() : 0; }
}
