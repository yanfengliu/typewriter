/** Small allocation-friendly geometry primitives. Metres, radians, seconds. */
export type Vec3 = readonly [number, number, number];
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a: Vec3) => Math.hypot(...a);
export const distance = (a: Vec3, b: Vec3) => norm(sub(a, b));
export const unit = (a: Vec3): Vec3 => { const n = norm(a); if (n < 1e-12) throw new Error('A joint axis must have a direction'); return mul(a, 1 / n); };
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const rotate = (v: Vec3, axis: Vec3, angle: number): Vec3 => {
  const c = Math.cos(angle), s = Math.sin(angle);
  return add(add(mul(v, c), mul(cross(axis, v), s)), mul(axis, dot(axis, v) * (1 - c)));
};
export const hingePoint = (pivot: Vec3, axis: Vec3, arm: Vec3, angle: number): Vec3 => add(pivot, rotate(arm, axis, angle));
export const unwrap = (angle: number, near: number) => angle + Math.round((near - angle) / (2 * Math.PI)) * 2 * Math.PI;

export interface Hinge { pivot: Vec3; axis: Vec3; }
export interface LinkClosure { angle: number; error: number; reachable: boolean; singular: boolean; }

/** Exact rod-length constraint between an input point and a hinged follower.
 * Select the assembly branch nearest the prior valid angle, not a keyframed pose.
 */
export function closeLink(input: Vec3, follower: Hinge, arm: Vec3, length: number, near: number): LinkClosure {
  const along = mul(follower.axis, dot(follower.axis, arm));
  const radial = sub(arm, along), tangent = cross(follower.axis, radial);
  const d = sub(input, add(follower.pivot, along));
  const a = dot(d, radial), b = dot(d, tangent);
  const amplitude = Math.hypot(a, b);
  if (amplitude < 1e-15) {
    const error = Math.abs(distance(input, hingePoint(follower.pivot, follower.axis, arm, near)) - length);
    // A coaxial endpoint can satisfy the rod at every angle. It is reachable but
    // underconstrained; an action solver must not mistake this for a drive ratio.
    return { angle: near, error, reachable: error <= 1e-10, singular: true };
  }
  const c = (dot(d, d) + dot(radial, radial) - length * length) / (2 * amplitude);
  const phase = Math.atan2(b, a), swing = Math.acos(clamp(c, -1, 1));
  const a0 = unwrap(phase + swing, near), a1 = unwrap(phase - swing, near);
  const angle = Math.abs(a0 - near) < Math.abs(a1 - near) ? a0 : a1;
  const error = Math.abs(distance(input, hingePoint(follower.pivot, follower.axis, arm, angle)) - length);
  return { angle, error, reachable: Math.abs(c) <= 1 + 1e-10, singular: Math.abs(Math.abs(c) - 1) < 1e-10 };
}

/** Locate a contact in a monotone approach interval supplied by the caller.
 * This is a root refiner, not a general collision detector for arbitrary paths.
 */
export function firstContact(a: number, b: number, clearance: (q: number) => number): number | null {
  if (clearance(a) <= 0) return a;
  if (clearance(b) > 0) return null;
  let lo = a, hi = b;
  for (let j = 0; j < 40; j++) { const mid = (lo + hi) / 2; if (clearance(mid) > 0) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
