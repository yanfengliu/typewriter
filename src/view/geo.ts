// Small geometry toolkit: every part of the model is built from these in assembly coordinates (metres).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Vec3 } from '../sim/vec';

export const V = (p: Vec3 | ArrayLike<number>): THREE.Vector3 => new THREE.Vector3(p[0], p[1], p[2]);

const UP = new THREE.Vector3(0, 1, 0);

/** Merge geometries that share a material into one draw call. */
export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const clean = parts.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') n.deleteAttribute(k);
    if (!n.attributes.uv) n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((n.attributes.position.count) * 2), 2));
    return n;
  });
  return clean.length === 1 ? clean[0] : mergeGeometries(clean, false)!;
}

/** Cylinder running from a to b. */
export function tube(a: Vec3, b: Vec3, radius: number, segments = 10, radiusB = radius): THREE.BufferGeometry {
  const A = V(a), B = V(b);
  const len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(radiusB, radius, len, segments, 1, false);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, B.clone().sub(A).normalize());
  g.applyQuaternion(q);
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return g;
}

/** Axis-aligned box given its centre and size. */
export function box(center: Vec3, size: Vec3): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(size[0], size[1], size[2]);
  g.translate(center[0], center[1], center[2]);
  return g;
}

/** Box from min/max corners. */
export const slab = (min: Vec3, max: Vec3): THREE.BufferGeometry =>
  box([(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2], [max[0] - min[0], max[1] - min[1], max[2] - min[2]]);

export function sphere(center: Vec3, r: number, seg = 12): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg / 2));
  g.translate(center[0], center[1], center[2]);
  return g;
}

export interface Frame2D { origin: Vec3; a: Vec3; b: Vec3 }

/**
 * Flat stamped part: a 2D outline (in the plane spanned by frame.a and frame.b through frame.origin),
 * extruded symmetrically by `thickness` along a x b. Holes are lists of points too.
 */
export function plate(outline: Array<[number, number]>, thickness: number, frame: Frame2D, holes: Array<Array<[number, number]>> = [], bevel = 0): THREE.BufferGeometry {
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 8 });
  g.translate(0, 0, -(thickness - 2 * bevel) / 2);
  const a = V(frame.a).normalize(), b = V(frame.b).normalize();
  const n = new THREE.Vector3().crossVectors(a, b).normalize();
  const m = new THREE.Matrix4().makeBasis(a, b, n).setPosition(V(frame.origin));
  g.applyMatrix4(m);
  return g;
}

/** Points of a circle, for outlines and holes. */
export function circle(cx: number, cy: number, r: number, n = 20, clockwise = false): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const t = ((clockwise ? -i : i) / n) * Math.PI * 2;
    pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
  }
  return pts;
}

/** Arc points from angle a0 to a1 (radians, counter-clockwise if a1 > a0). */
export function arc(cx: number, cy: number, r: number, a0: number, a1: number, n = 16): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const t = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
  }
  return pts;
}

/** A link "dog-bone" outline between two pivot points in 2D: a bar with rounded ends. */
export function bar2D(p: [number, number], q: [number, number], half: number, n = 6): Array<[number, number]> {
  const ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
  return [...arc(q[0], q[1], half, ang - Math.PI / 2, ang + Math.PI / 2, n), ...arc(p[0], p[1], half, ang + Math.PI / 2, ang + (3 * Math.PI) / 2, n)];
}

/** Outline of a ratchet or spur wheel. For ratchets the steep face leads in the +angle direction. */
export function toothed(teeth: number, rRoot: number, rTip: number, kind: 'ratchet' | 'spur' | 'star', phase = 0): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = phase + i * step;
    const P = (r: number, f: number): [number, number] => [r * Math.cos(a + f * step), r * Math.sin(a + f * step)];
    if (kind === 'ratchet') pts.push(P(rRoot, 0), P(rTip, 0.02), P(rTip, 0.12), P(rRoot, 0.85));
    else if (kind === 'star') pts.push(P(rRoot, -0.3), P(rTip, -0.07), P(rTip, 0.07), P(rRoot, 0.3));
    else pts.push(P(rRoot, -0.25), P(rTip, -0.12), P(rTip, 0.12), P(rRoot, 0.25));
  }
  return pts;
}

/** Surface of revolution about the line through `origin` along `axis`; profile is [radius, height] pairs. */
export function lathe(profile: Array<[number, number]>, origin: Vec3, axis: Vec3, segments = 24): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(Math.max(r, 1e-5), h)), segments);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, V(axis).normalize()));
  g.translate(origin[0], origin[1], origin[2]);
  return g;
}

/** Unit coil spring along +Y from 0 to 1 (scaled at run time to span its two anchors). */
export function coil(turns: number, radius: number, wire: number, tubular = 6): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const n = Math.round(turns * 14);
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = t * turns * Math.PI * 2;
    // Straight hooks at both ends, coils in between.
    const r = radius * Math.min(1, Math.min(t, 1 - t) * 12);
    pts.push(new THREE.Vector3(r * Math.cos(a), t, r * Math.sin(a)));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, wire, tubular, false);
}

/** Place a unit (+Y, length 1) object so that it spans from a to b. */
export function span(obj: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, tmp: THREE.Vector3): void {
  tmp.subVectors(b, a);
  const len = tmp.length() || 1e-9;
  obj.position.copy(a);
  obj.quaternion.setFromUnitVectors(UP, tmp.divideScalar(len));
  obj.scale.set(1, len, 1);
}

/** Rounded rectangle outline. */
export function roundRect(x0: number, y0: number, x1: number, y1: number, r: number, n = 5): Array<[number, number]> {
  return [
    ...arc(x1 - r, y1 - r, r, 0, Math.PI / 2, n), ...arc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, n),
    ...arc(x0 + r, y0 + r, r, Math.PI, (3 * Math.PI) / 2, n), ...arc(x1 - r, y0 + r, r, (3 * Math.PI) / 2, 2 * Math.PI, n),
  ];
}
