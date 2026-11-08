import { add, cross, dot, mul, norm, rotate, sub, type Vec3 } from './math';
import type { EnergyContribution } from './reduced-energy';

export interface CarriedRotorDefinition {
  id: string;
  /** Parent angle u and child angle phi relative to its moving parent. */
  coordinates: readonly [number, number];
  /** Both hinges have this unit axis. Offsets are in the zero-angle frames. */
  axis: Vec3;
  hingeOffset: Vec3;
  centerOfMass: Vec3;
  mass: number;
  /** Inertia about the COM along axis, NOT inertia about the child hinge. */
  comInertia: number;
  parentSign?: 1 | -1;
  relativeSign?: 1 | -1;
  gravity?: number;
}

/** Parallel-axis carried body. The parent hinge is fixed, the child hinge
 * translates with the parent, and the child orientation composes both angles.
 * No equation constrains phi to follow u. Parent hardware belongs in its own
 * energy entry; this entry counts only the child's actual solid mass. */
export function carriedRotorEnergy(d: CarriedRotorDefinition): EnergyContribution {
  const { axis, hingeOffset: h, centerOfMass: c, mass: m, comInertia: inertia } = d;
  const a = d.parentSign ?? -1, b = d.relativeSign ?? 1, gravity = d.gravity ?? 9.80665;
  if ([...axis, ...h, ...c, m, inertia, gravity].some(x => !Number.isFinite(x)) || Math.abs(norm(axis) - 1) > 1e-12 || !(m > 0) || inertia < 0 || gravity < 0 || ![1, -1].includes(a) || ![1, -1].includes(b)) throw new Error('Invalid carried rotor');
  const at = ([u, phi]: readonly number[]) => {
    const parent = rotate(h, axis, a * u), child = rotate(c, axis, a * u + b * phi);
    const jacobian = [mul(cross(axis, add(parent, child)), a), mul(cross(axis, child), b)];
    const curvature = cross(axis, cross(axis, child));
    return { parent, child, jacobian, derivative: [mul(curvature, a * b), mul(curvature, b * b)] };
  };
  return {
    id: d.id, coordinates: d.coordinates,
    mass: q => {
      const { jacobian: j } = at(q), rate = [a, b];
      return j.map((left, i) => j.map((right, k) => m * dot(left, right) + inertia * rate[i] * rate[k]));
    },
    massDerivatives: q => {
      const { jacobian: j, derivative: dj } = at(q);
      // A shared rigid rotation leaves all velocity inner products unchanged.
      return [[[0, 0], [0, 0]], j.map((left, i) => j.map((right, k) => m * (dot(dj[i], right) + dot(left, dj[k]))))];
    },
    potential: q => { const p = at(q); return m * gravity * add(sub(p.parent, h), sub(p.child, c))[1]; },
    potentialGradient: q => at(q).jacobian.map(j => m * gravity * j[1]),
  };
}
