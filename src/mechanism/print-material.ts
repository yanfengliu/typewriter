/** A declared normal material model for the ribbon/paper/platen stack. These
 * parameters are estimates, not measurements from the Royal service manual. */
export interface PrintMaterialParameters {
  /** N / m^exponent. */
  stiffness: number;
  exponent: number;
  /** s/m; nonnegative Hunt–Crossley damping coefficient. */
  damping: number;
  /** m² of declared apparent contact area, not inferred microscopic glyph area. */
  area: number;
}
export const ESTIMATED_PRINT_MATERIAL: Readonly<PrintMaterialParameters> = Object.freeze({
  stiffness: 8e6, exponent: 1.5, damping: .3,
  // Fitted 1.9 × 2.6 mm face envelope. Actual raised-letter area is different.
  area: .0019 * .0026,
});
export interface PrintMaterialResponse {
  normalForce: number;
  elasticForce: number;
  /** Signed: negative during unloading, including the non-tension cutoff. */
  dissipativeForce: number;
  storedEnergy: number;
  lossRate: number;
  /** Pa = normal force / the declared apparent area. */
  pressure: number;
}
const finite = (value: number) => typeof value === 'number' && Number.isFinite(value);
function requireFinite(value: number, name: string) { if (!finite(value)) throw new RangeError(`${name} must be finite`); }
function requirePositive(value: number, name: string) { if (!finite(value) || value <= 0) throw new RangeError(`${name} must be finite and positive`); }
function requireNonnegative(value: number, name: string) { if (!finite(value) || value < 0) throw new RangeError(`${name} must be finite and nonnegative`); }

/** Positive indentation/speed mean stack compression/closing. No ring reaction
 * or total machine loss appears in this law. The unilateral cutoff is passive:
 * F=max(0,k δ^n(1+α δdot)), U=k δ^(n+1)/(n+1),
 * loss=(F−k δ^n) δdot >=0. Fast unloading can remove stored energy as loss while
 * F is zero; it never creates an adhesive/tensile force. n<1 is allowed but has
 * a singular tangent stiffness at zero, which an integrating solver must handle. */
export function evaluatePrintMaterial(indentation: number, closingSpeed: number, parameters: PrintMaterialParameters = ESTIMATED_PRINT_MATERIAL): PrintMaterialResponse {
  requireFinite(indentation, 'Indentation'); requireFinite(closingSpeed, 'Closing speed');
  requirePositive(parameters.stiffness, 'Stiffness'); requirePositive(parameters.exponent, 'Exponent');
  requireNonnegative(parameters.damping, 'Damping'); requirePositive(parameters.area, 'Apparent contact area');
  if (indentation <= 0) return { normalForce: 0, elasticForce: 0, dissipativeForce: 0, storedEnergy: 0, lossRate: 0, pressure: 0 };
  const elasticForce = parameters.stiffness * indentation ** parameters.exponent;
  const normalForce = elasticForce * Math.max(0, 1 + parameters.damping * closingSpeed);
  const dissipativeForce = normalForce - elasticForce;
  const storedEnergy = (elasticForce / (parameters.exponent + 1)) * indentation;
  const lossRate = dissipativeForce === 0 ? 0 : dissipativeForce * closingSpeed;
  const pressure = normalForce / parameters.area;
  const response = { normalForce, elasticForce, dissipativeForce, storedEnergy, lossRate, pressure };
  for (const [name, value] of Object.entries(response)) requireFinite(value, `Computed ${name}`);
  return response;
}

export interface PressureSample {
  time: number;
  /** SI material coordinates across/down from the sheet's top-left. */
  u: number;
  v: number;
  /** Pa, from this printing stack's own normal force and declared area. */
  pressure: number;
}
export interface PressureExposureOptions {
  /** Pa; a transfer-model estimate, not a source-measured material property. */
  pressureThreshold?: number;
  maxSamples?: number;
  maxDuration?: number;
}
export interface PressureExposureSummary {
  /** Pa s. No threshold subtraction: only this is raw pressure-time exposure. */
  pressureTime: number;
  /** Pa s above the declared threshold. This is not a normal impulse. */
  excessPressureTime: number;
  centroid: Readonly<{ u: number; v: number }> | null;
  covariance: Readonly<{ uu: number; uv: number; vv: number }>;
  rmsRadius: number;
  firstTime: number | null;
  lastTime: number | null;
  samples: number;
  maxSampleGap: number;
  limits: Readonly<Required<PressureExposureOptions>>;
  /** Change after removing supplied intermediate samples in disjoint triples.
   * An observed refinement indicator, NOT an error bound for unsampled history. */
  observedRefinement: Readonly<{ comparisons: number; pressureTimeDifference: number; excessPressureTimeDifference: number }>;
  /** Endpoints cannot bound arbitrary unsampled pressure/trajectory histories. */
  interpolationErrorBound: null;
  finished: boolean;
}

type Moments = { weight: number; u: number; v: number; uu: number; uv: number; vv: number };
// Preserve constant material positions exactly, rather than introducing tiny
// fictitious spread from two separately rounded weighted copies of one value.
const lerp = (a: number, b: number, t: number) => a === b ? a : (1 - t) * a + t * b;
function segmentBounds(a: PressureSample, b: PressureSample, threshold: number): readonly [number, number] {
  const p = a.pressure - threshold, q = b.pressure - threshold;
  if (p <= 0 && q <= 0) return [0, 0];
  if (p >= 0 && q >= 0) return [0, 1];
  // This split is numerical quadrature of the declared linear interpolation,
  // not an inferred exact physical contact event or a solver timestamp.
  const crossing = -p / (q - p);
  return p < 0 ? [crossing, 1] : [0, crossing];
}
function segmentExposure(a: PressureSample, b: PressureSample, threshold: number) {
  const dt = b.time - a.time, [lo, hi] = segmentBounds(a, b, threshold);
  return { raw: dt * (a.pressure / 2 + b.pressure / 2), excess: dt * (hi - lo) * (Math.max(0, lerp(a.pressure, b.pressure, lo) - threshold) / 2 + Math.max(0, lerp(a.pressure, b.pressure, hi) - threshold) / 2) };
}
function addMoment(m: Moments, weight: number, u: number, v: number) {
  if (weight === 0) return;
  const total = m.weight + weight;
  if (m.weight === 0) { m.weight = weight; m.u = u; m.v = v; return; }
  const du = u - m.u, dv = v - m.v, fraction = weight / total, correction = weight * (m.weight / total);
  m.uu += correction * du * du; m.uv += correction * du * dv; m.vv += correction * dv * dv;
  m.u += fraction * du; m.v += fraction * dv; m.weight = total;
}
function normalizeMoments(m: Moments) {
  const centroid = m.weight > 0 ? Object.freeze({ u: m.u, v: m.v }) : null;
  const covariance = Object.freeze({ uu: m.weight ? m.uu / m.weight : 0, uv: m.weight ? m.uv / m.weight : 0, vv: m.weight ? m.vv / m.weight : 0 });
  for (const value of Object.values(covariance)) requireFinite(value, 'Computed pressure covariance');
  // This is anchor-motion spread; the finite glyph footprint is not added.
  const rmsRadius = Math.hypot(Math.sqrt(covariance.uu), Math.sqrt(covariance.vv));
  requireFinite(rmsRadius, 'Computed pressure RMS radius');
  return { centroid, covariance, rmsRadius };
}

/** O(1) storage, O(samples) work for ONE caller-delimited supported episode.
 * Samples must be exact supplied solved observations; pressure/trajectory between
 * them is explicitly approximated as linear. Two positive Gauss points integrate
 * its first/second material moments exactly, including linear threshold splits.
 * No missing contact events are invented, and zero pressure does not end an
 * episode (the unilateral damping cutoff can give zero while still indented).
 * Same-time left/right pressure limits at an identical position add no exposure;
 * the right limit starts the next interval, as needed at an instantaneous impact.
 * This is mechanical exposure/footprint data, not an ink-density calibration. */
export class PressureExposure {
  readonly limits: Readonly<Required<PressureExposureOptions>>;
  private previous: PressureSample | undefined;
  private firstTime: number | null = null;
  private samples = 0;
  private pressureTime = 0;
  private maxGap = 0;
  private moments: Moments = { weight: 0, u: 0, v: 0, uu: 0, uv: 0, vv: 0 };
  private coarseBase: PressureSample | undefined;
  private coarseMid: PressureSample | undefined;
  private refinement = { comparisons: 0, pressureTimeDifference: 0, excessPressureTimeDifference: 0 };
  private finished = false;
  constructor(options: PressureExposureOptions = {}) {
    const limits = { pressureThreshold: 0, maxSamples: 4096, maxDuration: .5, ...options };
    requireNonnegative(limits.pressureThreshold, 'Pressure threshold'); requirePositive(limits.maxSamples, 'Sample limit'); requirePositive(limits.maxDuration, 'Episode duration limit');
    if (!Number.isInteger(limits.maxSamples)) throw new RangeError('Sample limit must be an integer');
    this.limits = Object.freeze(limits);
  }
  add(sample: PressureSample): void {
    if (this.finished) throw new Error('A finished pressure episode cannot accept more samples');
    for (const name of ['time', 'u', 'v'] as const) requireFinite(sample[name], `Sample ${name}`);
    requireNonnegative(sample.pressure, 'Sample pressure');
    if (this.samples >= this.limits.maxSamples) throw new RangeError('Pressure episode exceeded its sample limit');
    if (this.firstTime !== null && sample.time - this.firstTime > this.limits.maxDuration) throw new RangeError('Pressure episode exceeded its duration limit');
    const b = { time: sample.time, u: sample.u, v: sample.v, pressure: sample.pressure }, a = this.previous;
    if (a && b.time < a.time) throw new RangeError('Pressure samples must not go backwards in time');
    if (a && b.time === a.time && (a.u !== b.u || a.v !== b.v)) throw new RangeError('Same-time pressure limits must have identical material positions');
    const moments = { ...this.moments }, refinement = { ...this.refinement };
    let pressureTime = this.pressureTime, maxGap = this.maxGap, coarseBase = this.coarseBase, coarseMid = this.coarseMid;
    if (a && b.time > a.time) {
      const dt = b.time - a.time, [lo, hi] = segmentBounds(a, b, this.limits.pressureThreshold);
      pressureTime += segmentExposure(a, b, this.limits.pressureThreshold).raw; maxGap = Math.max(maxGap, dt);
      for (const sign of [-1, 1]) {
        const t = (lo + hi) / 2 + sign * (hi - lo) / (2 * Math.sqrt(3));
        const weight = Math.max(0, lerp(a.pressure, b.pressure, t) - this.limits.pressureThreshold) * dt * (hi - lo) / 2;
        addMoment(moments, weight, lerp(a.u, b.u, t), lerp(a.v, b.v, t));
      }
      if (coarseBase && coarseMid) {
        const first = segmentExposure(coarseBase, coarseMid, this.limits.pressureThreshold), second = segmentExposure(coarseMid, b, this.limits.pressureThreshold), coarse = segmentExposure(coarseBase, b, this.limits.pressureThreshold);
        refinement.comparisons++; refinement.pressureTimeDifference += Math.abs(first.raw + second.raw - coarse.raw); refinement.excessPressureTimeDifference += Math.abs(first.excess + second.excess - coarse.excess);
        coarseBase = b; coarseMid = undefined;
      } else { coarseBase ??= a; coarseMid = b; }
    } else {
      // Never compare a coarse interpolant across a declared discontinuity.
      coarseBase = b; coarseMid = undefined;
    }
    for (const value of [pressureTime, maxGap, ...Object.values(moments), ...Object.values(refinement)]) requireFinite(value, 'Computed pressure exposure');
    // Finite raw moments can still overflow when divided by a small weight.
    // Validate the prospective public summary before committing any state.
    normalizeMoments(moments);
    this.previous = b; this.firstTime ??= b.time; this.samples++; this.pressureTime = pressureTime; this.maxGap = maxGap; this.moments = moments; this.refinement = refinement; this.coarseBase = coarseBase; this.coarseMid = coarseMid;
  }
  summary(): Readonly<PressureExposureSummary> {
    const m = this.moments, { centroid, covariance, rmsRadius } = normalizeMoments(m);
    return Object.freeze({ pressureTime: this.pressureTime, excessPressureTime: m.weight, centroid, covariance, rmsRadius, firstTime: this.firstTime,
      lastTime: this.previous?.time ?? null, samples: this.samples, maxSampleGap: this.maxGap, limits: this.limits, observedRefinement: Object.freeze({ ...this.refinement }), interpolationErrorBound: null, finished: this.finished });
  }
  finish(): Readonly<PressureExposureSummary> {
    const result = Object.freeze({ ...this.summary(), finished: true });
    this.finished = true;
    return result;
  }
}
