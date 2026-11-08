import { clamp } from './math';

/** A constrained action has one independent coordinate. Its geometry supplies
 * kinetic energy .5*M(q)*qdot², potential energy V(q), and finger travel y(q).
 * Nothing here prescribes the typebar's angle or an animation duration.
 */
export interface ActionEnergy {
  mass(q: number): number;
  potential(q: number): number;
  fingerTravel(q: number): number;
}

/** Arc length in the kinetic metric: ds/dq = sqrt(M(q)). This changes variables,
 * not the physical inertia. The constant-mass coordinate makes a discrete-work
 * integrator possible even for a strongly changing linkage mechanical advantage.
 */
export class KineticMetric {
  readonly coordinates: Float64Array;
  readonly distances: Float64Array;
  constructor(readonly energy: ActionEnergy, readonly lower: number, readonly upper: number, samples = 256) {
    if (!(upper > lower) || samples < 2) throw new Error('Invalid action coordinate bounds');
    this.coordinates = new Float64Array(samples + 1);
    this.distances = new Float64Array(samples + 1);
    const h = (upper - lower) / samples;
    const rootMass = (q: number) => {
      const mass = energy.mass(clamp(q, lower, upper));
      if (!(mass > 0) || !Number.isFinite(mass)) throw new Error('Effective inertia must be positive and finite');
      return Math.sqrt(mass);
    };
    for (let i = 0; i <= samples; i++) {
      const q = lower + i * h;
      this.coordinates[i] = q;
      if (i) this.distances[i] = this.distances[i - 1] + h / 6 * (rootMass(q - h) + 4 * rootMass(q - h / 2) + rootMass(q));
    }
  }
  private interpolate(value: number, from: Float64Array, to: Float64Array): number {
    let lo = 0, hi = from.length - 1;
    // Linear continuation outside the table permits a swept event to be located
    // at a stop. The caller must not accept a step outside its physical bounds.
    if (value <= from[0]) hi = 1;
    else if (value >= from[hi]) lo = hi - 1;
    else while (hi - lo > 1) { const mid = (lo + hi) >>> 1; if (from[mid] <= value) lo = mid; else hi = mid; }
    return to[lo] + (to[hi] - to[lo]) * (value - from[lo]) / (from[hi] - from[lo]);
  }
  distance(q: number): number { return this.interpolate(q, this.coordinates, this.distances); }
  coordinate(s: number): number { return this.interpolate(s, this.distances, this.coordinates); }
  derivative(q: number): number {
    const h = (this.upper - this.lower) * 1e-6;
    return (this.distance(q + h) - this.distance(q - h)) / (2 * h);
  }
}

export interface EnergyAccount {
  initial: number;
  inputWork: number;
  dampingLoss: number;
  impactLoss: number;
  residual: number;
}
export interface ActionStep { from: number; to: number; velocity: number; stopped: boolean; impactEnergy: number; }

/** Discrete-gradient integration, in the kinetic metric. Multiplying the
 * momentum equation by displacement gives Δ(K+V) = finger work - damping loss.
 * Unlike launching a typebar with an impulse, force does work at the key cap.
 * Contacts are unilateral stops with an explicit restitution loss.
 */
export class ConstrainedAction {
  q: number;
  private speed = 0; // ds/dt; .5*speed² is total constrained kinetic energy.
  readonly account: EnergyAccount;
  constructor(readonly metric: KineticMetric, readonly damping = 8, q = metric.lower) {
    this.q = q;
    this.account = { initial: metric.energy.potential(q), inputWork: 0, dampingLoss: 0, impactLoss: 0, residual: 0 };
  }
  get velocity(): number { return this.speed / this.metric.derivative(this.q); }
  get kinetic(): number { return .5 * this.speed * this.speed; }
  get potential(): number { return this.metric.energy.potential(this.q); }
  get totalEnergy(): number { return this.kinetic + this.potential; }
  setVelocity(qdot: number): void {
    this.speed = qdot * this.metric.derivative(this.q);
    this.account.initial = this.totalEnergy;
    this.account.inputWork = this.account.dampingLoss = this.account.impactLoss = this.account.residual = 0;
  }

  /** stop is a geometrically located contact, not a normalized animation angle.
   * A stop event is resolved in two time intervals, so work is never credited
   * for a displacement the blocked linkage did not actually make.
   */
  step(dt: number, fingerForce: number, stop = this.metric.upper, restitution = 0): ActionStep {
    if (!(dt > 0) || !Number.isFinite(dt + fingerForce)) throw new Error('Invalid force/time');
    const from = this.q;
    const trial = this.advance(dt, fingerForce, false);
    const lower = this.metric.lower;
    let target: number | null = trial.q > stop ? stop : trial.q < lower ? lower : null;
    let impactEnergy = 0;
    if (target !== null) {
      let lo = 0, hi = dt;
      for (let i = 0; i < 36; i++) {
        const mid = (lo + hi) / 2;
        const p = this.advance(mid, fingerForce, false).q;
        if (target === lower ? p < target : p > target) hi = mid; else lo = mid;
      }
      const elapsed = (lo + hi) / 2;
      this.advance(elapsed, fingerForce, true);
      this.q = target;
      const e = target === lower ? 0 : clamp(restitution, 0, 1);
      impactEnergy = this.kinetic * (1 - e * e);
      this.account.impactLoss += impactEnergy;
      this.speed = -this.speed * e;
      // An impacting finger releases; it must not do fictitious work through the
      // platen. Remaining time is a passive rebound, or rest at the felt stop.
      if (target !== lower && dt - elapsed > 1e-12) this.step(dt - elapsed, 0, stop, 0);
    } else this.advance(dt, fingerForce, true);
    this.account.residual = this.totalEnergy - this.account.initial - this.account.inputWork + this.account.dampingLoss + this.account.impactLoss;
    return { from, to: this.q, velocity: this.velocity, stopped: target !== null, impactEnergy };
  }

  private advance(dt: number, force: number, commit: boolean): { q: number; speed: number } {
    if (dt <= 1e-15) return { q: this.q, speed: this.speed };
    const metric = this.metric, energy = metric.energy;
    const s0 = metric.distance(this.q), v0 = this.speed;
    // Trials beyond a travel stop use a tangent extension solely to bracket its
    // event time. Never ask the geometry solver to close an impossible linkage.
    const evaluate = (fn: (q: number) => number, q: number): number => {
      const edge = clamp(q, metric.lower, metric.upper);
      if (q === edge) return fn(q);
      const h = (metric.upper - metric.lower) * 1e-5;
      const inside = edge === metric.lower ? edge + h : edge - h;
      return fn(edge) + (q - edge) * (fn(inside) - fn(edge)) / (inside - edge);
    };
    const potential = (q: number) => evaluate(q0 => energy.potential(q0), q);
    const travel = (q: number) => evaluate(q0 => energy.fingerTravel(q0), q);
    const V0 = potential(this.q), y0 = travel(this.q);
    const epsilon = Math.max(1e-10, metric.distances.at(-1)! * 1e-6);
    const slope = (s1: number, fn: (q: number) => number, f0: number) => {
      const ds = s1 - s0;
      return Math.abs(ds) > epsilon ? (fn(metric.coordinate(s1)) - f0) / ds :
        (fn(metric.coordinate((s0 + s1) / 2 + epsilon)) - fn(metric.coordinate((s0 + s1) / 2 - epsilon))) / (2 * epsilon);
    };
    const equation = (ds: number) => 2 * (ds / dt - v0) - dt * (
      force * slope(s0 + ds, travel, y0) - slope(s0 + ds, potential, V0) - this.damping * ds / dt
    );
    let ds = v0 * dt;
    for (let i = 0; i < 18; i++) {
      const error = equation(ds);
      if (Math.abs(error) < 1e-12) break;
      const derivative = (equation(ds + epsilon) - equation(ds - epsilon)) / (2 * epsilon);
      if (!Number.isFinite(derivative) || Math.abs(derivative) < 1e-12) throw new Error('Action integration failed to converge');
      ds -= error / derivative;
    }
    if (!Number.isFinite(ds) || Math.abs(equation(ds)) > 1e-8) throw new Error('Action integration failed to converge');
    const q = metric.coordinate(s0 + ds), speed = 2 * ds / dt - v0;
    if (commit) {
      this.account.inputWork += force * (travel(q) - y0);
      this.account.dampingLoss += this.damping * ds * ds / dt;
      this.q = q; this.speed = speed;
    }
    return { q, speed };
  }
}
