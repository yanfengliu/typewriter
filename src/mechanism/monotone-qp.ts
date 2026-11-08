/** Bounded monotone contact QP. Uncertified rank/conditioning fails explicitly.
 * Minimize .5 p'A p+b'p, p>=0, for A=J M^-1 J' positive semidefinite.
 * Feasible passive-set minimization and orthant line searches follow the
 * Lawson/Hanson active-set pattern. Dependent entering columns use an explicit
 * null-direction pivot or an unbounded dual certificate; no regularization.
 * Reference: https://netlib.org/lawson-hanson/all (NNLS.FOR).
 */
export type V = number[];
export type Matrix = V[];
export const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, x, i) => sum + x * b[i], 0);
export function cholesky(a: Matrix): Matrix {
  const n = a.length, l = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let pivot = a[i][j]; for (let k = 0; k < j; k++) pivot -= l[i][k] * l[j][k];
    if (i === j) { if (!(pivot > 1e-13 * Math.abs(a[i][i]))) throw new Error('Dependent or ill-conditioned SPD basis'); l[i][j] = Math.sqrt(pivot); }
    else l[i][j] = pivot / l[j][j];
  }
  return l;
}
export function triangular(l: Matrix, rhs: V): V {
  const x = [...rhs];
  for (let i = 0; i < x.length; i++) { for (let j = 0; j < i; j++) x[i] -= l[i][j] * x[j]; x[i] /= l[i][i]; }
  for (let i = x.length - 1; i >= 0; i--) { for (let j = i + 1; j < x.length; j++) x[i] -= l[j][i] * x[j]; x[i] /= l[i][i]; }
  return x;
}
export interface Stats { iterations: number; basisSolves: number; lineSearches: number; dependentPivots: number; maxBasis: number; minIterate: number; maxObjectiveIncrease: number; }
export type Result = { status: 'solved'; impulse: V; normal: V; stats: Stats; normalizedKkt: number }
  | { status: 'infeasible'; certificate: V; nullResidual: number; descent: number; stats: Stats };

export function monotoneQP(matrix: Matrix, rhs: V, rank: number): Result {
  const m = rhs.length;
  if (matrix.length !== m || matrix.some(row => row.length !== m) || rhs.some(x => !Number.isFinite(x))) throw new Error('Invalid QP dimensions/data');
  const scales = matrix.map((row, i) => { if (!(row[i] > 0)) throw new Error('No dynamic normal'); return Math.sqrt(row[i]); });
  const a = matrix.map((row, i) => row.map((x, j) => {
    if (!Number.isFinite(x) || Math.abs(x - matrix[j][i]) > 1e-11 * Math.max(Math.abs(x), scales[i] * scales[j])) throw new Error('Invalid nonsymmetric QP');
    return x / (scales[i] * scales[j]);
  })), b = rhs.map((x, i) => x / scales[i]), tolerance = 2e-11 * Math.max(1, ...b.map(Math.abs));
  const x = Array(m).fill(0), stats: Stats = { iterations: 0, basisSolves: 0, lineSearches: 0, dependentPivots: 0, maxBasis: 0, minIterate: 0, maxObjectiveIncrease: 0 };
  let passive: number[] = [], previousObjective = 0;
  const objective = () => .5 * dot(x, a.map(row => dot(row, x))) + dot(b, x);
  const record = () => {
    const next = objective(); stats.maxObjectiveIncrease = Math.max(stats.maxObjectiveIncrease, next - previousObjective); previousObjective = next;
    stats.minIterate = Math.min(stats.minIterate, ...x);
    if (x.some(p => p < 0 || !Number.isFinite(p))) throw new Error('Lost feasible iterate');
  };
  const basis = () => { stats.basisSolves++; stats.maxBasis = Math.max(stats.maxBasis, passive.length); return cholesky(passive.map(i => passive.map(j => a[i][j]))); };
  const bound = 20 * Math.max(1, m * m);
  const tick = () => { if (++stats.iterations > bound) throw new Error('Bounded QP iteration limit'); };
  // A face-intersection construction, not clipping a negative solution.
  const line = (direction: V, ceiling: number) => {
    stats.lineSearches++;
    const ratios = direction.map((d, i) => d < 0 ? x[i] / -d : Infinity), alpha = Math.min(ceiling, ...ratios);
    if (!Number.isFinite(alpha)) throw new Error('Unbounded feasible direction requires a certificate');
    for (let i = 0; i < m; i++) {
      if (direction[i] < 0) x[i] = ratios[i] === alpha ? 0 : x[i] * (1 - alpha / ratios[i]);
      else x[i] += alpha * direction[i];
    }
    passive = passive.filter(i => x[i] > 0); record(); return alpha;
  };
  for (;;) {
    tick();
    const gradient = a.map((row, i) => dot(row, x) + b[i]), included = new Set(passive);
    let entering = -1;
    for (let i = 0; i < m; i++) if (!included.has(i) && gradient[i] < -tolerance && (entering < 0 || gradient[i] < gradient[entering])) entering = i;
    if (entering < 0) {
      const kkt = Math.max(0, ...gradient.map(w => -w), ...passive.map(i => Math.abs(gradient[i])));
      if (kkt > 4 * tolerance) throw new Error('Uncertified final complementarity');
      const impulse = x.map((p, i) => p / scales[i]);
      return { status: 'solved', impulse, normal: matrix.map((row, i) => dot(row, impulse) + rhs[i]), stats, normalizedKkt: kkt };
    }
    if (passive.length) {
      const l = basis(), column = passive.map(i => a[i][entering]), projection = triangular(l, column), schur = a[entering][entering] - dot(column, projection);
      if (schur <= 1e-13) {
        const direction = Array(m).fill(0); direction[entering] = 1; passive.forEach((i, k) => { direction[i] = -projection[k]; });
        const residual = Math.max(...a.map(row => Math.abs(dot(row, direction)))), certificateLimit = 64 * Number.EPSILON * Math.max(1, direction.reduce((sum, d) => sum + Math.abs(d), 0));
        if (schur < -1e-11 || residual > certificateLimit) throw new Error('Dependent/ill-conditioned direction lacks a null certificate');
        if (!direction.some(d => d < 0)) {
          const descent = dot(b, direction);
          if (!(descent < -tolerance)) throw new Error('Incompatible basis without certified descent');
          return { status: 'infeasible', certificate: direction.map((d, i) => d / scales[i]), nullResidual: residual, descent, stats };
        }
        stats.dependentPivots++;
        line(direction, Infinity);
        passive.push(entering);
      } else passive.push(entering);
    } else passive.push(entering);
    if (passive.length > rank) throw new Error('Independent basis exceeds declared physical rank');
    for (;;) {
      tick();
      const optimum = triangular(basis(), passive.map(i => -b[i]));
      if (optimum.every(p => p >= 0)) {
        x.fill(0); passive.forEach((i, k) => { x[i] = optimum[k]; }); passive = passive.filter(i => x[i] > 0); record(); break;
      }
      const direction = Array(m).fill(0); passive.forEach((i, k) => { direction[i] = optimum[k] - x[i]; });
      line(direction, 1);
    }
  }
}

/** One mass factorization and a shared multi-right-hand-side response, followed
 * by one coupled QP. This is not one independent dynamics solve per key. */
export function contactSystem(mass: Matrix, normals: Matrix) {
  const factor = cholesky(mass), response = normals.map(j => triangular(factor, j));
  return { response, a: normals.map(j => response.map(r => dot(j, r))) };
}
