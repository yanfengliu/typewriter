/** Reduced-coordinate, frictionless unilateral dynamics.
 *
 * A gap is separation-positive. Contact generalized force is +J^T lambda,
 * lambda >= 0, and sustained contact satisfies J*a + Jdot*v + g_tt >= 0.
 * This is the normal-contact complementarity formulation described by Baraff:
 * https://www.cs.cmu.edu/~baraff/papers/sig94.pdf (section 3).
 * The smooth integrator and bounded active-set implementation here are local.
 *
 * There is no position projection and no work correction. The reported energy
 * residual includes integration, derivative and constraint drift. Gap functions
 * must be smooth over each step; stop at force/topology discontinuities. The
 * swept detector samples a cubic path eight times per bounded step, so it is
 * NOT a certificate against arbitrarily narrow or rapidly oscillating gaps.
 */
import { monotoneQP } from './monotone-qp';
import { scalarCrossing } from './scalar-crossing';

export type CoordinateVector = readonly number[];
export type MassMatrix = readonly CoordinateVector[];
export interface NormalContact {
  id: string;
  /** Prefer metres, including angular stops multiplied by a physical arm. */
  gap(q: CoordinateVector, time: number): number;
  gradient?(q: CoordinateVector, time: number): CoordinateVector;
  /** Partial time derivative with q held fixed. Zero for a fixed boundary. */
  timeDerivative?(q: CoordinateVector, time: number): number;
  /** d²g(q+v*s,t+s)/ds² at s=0; excludes J*qddot. */
  accelerationBias?(q: CoordinateVector, v: CoordinateVector, time: number): number;
}
export interface UnilateralDefinition {
  mass(q: CoordinateVector): MassMatrix;
  /** Positive Christoffel contraction; subtracted from applied force. An
   * analytic sparse provider avoids allocating a cubic derivative tensor. */
  inertialForce?(q: CoordinateVector, v: CoordinateVector): CoordinateVector;
  /** derivatives[k][i][j] = partial M_ij / partial q_k. */
  massDerivatives?(q: CoordinateVector): readonly MassMatrix[];
  potential(q: CoordinateVector): number;
  potentialGradient?(q: CoordinateVector): CoordinateVector;
  /** Generalized dissipative force; its power must be nonpositive. */
  damping?(q: CoordinateVector, v: CoordinateVector, time: number): CoordinateVector;
  contacts: readonly NormalContact[];
}
export interface UnilateralState { q: CoordinateVector; v: CoordinateVector; time?: number; }
export interface UnilateralOptions {
  /** Characteristic magnitudes in each coordinate's own units, e.g. rad/m. */
  coordinateScales?: CoordinateVector;
  /** Relative central-difference spacing, multiplied by coordinateScales. */
  differenceStep?: number;
  timeDifference?: number;
  maxStep?: number;
  gapTolerance?: number;
  velocityTolerance?: number;
  accelerationTolerance?: number;
  /** Release roots this many seconds apart may share a reported event time.
   * An endpoint feature guard may also be reported this much early, using the
   * incoming trajectory jet without advancing state or sampling future force.
   * Both use a rounding floor of 8 * Number.EPSILON * abs(current time). */
  eventTimeTolerance?: number;
  /** Same coefficient for the simultaneous compression/expansion event. */
  restitution?: number;
  maxEvents?: number;
  maxSubsteps?: number;
}
export type GeneralizedForce = CoordinateVector | ((q: CoordinateVector, v: CoordinateVector, time: number) => CoordinateVector);
export interface ContactState {
  id: string; gap: number; normalVelocity: number; reaction: number;
}
export interface ContactImpulse {
  id: string; impulse: number; incoming: number; outgoing: number;
}
export interface ContactEvent {
  time: number; elapsed: number; q: CoordinateVector;
  before: CoordinateVector; after: CoordinateVector;
  contacts: readonly ContactImpulse[]; loss: number; boundaryWork: number;
}
export interface UnilateralStep {
  elapsed: number; events: readonly ContactEvent[]; contacts: readonly ContactState[];
  releases: readonly { time: number; elapsed: number; id: string }[];
  /** Sustained-force integrals and sub-tolerance inelastic captures, by ID. */
  supportImpulses: Readonly<Record<string, number>>;
  minGap: number; substeps: number;
}
/** A non-force feature boundary. Positive means the current contact formulas
 * remain valid; zero/negative asks the caller to select the outgoing feature.
 * The guard itself never supplies an impulse, a force, or a position change.
 * It must admit a smooth incoming continuation through eventTimeTolerance for
 * endpoint classification; this can report a boundary early at that resolution. */
export interface FeatureGuard {
  id: string; value(q: CoordinateVector, time: number): number;
  /** Optional domain of the current smooth formulas. This predicate and this
   * guard's value must be total, finite and side-effect-free, including outside
   * the domain. Its zero must precede domain failure, leaving a smooth incoming
   * continuation through the zero. Every predicate is checked before ordinary
   * guard, contact or force evaluation. A failed trial is shortened, never used
   * as an accepted state or as a source of work/impulse. Protected advances and
   * replacements require explicit inertialForce or massDerivatives,
   * potentialGradient and every
   * contact's gradient, timeDerivative and accelerationBias. These providers
   * must evaluate their analytic values within the domain; automatic difference
   * stencils are not used under this contract. Guards are registered at advance
   * time: the constructor has no guard and evaluates the initial definition. */
  smoothDomain?(q: CoordinateVector, time: number): boolean;
}
export interface BoundaryStep extends UnilateralStep {
  remaining: number;
  boundary: { time: number; elapsed: number; ids: readonly string[] } | null;
}
export interface UnilateralEnergy {
  initial: number; inputWork: number; boundaryWork: number;
  dampingLoss: number; impactLoss: number; residual: number;
}

type Vector = number[];
type Matrix = Vector[];
interface SumCarry { q: CoordinateVector; v: CoordinateVector; t: number; }
interface State { q: Vector; v: Vector; t: number; carry?: SumCarry; }
interface Geometry { contact: NormalContact; gap: number; j: Vector; gt: number; w: number; }
interface Rates { q: Vector; v: Vector; input: number; boundary: number; damping: number; reactions: Vector; }
interface Trial { state: State; input: number; boundary: number; damping: number; support: Vector; }
class OutsideSmoothDomain extends Error {
  constructor(readonly guard: FeatureGuard, readonly state: State, readonly elapsed: number) {
    super(`Trial leaves smooth domain at ${guard.id}`);
  }
}
const dot = (a: CoordinateVector, b: CoordinateVector) => a.reduce((s, x, i) => s + x * b[i], 0);
const add = (a: CoordinateVector, b: CoordinateVector, scale = 1): Vector => a.map((x, i) => x + scale * b[i]);
const finite = (x: number, label: string): number => { if (!Number.isFinite(x)) throw new Error(`Nonfinite ${label}`); return x; };
/** Kahan carry belongs to the accepted trajectory, not a contact correction. */
const increment = (value: number, carry: number, delta: number): readonly [number, number] => {
  if (!delta) return [value, carry];
  const adjusted = delta - carry, next = value + adjusted;
  return [next, (next - value) - adjusted];
};
const lowerPositive = (value: number): number => {
  const bits = new DataView(new ArrayBuffer(8)); bits.setFloat64(0, value);
  bits.setBigUint64(0, bits.getBigUint64(0) - 1n); return bits.getFloat64(0);
};
const vector = (v: CoordinateVector, n: number, label: string): Vector => {
  if (v.length !== n) throw new Error(`Wrong ${label} dimension`);
  return v.map(x => finite(x, label));
};

/** Cholesky also rejects nonsymmetric/non-SPD mass matrices, not just bad solves. */
function factor(a: MassMatrix): Matrix {
  const n = a.length, l = Array.from({ length: n }, () => Array(n).fill(0));
  if (!n || a.some(row => row.length !== n)) throw new Error('Mass matrix must be square');
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    finite(a[i][j], 'matrix'); finite(a[j][i], 'matrix');
    const symmetricScale = Math.max(1e-30, Math.sqrt(Math.abs(a[i][i] * a[j][j])), Math.abs(a[i][j]), Math.abs(a[j][i]));
    if (Math.abs(a[i][j] - a[j][i]) > 1e-11 * symmetricScale) throw new Error('Mass matrix must be symmetric');
    let s = a[i][j]; for (let k = 0; k < j; k++) s -= l[i][k] * l[j][k];
    if (i === j) {
      if (!(s > 1e-13 * Math.abs(a[i][i]))) throw new Error('Mass matrix must be positive definite and well conditioned');
      l[i][j] = Math.sqrt(s);
    } else l[i][j] = s / l[j][j];
  }
  return l;
}
function solve(l: MassMatrix, b: CoordinateVector): Vector {
  const x = [...b];
  for (let i = 0; i < x.length; i++) { for (let j = 0; j < i; j++) x[i] -= l[i][j] * x[j]; x[i] /= l[i][i]; }
  for (let i = x.length - 1; i >= 0; i--) { for (let j = i + 1; j < x.length; j++) x[i] -= l[j][i] * x[j]; x[i] /= l[i][i]; }
  return x;
}

/** Bounded exact active-set search. Velocity/acceleration is unique for SPD M;
 * redundant contact force allocations need not be. IDs give a stable basis.
 * At most rank(M) independent active normals are required for a feasible cone. */
function complementarity(a: MassMatrix, b: CoordinateVector, rank: number): Vector {
  const n = b.length;
  if (!n) return [];
  const scale = a.map((row, i) => {
    if (!(row[i] > 0)) throw new Error('Contact has no dynamic normal direction');
    return Math.sqrt(row[i]);
  });
  const normalized = a.map((row, i) => row.map((x, j) => x / (scale[i] * scale[j]))), rhs = b.map((x, i) => x / scale[i]);
  const tolerance = 2e-11 * Math.max(1, ...rhs.map(Math.abs));
  if (rhs.every(x => x >= -tolerance)) return Array(n).fill(0);
  let answer: Vector | null = null;
  const examine = (indices: number[]) => {
    const m = indices.map(i => indices.map(j => normalized[i][j]));
    let active: Vector;
    try { active = solve(factor(m), indices.map(i => -rhs[i])); } catch { return; }
    if (active.some(x => x < -tolerance)) return;
    const p = Array(n).fill(0); indices.forEach((i, j) => p[i] = Math.max(0, active[j]));
    const w = normalized.map((row, i) => dot(row, p) + rhs[i]);
    if (w.some(x => x < -tolerance) || indices.some(i => Math.abs(w[i]) > tolerance * 4)) return;
    answer = p.map((x, i) => x / scale[i]);
  };
  // Sustained support often loads every independent normal. Try that basis
  // first, with exactly the same positivity/complementarity checks, instead
  // of enumerating all of its smaller subsets on every force evaluation.
  if (n <= rank) examine(Array.from({ length: n }, (_, i) => i));
  if (n > 12) {
    if (answer) return answer;
    const result = monotoneQP(a.map(row => [...row]), [...b], rank);
    if (result.status !== 'solved') throw new Error('Certified incompatible contact cone');
    return result.impulse;
  }
  const choose = (start: number, left: number, indices: number[]) => {
    if (answer) return;
    if (!left) { examine(indices); return; }
    for (let i = start; i <= n - left && !answer; i++) choose(i + 1, left - 1, [...indices, i]);
  };
  for (let count = 1; count <= Math.min(n <= rank ? n - 1 : n, rank) && !answer; count++) choose(0, count, []);
  if (!answer) throw new Error('No admissible contact active set (incompatible constraints or numerical conditioning)');
  return answer;
}

export class UnilateralSystem {
  readonly account: UnilateralEnergy;
  readonly options: Required<UnilateralOptions>;
  private current: State;
  private readonly n: number;
  private contacts: readonly NormalContact[];
  private featureBoundaryTime: number | null = null;
  private domainProtected = false;
  // Object identity matters: an ID reused for an unrelated replacement formula
  // must not inherit the old surface's established support.
  private established = new Set<NormalContact>();

  constructor(readonly definition: UnilateralDefinition, initial: UnilateralState, options: UnilateralOptions = {}) {
    this.n = initial.q.length;
    if (this.n < 1 || this.n > 51) throw new Error('UnilateralSystem requires 1–51 dynamic coordinates');
    this.current = { q: vector(initial.q, this.n, 'coordinate'), v: vector(initial.v, this.n, 'velocity'), t: finite(initial.time ?? 0, 'time') };
    this.options = { coordinateScales: Array(this.n).fill(1), differenceStep: 1e-5, timeDifference: 1e-5, maxStep: 1 / 960,
      gapTolerance: 1e-9, velocityTolerance: 1e-8, accelerationTolerance: 1e-8, eventTimeTolerance: 1e-12, restitution: 0, maxEvents: 64, maxSubsteps: 20000, ...options };
    vector(this.options.coordinateScales, this.n, 'coordinate scale');
    if (this.options.coordinateScales.some(s => !(s > 0)) || [this.options.differenceStep, this.options.timeDifference, this.options.maxStep, this.options.gapTolerance, this.options.velocityTolerance, this.options.accelerationTolerance, this.options.eventTimeTolerance].some(x => !(x > 0) || !Number.isFinite(x)) || !(this.options.restitution >= 0 && this.options.restitution <= 1) || !Number.isInteger(this.options.maxEvents) || this.options.maxEvents < 1 || !Number.isInteger(this.options.maxSubsteps) || this.options.maxSubsteps < 1) throw new Error('Invalid unilateral solver options');
    this.contacts = [...definition.contacts].sort((a, b) => a.id.localeCompare(b.id));
    if (new Set(this.contacts.map(c => c.id)).size !== this.contacts.length) throw new Error('Contact IDs must be unique');
    factor(this.matrix(this.current.q));
    if (this.geometry(this.current).some(g => g.gap < -this.options.gapTolerance)) throw new Error('Initial state penetrates a contact');
    this.account = { initial: this.totalEnergy, inputWork: 0, boundaryWork: 0, dampingLoss: 0, impactLoss: 0, residual: 0 };
  }
  get q(): CoordinateVector { return [...this.current.q]; }
  get v(): CoordinateVector { return [...this.current.v]; }
  get time(): number { return this.current.t; }
  get kinetic(): number { const m = this.matrix(this.current.q); return .5 * dot(this.current.v, m.map(row => dot(row, this.current.v))); }
  get potential(): number { return finite(this.definition.potential(this.current.q), 'potential'); }
  get totalEnergy(): number { return this.kinetic + this.potential; }

  private matrix(q: CoordinateVector): Matrix {
    const m = this.definition.mass(q);
    if (m.length !== this.n) throw new Error('Wrong mass matrix dimension');
    return m.map(row => vector(row, this.n, 'mass matrix'));
  }
  private difference(q: CoordinateVector, i: number): number { return this.options.differenceStep * Math.max(this.options.coordinateScales[i], Math.abs(q[i])); }
  private gradient(f: (q: CoordinateVector) => number, q: CoordinateVector): Vector {
    return q.map((_, i) => { const h = this.difference(q, i), a = [...q], b = [...q]; a[i] -= h; b[i] += h; return finite((f(b) - f(a)) / (2 * h), 'gradient'); });
  }
  private normal(contact: NormalContact, q: CoordinateVector, t: number): Vector {
    return contact.gradient ? vector(contact.gradient(q, t), this.n, 'contact gradient') : this.gradient(p => contact.gap(p, t), q);
  }
  private timeDerivative(c: NormalContact, q: CoordinateVector, t: number): number {
    const h = this.options.timeDifference;
    return finite(c.timeDerivative ? c.timeDerivative(q, t) : (c.gap(q, t + h) - c.gap(q, t - h)) / (2 * h), 'contact time derivative');
  }
  private geometry(s: State, contacts = this.contacts): Geometry[] {
    return contacts.map(contact => { const j = this.normal(contact, s.q, s.t), gt = this.timeDerivative(contact, s.q, s.t);
      return { contact, gap: finite(contact.gap(s.q, s.t), 'gap'), j, gt, w: dot(j, s.v) + gt }; });
  }
  private bias(c: NormalContact, s: State): number {
    if (c.accelerationBias) return finite(c.accelerationBias(s.q, s.v, s.t), 'contact acceleration bias');
    const h = this.options.timeDifference;
    const normalVelocity = (sign: number) => { const q = add(s.q, s.v, sign * h), t = s.t + sign * h;
      return dot(this.normal(c, q, t), s.v) + this.timeDerivative(c, q, t); };
    return finite((normalVelocity(1) - normalVelocity(-1)) / (2 * h), 'contact acceleration bias');
  }
  private inertialForce(q: CoordinateVector, v: CoordinateVector): Vector {
    if (this.definition.inertialForce) return vector(this.definition.inertialForce(q, v), this.n, 'inertial force');
    const derivatives = this.definition.massDerivatives ? this.definition.massDerivatives(q) : q.map((_, k) => {
      const h = this.difference(q, k), a = [...q], b = [...q]; a[k] -= h; b[k] += h;
      const ma = this.matrix(a), mb = this.matrix(b); return ma.map((row, i) => row.map((x, j) => (mb[i][j] - x) / (2 * h)));
    });
    if (derivatives.length !== this.n || derivatives.some(m => m.length !== this.n || m.some(row => row.length !== this.n || row.some(x => !Number.isFinite(x))))) throw new Error('Wrong/nonfinite mass derivative dimensions');
    // Christoffel contraction: sum_jk (d_k M_ij - .5 d_i M_jk) v_j v_k.
    return q.map((_, i) => v.reduce((sum, vj, j) => sum + v.reduce((inner, vk, k) => inner + (derivatives[k][i][j] - .5 * derivatives[i][j][k]) * vj * vk, 0), 0));
  }
  private contactMatrix(geometry: readonly Geometry[], l: MassMatrix): { response: Matrix; a: Matrix } {
    const response = geometry.map(g => solve(l, g.j));
    return { response, a: geometry.map(g => response.map(r => dot(g.j, r))) };
  }
  private opening(s: State, rates: Rates, i: number): boolean {
    if (rates.reactions[i] > 0) return false;
    const c = this.contacts[i];
    return dot(this.normal(c, s.q, s.t), rates.v) + this.bias(c, s) > this.options.accelerationTolerance;
  }
  private gapLimit(contact: NormalContact, guarded: boolean): number {
    return guarded && !this.established.has(contact) ? 0 : this.options.gapTolerance;
  }
  private active(s: State, force: GeneralizedForce, guarded = false): number[] {
    const candidates = this.geometry(s).flatMap((g, i) => g.gap <= this.gapLimit(g.contact, guarded) && Math.abs(g.w) <= this.options.velocityTolerance ? [i] : []);
    if (!candidates.length) return candidates;
    const rates = this.rates(s, force, candidates);
    return candidates.filter(i => !this.opening(s, rates, i));
  }
  private rates(s: State, force: GeneralizedForce, active: readonly number[]): Rates {
    const l = factor(this.matrix(s.q)), ext = vector(typeof force === 'function' ? force(s.q, s.v, s.t) : force, this.n, 'generalized force');
    const damping = this.definition.damping ? vector(this.definition.damping(s.q, s.v, s.t), this.n, 'damping') : Array(this.n).fill(0);
    const dampingPower = dot(damping, s.v);
    if (dampingPower > 1e-12) throw new Error('Damping force supplies positive power');
    const gradient = this.definition.potentialGradient ? vector(this.definition.potentialGradient(s.q), this.n, 'potential gradient') : this.gradient(q => this.definition.potential(q), s.q);
    const inertial = this.inertialForce(s.q, s.v), free = solve(l, ext.map((x, i) => x + damping[i] - gradient[i] - inertial[i]));
    const geometry = this.geometry(s), selected = active.map(i => geometry[i]);
    const { response, a } = this.contactMatrix(selected, l);
    const reactions = complementarity(a, selected.map(g => dot(g.j, free) + this.bias(g.contact, s)), this.n);
    const acceleration = [...free], all = Array(this.contacts.length).fill(0);
    reactions.forEach((lambda, i) => { for (let j = 0; j < this.n; j++) acceleration[j] += response[i][j] * lambda; all[active[i]] = lambda; });
    return { q: [...s.v], v: acceleration, input: dot(ext, s.v), boundary: -dot(reactions, selected.map(g => g.gt)), damping: Math.max(0, -dampingPower), reactions: all };
  }
  /** Every trial owns its proposed carry. Stages and root-search retries read
   * the same accepted baseline; only accept() installs a trial's state/carry. */
  private incrementState(s: State, dq: CoordinateVector, dv: CoordinateVector, dt: number): State {
    const q: Vector = [], v: Vector = [], cq: Vector = [], cv: Vector = [];
    for (let i = 0; i < this.n; i++) {
      [q[i], cq[i]] = increment(s.q[i], s.carry?.q[i] ?? 0, dq[i]);
      [v[i], cv[i]] = increment(s.v[i], s.carry?.v[i] ?? 0, dv[i]);
    }
    const [t, ct] = increment(s.t, s.carry?.t ?? 0, dt);
    return { q, v, t, carry: { q: cq, v: cv, t: ct } };
  }
  private checkDomain(s: State, guards: readonly FeatureGuard[], elapsed: number): void {
    for (const guard of guards) if (guard.smoothDomain && !guard.smoothDomain(s.q, s.t)) throw new OutsideSmoothDomain(guard, s, elapsed);
  }
  /** Metadata-only preflight: no domain or physics callback runs, and no
   * boundary/state/history is changed, when a protected contract is incomplete. */
  private requireDomainDerivatives(contacts: readonly NormalContact[]): void {
    const missing: string[] = [];
    if (typeof this.definition.massDerivatives !== 'function' && typeof this.definition.inertialForce !== 'function') missing.push('massDerivatives or inertialForce');
    if (typeof this.definition.potentialGradient !== 'function') missing.push('potentialGradient');
    for (const contact of contacts) for (const key of ['gradient', 'timeDerivative', 'accelerationBias'] as const)
      if (typeof contact[key] !== 'function') missing.push(`${contact.id}.${key}`);
    if (missing.length) throw new Error(`Smooth-domain protection requires analytic derivatives: ${missing.join(', ')}`);
  }
  /** A chord proposes a shorter trial only. Actual integration must then
   * confirm the guard root; no chord position, force, work or time is accepted. */
  private domainDuration(start: State, duration: number, failure: OutsideSmoothDomain): number {
    const value = (fraction: number) => finite(failure.guard.value(start.q.map((q, i) => q + fraction * (failure.state.q[i] - q)),
      start.t + fraction * (failure.state.t - start.t)), 'smooth-domain guard');
    if (!(value(0) > 0) || value(1) > 0) throw new Error('Smooth-domain guard must precede its domain boundary');
    let lo = 0, hi = 1;
    for (let i = 0; i < 48; i++) { const mid = (lo + hi) / 2; if (value(mid) <= 0) hi = mid; else lo = mid; }
    const next = Math.min(duration / 2, failure.elapsed * hi);
    if (!(next > 0)) throw new Error('Unresolved smooth-domain boundary');
    return next;
  }
  private smooth(s: State, dt: number, force: GeneralizedForce, active = this.active(s, force), guards: readonly FeatureGuard[] = []): Trial {
    const at = (k: Rates, h: number): State => this.incrementState(s, k.q.map(x => x * h), k.v.map(x => x * h), h);
    const rate = (state: State, fraction: number) => { this.checkDomain(state, guards, fraction * dt); return this.rates(state, force, active); };
    const a = rate(s, 0), b = rate(at(a, dt / 2), .5), c = rate(at(b, dt / 2), .5), d = rate(at(c, dt), 1);
    const weighted = (f: (r: Rates) => number) => dt / 6 * (f(a) + 2 * f(b) + 2 * f(c) + f(d));
    const state = this.incrementState(s, s.q.map((_, i) => weighted(r => r.q[i])), s.v.map((_, i) => weighted(r => r.v[i])), dt);
    this.checkDomain(state, guards, dt);
    return { state,
      input: weighted(r => r.input), boundary: weighted(r => r.boundary), damping: weighted(r => r.damping), support: this.contacts.map((_, i) => weighted(r => r.reactions[i])) };
  }
  private dense(start: State, end: State, fraction: number): State {
    const t = fraction, h = end.t - start.t, a = 2 * t ** 3 - 3 * t * t + 1, b = t ** 3 - 2 * t * t + t, c = -2 * t ** 3 + 3 * t * t, d = t ** 3 - t * t;
    return { q: start.q.map((q, i) => a * q + b * h * start.v[i] + c * end.q[i] + d * h * end.v[i]),
      v: start.v.map((v, i) => (6 * t * t - 6 * t) * (start.q[i] - end.q[i]) / h + (3 * t * t - 4 * t + 1) * v + (3 * t * t - 2 * t) * end.v[i]), t: start.t + h * t };
  }
  private firstEvents(start: State, end: State, active: readonly number[], force: GeneralizedForce, guards: readonly FeatureGuard[]): { kind: 'impact' | 'release' | 'boundary'; index: number; lo: number; hi: number }[] {
    const gaps = this.geometry(start).map(g => g.gap), held = new Set(active), separated = new Set<number>();
    const valid = guards.map(g => finite(g.value(start.q, start.t), 'feature guard'));
    // Inspect interior points: an out-and-back excursion must not rely only on
    // the final sign. The finite sampling limitation is explicit above.
    for (let k = 1; k <= 8; k++) {
      const t = k / 8, sample = this.dense(start, end, t);
      this.checkDomain(sample, guards, t * (end.t - start.t));
      const found: { kind: 'impact' | 'release' | 'boundary'; index: number; lo: number; hi: number }[] = [];
      const rates = active.length ? this.rates(sample, force, active) : null;
      for (let i = 0; i < this.contacts.length; i++) {
        const next = this.contacts[i].gap(sample.q, sample.t);
        if (held.has(i) && rates && this.opening(sample, rates, i)) found.push({ kind: 'release', index: i, lo: (k - 1) / 8, hi: t });
        if ((!held.has(i) || separated.has(i)) && next <= 0 && gaps[i] >= 0) found.push({ kind: 'impact', index: i, lo: (k - 1) / 8, hi: t });
        if (next > this.options.gapTolerance) separated.add(i);
        gaps[i] = next;
      }
      for (let i = 0; i < guards.length; i++) {
        const next = finite(guards[i].value(sample.q, sample.t), 'feature guard');
        if (next <= 0 && valid[i] >= 0) found.push({ kind: 'boundary', index: i, lo: (k - 1) / 8, hi: t });
        valid[i] = next;
      }
      if (found.length) return found;
    }
    return [];
  }
  private impulse(geometry: readonly Geometry[], restitution: number): { contacts: ContactImpulse[]; before: Vector; loss: number; boundaryWork: number } {
    const before = [...this.current.v], l = factor(this.matrix(this.current.q)), { response, a } = this.contactMatrix(geometry, l);
    const compression = complementarity(a, geometry.map(g => g.w), this.n);
    const expanded = before.map((v, j) => v + (1 + restitution) * compression.reduce((s, p, i) => s + response[i][j] * p, 0));
    const expansionNormal = geometry.map(g => dot(g.j, expanded) + g.gt);
    const correction = complementarity(a, expansionNormal, this.n);
    const p = compression.map((x, i) => (1 + restitution) * x + correction[i]);
    const change = before.map((_, j) => p.reduce((s, impulse, i) => s + response[i][j] * impulse, 0));
    this.current.v = before.map((v, j) => v + change[j]);
    // The impulse recomputes affected velocities at this accepted instant.
    // Their old integration carry cannot cross that discontinuity; unchanged
    // tangential components and all q/time carry retain their history.
    if (this.current.carry) this.current.carry = { ...this.current.carry, v: this.current.carry.v.map((c, i) => change[i] ? 0 : c) };
    const quadratic = (x: CoordinateVector) => dot(x, a.map(row => dot(row, x)));
    const loss = .5 * (1 - restitution ** 2) * quadratic(compression) + .5 * quadratic(correction);
    const boundaryWork = -dot(p, geometry.map(g => g.gt));
    this.account.impactLoss += loss; this.account.boundaryWork += boundaryWork;
    geometry.forEach((g, i) => {
      const outgoing = dot(g.j, this.current.v) + g.gt;
      if (Math.abs(outgoing) > this.options.velocityTolerance) this.established.delete(g.contact);
      else if (p[i] > 0 && g.gap <= 0) this.established.add(g.contact);
    });
    return { before, loss, boundaryWork, contacts: geometry.map((g, i) => ({ id: g.contact.id, impulse: p[i], incoming: g.w, outgoing: dot(g.j, this.current.v) + g.gt })) };
  }
  private accept(trial: Trial, support: Record<string, number>): void {
    this.current = trial.state; this.account.inputWork += trial.input; this.account.boundaryWork += trial.boundary; this.account.dampingLoss += trial.damping;
    trial.support.forEach((p, i) => { if (p) support[this.contacts[i].id] = (support[this.contacts[i].id] ?? 0) + p; });
  }
  private residual(): void { this.account.residual = this.totalEnergy - this.account.initial - this.account.inputWork - this.account.boundaryWork + this.account.dampingLoss + this.account.impactLoss; }

  /** Resolve nearby guards in time units, never by changing a guard's gap.
   * Only the incoming position/velocity/acceleration jet is examined. Force is
   * evaluated at s.t, never beyond the caller's requested interval. Guard and
   * contact formulas must admit this smooth incoming continuation. This is a
   * bounded temporal-resolution rule, not a claim of an exact zero or a bound
   * on arbitrary unresolved oscillations. An impact preceding the guard by more
   * than the declared floating-time rounding floor prevents early reporting.
   * At an interior impact, horizon=0 permits only that rounding-floor tie, not
   * eventTimeTolerance coalescing. Already held support is not a new impact. */
  private nearbyGuards(s: State, force: GeneralizedForce, guards: readonly FeatureGuard[], horizon: number): string[] {
    this.checkDomain(s, guards, 0);
    const present = guards.map(g => finite(g.value(s.q, s.t), 'feature guard'));
    const expired = guards.filter((_, i) => present[i] <= 0).map(g => g.id);
    if (expired.length || !guards.length) return expired;
    const roundoff = 8 * Number.EPSILON * Math.abs(s.t), duration = Math.max(horizon, roundoff);
    if (!duration) return [];
    const active = this.active(s, force, true), held = new Set(active);
    const acceleration = this.rates(s, force, active).v;
    const at = (h: number): State => ({ q: s.q.map((q, i) => q + s.v[i] * h + .5 * acceleration[i] * h * h), v: s.v, t: s.t + h });
    const crossing = (value: (q: CoordinateVector, time: number) => number, initial: number, limit = duration): number => {
      if (initial <= 0) return 0;
      const end = at(limit);
      if (finite(value(end.q, end.t), 'endpoint guard/contact') > 0) return Infinity;
      let lo = 0, hi = limit;
      for (let i = 0; i < 48; i++) {
        const h = (lo + hi) / 2, sample = at(h);
        if (finite(value(sample.q, sample.t), 'endpoint guard/contact') <= 0) hi = h; else lo = h;
      }
      return hi;
    };
    // Total domain guards may be sampled first outside the formula domain.
    // Cap every ordinary formula probe at the earliest such guard's zero.
    const safeHorizon = Math.min(duration, ...guards.flatMap((g, i) => g.smoothDomain ? [crossing(g.value, present[i])] : []));
    const checked = (value: (q: CoordinateVector, time: number) => number) => (q: CoordinateVector, t: number) => {
      this.checkDomain({ q: [...q], v: s.v, t }, guards, 0); return value(q, t);
    };
    const roots = guards.map((g, i) => ({ id: g.id, time: crossing(g.smoothDomain ? g.value : checked(g.value), present[i], safeHorizon) }));
    const firstGuard = Math.min(...roots.map(r => r.time));
    if (!Number.isFinite(firstGuard)) return [];
    let firstImpact = Infinity;
    for (const [i, g] of this.geometry(s).entries()) {
      if (held.has(i)) continue;
      if (g.gap <= 0) { if (g.w < -1e-13) firstImpact = 0; }
      else firstImpact = Math.min(firstImpact, crossing(checked(g.contact.gap), g.gap, safeHorizon));
    }
    if (firstImpact + roundoff < firstGuard) return [];
    return roots.filter(r => r.time <= Math.min(duration, firstImpact + roundoff)).map(r => r.id);
  }

  step(dt: number, force: GeneralizedForce = Array(this.n).fill(0)): UnilateralStep {
    return this.advanceUntil(dt, force, []);
  }

  /** Advance to the earliest guard. Collisions and releases before it are
   * processed normally; the guard stops this call
   * and returns the unused duration. Like collision detection, guard detection
   * has the explicitly bounded eight-sample swept-path resolution. At the
   * requested endpoint, a guard on the incoming trajectory within the declared
   * eventTimeTolerance may be reported early, without changing q/v/time or
   * energy. An intervening new impact takes precedence except when its ordering
   * differs only within 8 * Number.EPSILON * abs(time), the declared rounding
   * floor. The same rounding-only tie rule applies at interior impacts. */
  advanceUntil(dt: number, force: GeneralizedForce, guards: readonly FeatureGuard[]): BoundaryStep {
    if (!(dt > 0) || !Number.isFinite(dt)) throw new Error('Invalid unilateral time step');
    const end = this.current.t + dt;
    if (!Number.isFinite(end)) throw new Error('Invalid unilateral deadline');
    return this.advanceEndpoint(end, dt, force, guards);
  }

  /** Preserve one absolute deadline across feature continuations. Equality is
   * allowed: same-time guards/contacts are classified without smooth advance.
   * No subtraction/addition round trip reconstructs the caller's deadline. */
  advanceTo(end: number, force: GeneralizedForce, guards: readonly FeatureGuard[]): BoundaryStep {
    if (!Number.isFinite(end) || end < this.current.t) throw new Error('Invalid unilateral deadline');
    return this.advanceEndpoint(end, end - this.current.t, force, guards);
  }

  private advanceEndpoint(end: number, dt: number, force: GeneralizedForce, guards: readonly FeatureGuard[]): BoundaryStep {
    guards = [...guards].sort((a, b) => a.id.localeCompare(b.id));
    if (new Set(guards.map(g => g.id)).size !== guards.length) throw new Error('Feature guard IDs must be unique');
    const domainProtected = guards.some(g => !!g.smoothDomain);
    if (domainProtected) this.requireDomainDerivatives(this.contacts);
    this.domainProtected = domainProtected;
    this.featureBoundaryTime = null;
    const begin = this.current.t, events: ContactEvent[] = [], support: Record<string, number> = {}, releases: { time: number; elapsed: number; id: string }[] = [];
    let boundary: BoundaryStep['boundary'] = null;
    let substeps = 0, minGap = Infinity, domainStepLimit = this.options.maxStep;
    while (this.current.t < end - Math.max(1e-15, dt * 1e-13)) {
      this.checkDomain(this.current, guards, 0);
      const expired = guards.filter(g => finite(g.value(this.current.q, this.current.t), 'feature guard') <= 0);
      if (expired.length) { boundary = { time: this.current.t, elapsed: this.current.t - begin, ids: expired.map(g => g.id) }; break; }
      if (++substeps > this.options.maxSubsteps) throw new Error('Unilateral substep limit exceeded');
      const geometry = this.geometry(this.current);
      for (const g of geometry) { minGap = Math.min(minGap, g.gap); if (g.gap < -this.options.gapTolerance) throw new Error(`Contact penetration at ${g.contact.id}: ${g.gap}`); }
      // With topology guards, a new incoming contact at a positive gap must
      // reach its localized zero first: early capture could freeze a coincident
      // guard above zero. Established support alone retains the drift allowance.
      const closed = geometry.filter(g => g.gap <= this.gapLimit(g.contact, guards.length > 0));
      if (closed.some(g => g.w < -1e-13)) {
        const tied = guards.length ? this.nearbyGuards(this.current, force, guards, 0) : [];
        if (tied.length) { boundary = { time: this.current.t, elapsed: this.current.t - begin, ids: tied }; break; }
        const energetic = closed.some(g => g.w < -this.options.velocityTolerance);
        const hit = this.impulse(closed, energetic ? this.options.restitution : 0);
        if (energetic) {
          events.push({ time: this.current.t, elapsed: this.current.t - begin, q: [...this.current.q], before: hit.before, after: [...this.current.v], contacts: hit.contacts, loss: hit.loss, boundaryWork: hit.boundaryWork });
          if (events.length > this.options.maxEvents) throw new Error('Unilateral event limit exceeded');
        } else for (const c of hit.contacts) if (c.impulse) support[c.id] = (support[c.id] ?? 0) + c.impulse;
      }
      const start: State = { q: [...this.current.q], v: [...this.current.v], t: this.current.t, carry: this.current.carry }, active = this.active(start, force, guards.length > 0);
      // Account for clock carry when choosing the remaining duration. If its
      // rounded addition still overshoots, select the preceding representable
      // duration; no force evaluation or accepted state passes the requested end.
      let h = Math.min(domainStepLimit, (end - start.t) + (start.carry?.t ?? 0)), accepted = false;
      while (increment(start.t, start.carry?.t ?? 0, h)[0] > end) h = lowerPositive(h);
      for (let retry = 0; retry < 24; retry++) {
        try {
          let trial = this.smooth(start, h, force, active, guards);
          const crossings = this.firstEvents(start, trial.state, active, force, guards);
          let boundaryIds: string[] = [];
          if (crossings.length) {
            // Locate every candidate in the earliest bracket, not the first ID.
            // The dense interpolation only proposes a bracket; actual integrated
            // states must confirm it before an event is accepted.
            const roots: { trial: Trial; time: number; kind: 'impact' | 'release' | 'boundary'; id: string }[] = [];
            let invalid = false;
            for (const crossing of crossings) {
              const contact = this.contacts[crossing.index], guard = guards[crossing.index];
              const id = crossing.kind === 'boundary' ? guard.id : contact.id;
              const occurred = (s: State) => crossing.kind === 'boundary' ? finite(guard.value(s.q, s.t), 'feature guard') <= 0 : crossing.kind === 'impact' ? contact.gap(s.q, s.t) <= 0 : this.opening(s, this.rates(s, force, active), crossing.index);
              let lo = h * crossing.lo, hi = h * crossing.hi;
              const lower = lo ? this.smooth(start, lo, force, active, guards).state : start;
              let upper = this.smooth(start, hi, force, active, guards);
              if ((lo > 0 && occurred(lower)) || !occurred(upper.state)) { invalid = true; break; }
              const scalar = (s: State) => crossing.kind === 'boundary' ? finite(guard.value(s.q, s.t), 'feature guard') : finite(contact.gap(s.q, s.t), 'gap');
              if (crossing.kind !== 'release' && scalar(lower) > 0) {
                const root = scalarCrossing(lo, hi, scalar(lower), scalar(upper.state), upper, duration => {
                  const value = this.smooth(start, duration, force, active, guards);
                  return { value, scalar: scalar(value.state) };
                });
                lo = root.lower; hi = root.upper; upper = root.value;
              } else {
                // Release is a Boolean active-set transition, not a scalar gap.
                for (let i = 0; i < 42; i++) {
                  const mid = (lo + hi) / 2, sample = this.smooth(start, mid, force, active, guards);
                  if (occurred(sample.state)) { hi = mid; upper = sample; } else lo = mid;
                }
              }
              roots.push({ trial: upper, time: hi, kind: crossing.kind, id });
            }
            if (invalid) { h /= 2; continue; }
            roots.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
            let selected = roots[0];
            if (selected.kind === 'release') {
              // Coalesce only localized release roots within the declared time
              // resolution, never every root from a shared coarse bracket. Stop
              // at an intervening impact so no earlier collision is passed over.
              const tolerance = Math.max(this.options.eventTimeTolerance, 8 * Number.EPSILON * Math.abs(start.t + selected.time));
              for (const root of roots.slice(1)) {
                if (root.time - roots[0].time > tolerance) break;
                selected = root;
                if (root.kind !== 'release') break;
              }
            }
            trial = selected.trial;
            // A simultaneous contact root must not hide an expired feature just
            // because its contact ID sorted first. Replacement owns the outgoing
            // contact formula and its same-time impulse.
            boundaryIds = guards.filter(g => finite(g.value(trial.state.q, trial.state.t), 'feature guard') <= 0).map(g => g.id);
            // A strictly positive sub-ULP interval can still advance q to a guard
            // even when t rounds to the same representable number. The usual
            // event/substep bounds remain; no position correction is applied.
            if (roots[0].time <= (guards.length ? 0 : Math.max(1e-15, dt * 1e-14))) throw new Error(`Unresolved zero-time contact at ${roots[0].id}`);
          }
          const finalGeometry = this.geometry(trial.state), finalRates = this.rates(trial.state, force, active);
          const badGap = finalGeometry.some(g => g.gap < -this.options.gapTolerance);
          const badVelocity = active.some(i => finalRates.reactions[i] > 1e-12 && Math.abs(finalGeometry[i].w) > this.options.velocityTolerance);
          if (badGap || badVelocity) { h /= 2; continue; }
          this.accept(trial, support); for (const g of finalGeometry) minGap = Math.min(minGap, g.gap);
          // Only accepted support that started at actual closure (or support
          // already so established) can retain the ordinary drift allowance.
          // Trial/retry states never establish history. Opening releases clear it.
          this.established = new Set(active.filter(i =>
            (geometry[i].gap <= 0 || this.established.has(this.contacts[i])) &&
            finalGeometry[i].gap <= this.options.gapTolerance && Math.abs(finalGeometry[i].w) <= this.options.velocityTolerance &&
            !this.opening(trial.state, finalRates, i)).map(i => this.contacts[i]));
          // Every formerly held normal that is now opening leaves the active
          // set. Checking that set transition also catches equal-time roots on
          // different faces instead of losing all but the first sorted ID.
          for (const i of active) if (this.opening(trial.state, finalRates, i)) releases.push({ time: this.current.t, elapsed: this.current.t - begin, id: this.contacts[i].id });
          if (boundaryIds.length) boundary = { time: this.current.t, elapsed: this.current.t - begin, ids: boundaryIds };
          accepted = true; break;
        } catch (error) {
          if (!(error instanceof OutsideSmoothDomain)) throw error;
          h = this.domainDuration(start, h, error); domainStepLimit = Math.min(domainStepLimit, h);
        }
      }
      if (!accepted) throw new Error('Unable to advance without contact drift; refine geometry derivatives or the time step');
      if (boundary) break;
    }
    if (!boundary && guards.length) {
      const ids = this.nearbyGuards(this.current, force, guards, this.options.eventTimeTolerance);
      if (ids.length) boundary = { time: this.current.t, elapsed: this.current.t - begin, ids };
    }
    // Resolve a hit at the requested endpoint, unless this is a feature
    // boundary. In that case replacement must see the incoming velocity and
    // decide which outgoing surface (if any) supplies the same-time impulse.
    const geometry = this.geometry(this.current), closed = geometry.filter(g => g.gap <= this.gapLimit(g.contact, guards.length > 0));
    if (!boundary && closed.some(g => g.w < -1e-13)) {
      const energetic = closed.some(g => g.w < -this.options.velocityTolerance), hit = this.impulse(closed, energetic ? this.options.restitution : 0);
      if (energetic) {
        events.push({ time: this.current.t, elapsed: this.current.t - begin, q: [...this.current.q], before: hit.before, after: [...this.current.v], contacts: hit.contacts, loss: hit.loss, boundaryWork: hit.boundaryWork });
        if (events.length > this.options.maxEvents) throw new Error('Unilateral event limit exceeded');
      }
      else for (const c of hit.contacts) if (c.impulse) support[c.id] = (support[c.id] ?? 0) + c.impulse;
    }
    const final = this.geometry(this.current), reactions = this.rates(this.current, force, this.active(this.current, force, guards.length > 0)).reactions;
    if (boundary) this.featureBoundaryTime = this.current.t;
    for (const g of final) minGap = Math.min(minGap, g.gap);
    this.residual();
    return { elapsed: this.current.t - begin, remaining: Math.max(0, end - this.current.t), boundary, events, releases, supportImpulses: support, minGap, substeps,
      contacts: final.map((g, i) => ({ id: g.contact.id, gap: g.gap, normalVelocity: g.w, reaction: reactions[i] })) };
  }

  /** Replace formulas only at an explicit feature boundary. Geometry may not
   * teleport through a newly installed surface: penetration is rejected. A new
   * touching/closing surface receives its physical simultaneous impulse at the
   * same time, returned to the caller; every prior energy entry is retained.
   * Established support survives only for the identical contact object, never
   * merely a reused ID. New formulas must establish their own actual closure. */
  replaceContacts(contacts: readonly NormalContact[]): ContactEvent | null {
    if (this.featureBoundaryTime !== this.current.t) throw new Error('Contact replacement requires an explicit feature boundary');
    const sorted = [...contacts].sort((a, b) => a.id.localeCompare(b.id));
    if (new Set(sorted.map(c => c.id)).size !== sorted.length) throw new Error('Contact IDs must be unique');
    if (this.domainProtected) this.requireDomainDerivatives(sorted);
    const geometry = this.geometry(this.current, sorted);
    if (geometry.some(g => g.gap < -this.options.gapTolerance)) throw new Error('Replacement contact penetrates the current state');
    const previous = this.contacts, established = this.established, velocity = [...this.current.v], carry = this.current.carry, account = { ...this.account };
    this.contacts = sorted;
    this.established = new Set(sorted.filter(c => established.has(c)));
    try {
      const closed = geometry.filter(g => g.gap <= this.gapLimit(g.contact, true));
      if (!closed.some(g => g.w < -1e-13)) return null;
      const energetic = closed.some(g => g.w < -this.options.velocityTolerance), hit = this.impulse(closed, energetic ? this.options.restitution : 0);
      this.residual();
      return { time: this.current.t, elapsed: 0, q: [...this.current.q], before: hit.before, after: [...this.current.v], contacts: hit.contacts, loss: hit.loss, boundaryWork: hit.boundaryWork };
    } catch (error) {
      this.contacts = previous; this.established = established; this.current.v = velocity; this.current.carry = carry; Object.assign(this.account, account); throw error;
    }
  }
}
