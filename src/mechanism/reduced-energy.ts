/** Compose the energy of connected bodies in independent coordinates.
 * A contribution can depend on a subset of the coordinates, but its full mass
 * block is retained: a rod carried by two mechanisms transmits inertia through
 * the off-diagonal entries. No contact state changes this mass bookkeeping.
 */
export interface EnergyContribution {
  id: string;
  coordinates: readonly number[];
  mass(local: readonly number[]): readonly (readonly number[])[];
  potential(local: readonly number[]): number;
  /** [local derivative coordinate][local row][local column]. */
  massDerivatives?(local: readonly number[]): readonly (readonly (readonly number[])[])[];
  potentialGradient?(local: readonly number[]): readonly number[];
}
interface Evaluation { mass: number[][]; derivatives: number[][][]; potential: number; gradient: number[]; }
export interface ReducedEnergyOptions {
  scales: readonly number[];
  differenceStep?: number;
  /** Per-contribution cache; exact coordinates only, never quantized poses. */
  cacheEntries?: number;
}

/** Differentiation is local to each contribution. Consequently an idle bank
 * depending only on the universal bar is not reevaluated when the carriage or
 * active key changes. This is an optimization of the same energy, not a frozen
 * inactive mechanism or a diagonal-mass approximation. */
export class ReducedEnergy {
  private readonly entries: { term: EnergyContribution; cache: Map<string, Evaluation> }[];
  private readonly n: number;
  private readonly h: number;
  private readonly capacity: number;
  private readonly scales: readonly number[];
  private lastCoordinates: number[] | null = null;
  private lastEvaluations: readonly Evaluation[] = [];
  constructor(terms: readonly EnergyContribution[], options: ReducedEnergyOptions) {
    this.scales = [...options.scales]; this.n = this.scales.length;
    this.h = options.differenceStep ?? 1e-5; this.capacity = options.cacheEntries ?? 32;
    if (!this.n || this.scales.some(x => !(x > 0) || !Number.isFinite(x)) || !(this.h > 0) || !Number.isFinite(this.h) || !Number.isInteger(this.capacity) || this.capacity < 0) throw new Error('Invalid reduced energy options');
    const ids = new Set<string>();
    this.entries = terms.map(term => {
      if (!term.id || ids.has(term.id)) throw new Error('Energy contribution IDs must be unique');
      ids.add(term.id);
      const coordinates = [...term.coordinates];
      if (new Set(coordinates).size !== coordinates.length || coordinates.some(i => !Number.isInteger(i) || i < 0 || i >= this.n)) throw new Error(`Invalid coordinates for ${term.id}`);
      return { term: { ...term, coordinates }, cache: new Map() };
    });
  }
  private check(q: readonly number[]) {
    if (q.length !== this.n) throw new Error('Invalid energy coordinates');
    // Indexed access also rejects holes: Array.some/every skip absent slots.
    for (let i = 0; i < this.n; i++) if (!Number.isFinite(q[i])) throw new Error('Invalid energy coordinates');
  }
  private evaluate(entry: typeof this.entries[number], q: readonly number[]): Evaluation {
    const { term, cache } = entry, local = term.coordinates.map(i => q[i]), key = local.join(',');
    const cached = cache.get(key);
    if (cached) { cache.delete(key); cache.set(key, cached); return cached; }
    const k = local.length;
    const copyMatrix = (raw: readonly (readonly number[])[], label: string) => {
      if (!raw || raw.length !== k) throw new Error(`Invalid ${label} for ${term.id}`);
      const copied: number[][] = [];
      for (let i = 0; i < k; i++) {
        const row = raw[i];
        if (!row || row.length !== k) throw new Error(`Invalid ${label} for ${term.id}`);
        const values: number[] = [];
        for (let j = 0; j < k; j++) {
          if (!Number.isFinite(row[j])) throw new Error(`Invalid ${label} for ${term.id}`);
          values.push(row[j]);
        }
        copied.push(values);
      }
      return copied;
    };
    const matrix = (at: readonly number[]) => {
      const m = copyMatrix(term.mass(at), 'mass block');
      for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
        if (Math.abs(m[i][j] - m[j][i]) > 1e-12 * Math.max(1, Math.abs(m[i][j]), Math.abs(m[j][i]))) throw new Error(`Asymmetric mass block for ${term.id}`);
      }
      return m;
    };
    const mass = matrix(local), potential = term.potential(local);
    const rawDerivatives = term.massDerivatives?.(local);
    let derivatives: number[][][] | undefined;
    if (rawDerivatives !== undefined) {
      if (rawDerivatives.length !== k) throw new Error(`Invalid energy derivatives for ${term.id}`);
      derivatives = [];
      for (let i = 0; i < k; i++) derivatives.push(copyMatrix(rawDerivatives[i], 'energy derivatives'));
    }
    const gradient = term.potentialGradient?.(local);
    const numericDerivatives: number[][][] = [], numericGradient: number[] = [];
    if (!derivatives || !gradient) for (let i = 0; i < k; i++) {
      const h = this.h * Math.max(this.scales[term.coordinates[i]], Math.abs(local[i])), a = [...local], b = [...local]; a[i] -= h; b[i] += h;
      if (!derivatives) { const ma = matrix(a), mb = matrix(b); numericDerivatives.push(ma.map((row, j) => row.map((x, l) => (mb[j][l] - x) / (2 * h)))); }
      if (!gradient) numericGradient.push((term.potential(b) - term.potential(a)) / (2 * h));
    }
    const result: Evaluation = { mass, derivatives: derivatives ?? numericDerivatives, potential, gradient: gradient ? [...gradient] : numericGradient };
    if (!Number.isFinite(potential) || result.gradient.length !== k || result.gradient.some(x => !Number.isFinite(x)) || result.derivatives.length !== k || result.derivatives.some(m => m.length !== k || m.some(row => row.length !== k || row.some(x => !Number.isFinite(x))))) throw new Error(`Invalid energy derivatives for ${term.id}`);
    if (this.capacity) { cache.set(key, result); if (cache.size > this.capacity) cache.delete(cache.keys().next().value!); }
    return result;
  }
  /** A force evaluation asks for mass, gradient and inertia at the same full
   * state. Reuse exact local evaluations without rebuilding every cache key.
   * Values are compared, not array identity; caller-owned q may be mutated. */
  private evaluations(q: readonly number[]): readonly Evaluation[] {
    this.check(q);
    if (this.capacity && this.lastCoordinates && q.every((x, i) => x === this.lastCoordinates![i])) return this.lastEvaluations;
    const result = this.entries.map(entry => this.evaluate(entry, q));
    // Install only a complete result. A failed contribution keeps the last
    // successful state and cannot return a mixture of two configurations.
    if (this.capacity) { this.lastCoordinates = [...q]; this.lastEvaluations = result; }
    return result;
  }
  mass(q: readonly number[]): number[][] {
    const evaluated = this.evaluations(q), out = Array.from({ length: this.n }, () => Array(this.n).fill(0));
    this.entries.forEach((entry, index) => { const e = evaluated[index], indices = entry.term.coordinates; indices.forEach((i, a) => indices.forEach((j, b) => { out[i][j] += e.mass[a][b]; })); });
    return out;
  }
  massDerivatives(q: readonly number[]): number[][][] {
    const evaluated = this.evaluations(q), out = Array.from({ length: this.n }, () => Array.from({ length: this.n }, () => Array(this.n).fill(0)));
    this.entries.forEach((entry, index) => { const e = evaluated[index], indices = entry.term.coordinates; indices.forEach((k, a) => indices.forEach((i, b) => indices.forEach((j, c) => { out[k][i][j] += e.derivatives[a][b][c]; }))); });
    return out;
  }
  potential(q: readonly number[]): number {
    return this.evaluations(q).reduce((sum, e) => sum + e.potential, 0);
  }
  potentialGradient(q: readonly number[]): number[] {
    const evaluated = this.evaluations(q), out = Array(this.n).fill(0);
    this.entries.forEach((entry, index) => { const e = evaluated[index]; entry.term.coordinates.forEach((i, a) => { out[i] += e.gradient[a]; }); });
    return out;
  }
  /** Christoffel contraction without allocating a dense n-by-n-by-n tensor.
   * Each body's local coordinates retain all cross terms. This is algebraically
   * identical to contracting massDerivatives, including moving joint carriers. */
  inertialForce(q: readonly number[], velocity: readonly number[]): number[] {
    this.check(q);
    if (velocity.length !== this.n) throw new Error('Invalid energy velocity');
    for (let i = 0; i < this.n; i++) if (!Number.isFinite(velocity[i])) throw new Error('Invalid energy velocity');
    const evaluated = this.evaluations(q), out = Array(this.n).fill(0);
    this.entries.forEach((entry, index) => {
      const e = evaluated[index], indices = entry.term.coordinates;
      indices.forEach((i, a) => indices.forEach((j, b) => indices.forEach((k, c) => {
        out[i] += (e.derivatives[c][a][b] - .5 * e.derivatives[a][b][c]) * velocity[j] * velocity[k];
      })));
    });
    return out;
  }
  clearCache() { this.entries.forEach(entry => entry.cache.clear()); this.lastCoordinates = null; this.lastEvaluations = []; }
}
