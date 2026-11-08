/** Small reduced-coordinate, frictionless unilateral dynamics.
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
  /** Release roots this many seconds apart may share a reported event time. */
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
export interface UnilateralEnergy {
  initial: number; inputWork: number; boundaryWork: number;
  dampingLoss: number; impactLoss: number; residual: number;
}

type Vector = number[];
type Matrix = Vector[];
interface State { q: Vector; v: Vector; t: number; }
interface Geometry { contact: NormalContact; gap: number; j: Vector; gt: number; w: number; }
interface Rates { q: Vector; v: Vector; input: number; boundary: number; damping: number; reactions: Vector; }
interface Trial { state: State; input: number; boundary: number; damping: number; support: Vector; }
const dot = (a: CoordinateVector, b: CoordinateVector) => a.reduce((s, x, i) => s + x * b[i], 0);
const add = (a: CoordinateVector, b: CoordinateVector, scale = 1): Vector => a.map((x, i) => x + scale * b[i]);
const finite = (x: number, label: string): number => { if (!Number.isFinite(x)) throw new Error(`Nonfinite ${label}`); return x; };
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
  if (n > 12) throw new Error('More than 12 simultaneous candidate contacts');
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
  private readonly contacts: readonly NormalContact[];

  constructor(readonly definition: UnilateralDefinition, initial: UnilateralState, options: UnilateralOptions = {}) {
    this.n = initial.q.length;
    if (this.n < 1 || this.n > 7) throw new Error('UnilateralSystem requires 1–7 dynamic coordinates');
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
  private geometry(s: State): Geometry[] {
    return this.contacts.map(contact => { const j = this.normal(contact, s.q, s.t), gt = this.timeDerivative(contact, s.q, s.t);
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
  private active(s: State, force: GeneralizedForce): number[] {
    const candidates = this.geometry(s).flatMap((g, i) => g.gap <= this.options.gapTolerance && Math.abs(g.w) <= this.options.velocityTolerance ? [i] : []);
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
  private smooth(s: State, dt: number, force: GeneralizedForce, active = this.active(s, force)): Trial {
    const at = (k: Rates, h: number): State => ({ q: add(s.q, k.q, h), v: add(s.v, k.v, h), t: s.t + h });
    const a = this.rates(s, force, active), b = this.rates(at(a, dt / 2), force, active), c = this.rates(at(b, dt / 2), force, active), d = this.rates(at(c, dt), force, active);
    const weighted = (f: (r: Rates) => number) => dt / 6 * (f(a) + 2 * f(b) + 2 * f(c) + f(d));
    return { state: { q: s.q.map((x, i) => x + weighted(r => r.q[i])), v: s.v.map((x, i) => x + weighted(r => r.v[i])), t: s.t + dt },
      input: weighted(r => r.input), boundary: weighted(r => r.boundary), damping: weighted(r => r.damping), support: this.contacts.map((_, i) => weighted(r => r.reactions[i])) };
  }
  private dense(start: State, end: State, fraction: number): State {
    const t = fraction, h = end.t - start.t, a = 2 * t ** 3 - 3 * t * t + 1, b = t ** 3 - 2 * t * t + t, c = -2 * t ** 3 + 3 * t * t, d = t ** 3 - t * t;
    return { q: start.q.map((q, i) => a * q + b * h * start.v[i] + c * end.q[i] + d * h * end.v[i]),
      v: start.v.map((v, i) => (6 * t * t - 6 * t) * (start.q[i] - end.q[i]) / h + (3 * t * t - 4 * t + 1) * v + (3 * t * t - 2 * t) * end.v[i]), t: start.t + h * t };
  }
  private firstEvents(start: State, end: State, active: readonly number[], force: GeneralizedForce): { kind: 'impact' | 'release'; index: number; lo: number; hi: number }[] {
    const gaps = this.geometry(start).map(g => g.gap), held = new Set(active), separated = new Set<number>();
    // Inspect interior points: an out-and-back excursion must not rely only on
    // the final sign. The finite sampling limitation is explicit above.
    for (let k = 1; k <= 8; k++) {
      const t = k / 8, sample = this.dense(start, end, t);
      const found: { kind: 'impact' | 'release'; index: number; lo: number; hi: number }[] = [];
      const rates = active.length ? this.rates(sample, force, active) : null;
      for (let i = 0; i < this.contacts.length; i++) {
        const next = this.contacts[i].gap(sample.q, sample.t);
        if (held.has(i) && rates && this.opening(sample, rates, i)) found.push({ kind: 'release', index: i, lo: (k - 1) / 8, hi: t });
        if ((!held.has(i) || separated.has(i)) && next <= 0 && gaps[i] >= 0) found.push({ kind: 'impact', index: i, lo: (k - 1) / 8, hi: t });
        if (next > this.options.gapTolerance) separated.add(i);
        gaps[i] = next;
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
    this.current.v = before.map((v, j) => v + p.reduce((s, impulse, i) => s + response[i][j] * impulse, 0));
    const quadratic = (x: CoordinateVector) => dot(x, a.map(row => dot(row, x)));
    const loss = .5 * (1 - restitution ** 2) * quadratic(compression) + .5 * quadratic(correction);
    const boundaryWork = -dot(p, geometry.map(g => g.gt));
    this.account.impactLoss += loss; this.account.boundaryWork += boundaryWork;
    return { before, loss, boundaryWork, contacts: geometry.map((g, i) => ({ id: g.contact.id, impulse: p[i], incoming: g.w, outgoing: dot(g.j, this.current.v) + g.gt })) };
  }
  private accept(trial: Trial, support: Record<string, number>): void {
    this.current = trial.state; this.account.inputWork += trial.input; this.account.boundaryWork += trial.boundary; this.account.dampingLoss += trial.damping;
    trial.support.forEach((p, i) => { if (p) support[this.contacts[i].id] = (support[this.contacts[i].id] ?? 0) + p; });
  }
  private residual(): void { this.account.residual = this.totalEnergy - this.account.initial - this.account.inputWork - this.account.boundaryWork + this.account.dampingLoss + this.account.impactLoss; }

  step(dt: number, force: GeneralizedForce = Array(this.n).fill(0)): UnilateralStep {
    if (!(dt > 0) || !Number.isFinite(dt)) throw new Error('Invalid unilateral time step');
    const begin = this.current.t, end = begin + dt, events: ContactEvent[] = [], support: Record<string, number> = {}, releases: { time: number; elapsed: number; id: string }[] = [];
    let substeps = 0, minGap = Infinity;
    while (this.current.t < end - Math.max(1e-15, dt * 1e-13)) {
      if (++substeps > this.options.maxSubsteps) throw new Error('Unilateral substep limit exceeded');
      const geometry = this.geometry(this.current);
      for (const g of geometry) { minGap = Math.min(minGap, g.gap); if (g.gap < -this.options.gapTolerance) throw new Error(`Contact penetration at ${g.contact.id}: ${g.gap}`); }
      const closed = geometry.filter(g => g.gap <= this.options.gapTolerance);
      if (closed.some(g => g.w < -1e-13)) {
        const energetic = closed.some(g => g.w < -this.options.velocityTolerance);
        const hit = this.impulse(closed, energetic ? this.options.restitution : 0);
        if (energetic) {
          events.push({ time: this.current.t, elapsed: this.current.t - begin, q: [...this.current.q], before: hit.before, after: [...this.current.v], contacts: hit.contacts, loss: hit.loss, boundaryWork: hit.boundaryWork });
          if (events.length > this.options.maxEvents) throw new Error('Unilateral event limit exceeded');
        } else for (const c of hit.contacts) if (c.impulse) support[c.id] = (support[c.id] ?? 0) + c.impulse;
      }
      const start: State = { q: [...this.current.q], v: [...this.current.v], t: this.current.t }, active = this.active(start, force);
      let h = Math.min(this.options.maxStep, end - start.t), accepted = false;
      for (let retry = 0; retry < 24; retry++) {
        let trial = this.smooth(start, h, force, active);
        const crossings = this.firstEvents(start, trial.state, active, force);
        if (crossings.length) {
          // Locate every candidate in the earliest bracket, not the first ID.
          // The dense interpolation only proposes a bracket; actual integrated
          // states must confirm it before an event is accepted.
          const roots: { trial: Trial; time: number; kind: 'impact' | 'release'; id: string }[] = [];
          let invalid = false;
          for (const crossing of crossings) {
            const contact = this.contacts[crossing.index];
            const occurred = (s: State) => crossing.kind === 'impact' ? contact.gap(s.q, s.t) <= 0 : this.opening(s, this.rates(s, force, active), crossing.index);
            let lo = h * crossing.lo, hi = h * crossing.hi;
            const lower = lo ? this.smooth(start, lo, force, active).state : start;
            let upper = this.smooth(start, hi, force, active);
            if ((lo > 0 && occurred(lower)) || !occurred(upper.state)) { invalid = true; break; }
            for (let i = 0; i < 42; i++) {
              const mid = (lo + hi) / 2, sample = this.smooth(start, mid, force, active);
              if (occurred(sample.state)) { hi = mid; upper = sample; } else lo = mid;
            }
            roots.push({ trial: upper, time: hi, kind: crossing.kind, id: contact.id });
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
              if (root.kind === 'impact') break;
            }
          }
          trial = selected.trial;
          if (roots[0].time <= Math.max(1e-15, dt * 1e-14)) throw new Error(`Unresolved zero-time contact at ${roots[0].id}`);
        }
        const finalGeometry = this.geometry(trial.state), finalRates = this.rates(trial.state, force, active);
        const badGap = finalGeometry.some(g => g.gap < -this.options.gapTolerance);
        const badVelocity = active.some(i => finalRates.reactions[i] > 1e-12 && Math.abs(finalGeometry[i].w) > this.options.velocityTolerance);
        if (badGap || badVelocity) { h /= 2; continue; }
        this.accept(trial, support); for (const g of finalGeometry) minGap = Math.min(minGap, g.gap);
        // Every formerly held normal that is now opening leaves the active
        // set. Checking that set transition also catches equal-time roots on
        // different faces instead of losing all but the first sorted ID.
        for (const i of active) if (this.opening(trial.state, finalRates, i)) releases.push({ time: this.current.t, elapsed: this.current.t - begin, id: this.contacts[i].id });
        accepted = true; break;
      }
      if (!accepted) throw new Error('Unable to advance without contact drift; refine geometry derivatives or the time step');
    }
    // Resolve a hit exactly at the requested endpoint in this call.
    const geometry = this.geometry(this.current), closed = geometry.filter(g => g.gap <= this.options.gapTolerance);
    if (closed.some(g => g.w < -1e-13)) {
      const energetic = closed.some(g => g.w < -this.options.velocityTolerance), hit = this.impulse(closed, energetic ? this.options.restitution : 0);
      if (energetic) {
        events.push({ time: this.current.t, elapsed: this.current.t - begin, q: [...this.current.q], before: hit.before, after: [...this.current.v], contacts: hit.contacts, loss: hit.loss, boundaryWork: hit.boundaryWork });
        if (events.length > this.options.maxEvents) throw new Error('Unilateral event limit exceeded');
      }
      else for (const c of hit.contacts) if (c.impulse) support[c.id] = (support[c.id] ?? 0) + c.impulse;
    }
    const final = this.geometry(this.current), reactions = this.rates(this.current, force, this.active(this.current, force)).reactions;
    this.residual();
    return { elapsed: this.current.t - begin, events, releases, supportImpulses: support, minGap, substeps,
      contacts: final.map((g, i) => ({ id: g.contact.id, gap: g.gap, normalVelocity: g.w, reaction: reactions[i] })) };
  }
}
