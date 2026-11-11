// The 44 key trains: keytop, key lever, links, sub-lever, return spring and typebar, plus the segment
// they pivot in, the rest pad they fall back on and the universal bar they push.

import * as THREE from 'three';
import type { Typewriter } from '../../sim/machine';
import {
  F, GLYPH_PITCH, KEY_FULCRUM, KeyGeom, P0, PHI_MAX, R_SEG, SHANK_REAR, SLUG, SUBLEVER, TRAVEL, U, UBAR_R, UBAR_REST_F, X,
} from '../../sim/layout';
import { Vec3, add, addScaled, rotateAbout, scale, sub, dot } from '../../sim/vec';
import { MAT, Rig } from '../rig';
import { arc, bar2D, box, circle, coil, merge, plate, tube } from '../geo';

export const UNIT_ROD = (() => { const g = new THREE.CylinderGeometry(0.00055, 0.00055, 1, 6, 1); g.translate(0, 0.5, 0); return g; })();
export const UNIT_COIL = coil(11, 0.0017, 0.00028);

/** Canvas atlas with one cell per key legend. */
export function legendAtlas(keys: KeyGeom[], extra: string[]): { texture: THREE.CanvasTexture; cell: (i: number) => [number, number, number] } {
  const n = 8, size = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = n * size;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#0b0b0c';
  g.fillRect(0, 0, cv.width, cv.height);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#efe6cf';
  const font = '"Gill Sans","Segoe UI",sans-serif';
  const draw = (i: number, lower: string, upper: string) => {
    const cx = (i % n) * size + size / 2, cy = Math.floor(i / n) * size + size / 2;
    if (lower.length > 1) { g.font = `600 ${size * 0.2}px ${font}`; g.fillText(lower.toUpperCase(), cx, cy); }
    else if (/[a-z]/.test(lower)) { g.font = `600 ${size * 0.6}px ${font}`; g.fillText(upper, cx, cy + size * 0.03); }
    else {
      g.font = `600 ${size * 0.38}px ${font}`;
      g.fillText(upper, cx, cy - size * 0.2);
      g.fillText(lower, cx, cy + size * 0.22);
    }
  };
  keys.forEach((k, i) => draw(i, k.lower, k.upper));
  extra.forEach((label, j) => draw(keys.length + j, label, label));
  const texture = new THREE.CanvasTexture(cv);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return { texture, cell: (i) => [(i % n) / n, 1 - (Math.floor(i / n) + 1) / n, 1 / n] };
}

/** Round glass-and-nickel keytop with its legend. Returns geometries grouped by material. */
export function keytop(top: Vec3, uvCell: [number, number, number], radius = 0.0068): { body: THREE.BufferGeometry; ring: THREE.BufferGeometry; face: THREE.BufferGeometry } {
  const body = new THREE.CylinderGeometry(radius, radius * 0.94, 0.004, 28);
  body.translate(top[0], top[1] - 0.002, top[2]);
  const ring = new THREE.TorusGeometry(radius + 0.0002, 0.0007, 8, 32);
  ring.rotateX(Math.PI / 2);
  ring.translate(top[0], top[1] - 0.0004, top[2]);
  const face = new THREE.CircleGeometry(radius - 0.0006, 28);
  const uv = face.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uvCell[0] + uv.getX(i) * uvCell[2], uvCell[1] + uv.getY(i) * uvCell[2]);
  face.rotateX(-Math.PI / 2);
  face.translate(top[0], top[1] + 0.00012, top[2]);
  return { body, ring, face };
}

const basis = (a: Vec3, b: Vec3, c: Vec3, o: Vec3) => new THREE.Matrix4().makeBasis(new THREE.Vector3(...a), new THREE.Vector3(...b), new THREE.Vector3(...c)).setPosition(...o);

export function buildTypeAction(rig: Rig, tw: Typewriter, legendMat: THREE.Material, cell: (i: number) => [number, number, number]): void {
  const zy = (x: number) => ({ origin: [x, 0, 0] as Vec3, a: [0, 0, 1] as Vec3, b: [0, 1, 0] as Vec3 });
  const frameSpring = rig.part('springRail', { kind: 'springRail', sys: 'frame', explode: [0, -0.02, -0.07], anchor: [0, 0.07, -0.048] });
  frameSpring.add(tube([-0.112, 0.0695, -0.048], [0.112, 0.0695, -0.048], 0.0015), MAT.steelDark);

  tw.trains.forEach((t, i) => {
    const k = t.geom, code = k.code;
    const yBar0 = KEY_FULCRUM.y - 0.0035, yBar1 = KEY_FULCRUM.y + 0.0035;
    const zt = k.top[2], yt = k.top[1];

    // --- Key lever with stem and keytop
    const lever = rig.part(`lever:${code}`, { kind: 'keyLever', sys: 'keys', body: t.lever, explode: [0, -0.035, 0.11], anchor: [k.x, yBar1, 0.07] });
    const outline: Array<[number, number]> = [
      [KEY_FULCRUM.z - 0.006, yBar0], [zt + 0.0016, yBar0], [zt + 0.0016, yt - 0.0035], [zt - 0.0016, yt - 0.0035], [zt - 0.0016, yBar1],
      [k.springLever[2] + 0.002, yBar1], [k.springLever[2], yBar1 + 0.002], [k.springLever[2] - 0.002, yBar1], [KEY_FULCRUM.z - 0.006, yBar1],
    ];
    lever.add(plate(outline, 0.0012, zy(k.x), [circle(KEY_FULCRUM.z, KEY_FULCRUM.y, 0.0012, 10, true)]), MAT.steel);
    const kt = keytop(k.top, cell(i));
    lever.add(kt.body, MAT.keyBlack);
    lever.add(kt.ring, MAT.nickel);
    lever.add(kt.face, legendMat, { shadow: false });

    // --- Sub-lever (bell crank)
    const subP = rig.part(`sub:${code}`, { kind: 'subLever', sys: 'typeaction', body: t.sub, explode: [0, -0.05, 0.03], anchor: k.subOut });
    const sx = k.subPivot[0];
    const P2 = (p: Vec3): [number, number] => [p[2], p[1]];
    subP.add(merge([
      plate(bar2D(P2(k.subPivot), P2(k.subIn), 0.0021), 0.001, zy(sx)),
      plate(bar2D(P2(k.subPivot), P2(k.subOut), 0.0021), 0.001, zy(sx)),
      plate(circle(SUBLEVER.z, SUBLEVER.y, 0.0032, 14), 0.001, zy(sx)),
    ]), MAT.steelDark);

    // --- Typebar, modelled at the platen and swung back to its rest pose
    const bar = rig.part(`bar:${code}`, { kind: 'typebar', sys: 'typeaction', body: t.bar, explode: [0, 0.075, 0.035], anchor: k.glyphLower });
    const fr = { origin: k.pivot, a: k.radial, b: F };
    const heelStrike = rotateAbout(k.heel, k.pivot, k.axis, TRAVEL);
    const hv = sub(heelStrike, k.pivot);
    const heel2: [number, number] = [dot(hv, k.radial), dot(hv, F)];
    const shank: Array<[number, number]> = [
      [0.001, SHANK_REAR], [R_SEG - 0.0015, SHANK_REAR], [R_SEG - 0.0015, SHANK_REAR + 0.0028], [0.02, SHANK_REAR + 0.0042], [0.001, SHANK_REAR + 0.0046],
    ];
    const slugCenter = add(addScaled(P0, U, GLYPH_PITCH / 2), scale(F, SLUG.depth / 2));
    const slug = new THREE.BoxGeometry(SLUG.width, GLYPH_PITCH + SLUG.below + SLUG.above, SLUG.depth);
    slug.applyMatrix4(basis(X, U, F, slugCenter));
    const toRest = new THREE.Matrix4().makeTranslation(...k.pivot)
      .multiply(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(...k.axis), -TRAVEL))
      .multiply(new THREE.Matrix4().makeTranslation(-k.pivot[0], -k.pivot[1], -k.pivot[2]));
    const barGeo = merge([
      plate(shank, 0.0011, fr),
      plate(bar2D([0, 0], heel2, 0.0022), 0.0011, fr),
      plate(circle(0, 0.0016, 0.0034, 14), 0.0011, fr, [circle(0, 0, 0.0009, 8, true)]),
    ]);
    barGeo.applyMatrix4(toRest);
    slug.applyMatrix4(toRest);
    bar.add(barGeo, MAT.steel);
    bar.add(slug, MAT.blued);

    // --- Wire links and return spring: drawn between the live positions of the points they join
    const l1 = rig.part(`link1:${code}`, { kind: 'link1', sys: 'typeaction', explode: [0, -0.042, 0.07], anchor: k.subIn });
    rig.link(l1, UNIT_ROD, MAT.wire, lever, k.leverPin, subP, k.subIn);
    const l2 = rig.part(`link2:${code}`, { kind: 'link2', sys: 'typeaction', explode: [0, 0.012, 0.032], anchor: k.heel });
    rig.link(l2, UNIT_ROD, MAT.wire, subP, k.subOut, bar, k.heel);
    const sp = rig.part(`spring:${code}`, { kind: 'keySpring', sys: 'keys', explode: [0, -0.028, 0.02], anchor: k.springAnchor });
    rig.link(sp, UNIT_COIL, MAT.spring, lever, k.springLever, frameSpring, k.springAnchor);
  });

  // --- Segment: the slotted arc all typebars pivot in
  const seg = rig.part('segment', { kind: 'segment', sys: 'typeaction', explode: [0, 0.03, 0], anchor: addScaled(P0, U, -R_SEG - 0.004) });
  const a0 = -Math.PI / 2 - PHI_MAX - 0.09, a1 = -Math.PI / 2 + PHI_MAX + 0.09;
  const rIn = R_SEG - 0.009, rOut = R_SEG + 0.008;
  const inner: Array<[number, number]> = [];
  const slotHalf = 0.0008 / R_SEG;
  const phis = tw.keys.map((k) => k.phi).sort((p, q) => q - p);
  let ang = a1;
  for (const phi of phis) {
    const c = -Math.PI / 2 + phi;
    inner.push(...arc(0, 0, rIn, ang, c + slotHalf, 2));
    inner.push([(R_SEG + 0.004) * Math.cos(c + slotHalf), (R_SEG + 0.004) * Math.sin(c + slotHalf)], [(R_SEG + 0.004) * Math.cos(c - slotHalf), (R_SEG + 0.004) * Math.sin(c - slotHalf)]);
    ang = c - slotHalf;
  }
  inner.push(...arc(0, 0, rIn, ang, a0, 2));
  const segFrame = { origin: addScaled(P0, F, 0.0015), a: X, b: U };
  seg.add(plate([...arc(0, 0, rOut, a0, a1, 48), ...inner], 0.011, segFrame), MAT.iron);
  const wire = new THREE.TorusGeometry(R_SEG, 0.0007, 6, 64, a1 - a0);
  wire.rotateZ(a0);
  wire.applyMatrix4(basis(X, U, F, P0));
  seg.add(wire, MAT.nickel);

  // --- Rest pad under the type heads
  const rest = rig.part('restPad', { kind: 'restPad', sys: 'typeaction', explode: [0, 0.03, 0.1], anchor: add(addScaled(P0, U, -R_SEG * 1.2), scale(F, 0.066)) });
  const rHead = R_SEG * (1 - Math.cos(TRAVEL)), fHead = R_SEG * Math.sin(TRAVEL);
  const padFrame = { origin: addScaled(P0, F, fHead - 0.01), a: X, b: U };
  rest.add(plate([...arc(0, 0, rHead + 0.0062, a0, a1, 40), ...arc(0, 0, rHead + 0.0032, a1, a0, 40)], 0.008, padFrame), MAT.feltGreen);
  rest.add(plate([...arc(0, 0, rHead + 0.009, a0, a1, 40), ...arc(0, 0, rHead + 0.0062, a1, a0, 40)], 0.012, padFrame), MAT.iron);

  // --- Universal bar: an arc every typebar meets shortly before the platen
  const rU = R_SEG - UBAR_R;
  const ub = rig.part('ubar', { kind: 'ubar', sys: 'escapement', body: tw.core.ubar, explode: [0, 0.02, -0.04], anchor: add(addScaled(P0, U, -rU), scale(F, UBAR_REST_F)) });
  const ubFrame = { origin: addScaled(P0, F, UBAR_REST_F - 0.0011), a: X, b: U };
  const bottom = add(addScaled(P0, U, -rU - 0.001), scale(F, UBAR_REST_F - 0.0011));
  const tip = tw.core.points.ubarTip, pin = tw.core.points.ubarPin;
  ub.add(merge([
    plate([...arc(0, 0, rU + 0.0022, a0 + 0.04, a1 - 0.04, 40), ...arc(0, 0, rU - 0.0022, a1 - 0.04, a0 + 0.04, 40)], 0.0022, ubFrame),
    tube(bottom, [0, tip[1], bottom[2] - 0.004], 0.0013),
    tube([0, tip[1], bottom[2] - 0.004], tip, 0.0013),
    tube([0, tip[1], pin[2]], [0, pin[1] - 0.002, pin[2]], 0.0011),
    box(pin, [0.004, 0.003, 0.002]),
  ]), MAT.steelDark);

  // --- Type guide at the printing point
  const guide = rig.part('typeGuide', { kind: 'typeGuide', sys: 'typeaction', explode: [0, 0.09, 0.02], anchor: P0 });
  const prong = (sx: number) => {
    const base = add(addScaled(P0, X, sx), scale(F, 0.0022));
    return tube(addScaled(base, U, -0.02), addScaled(base, U, 0.0045), 0.0007, 6);
  };
  guide.add(merge([prong(-0.0024), prong(0.0024), tube(add(addScaled(P0, U, -0.02), scale(F, 0.0022)), add(addScaled(P0, U, -0.03), scale(F, -0.004)), 0.0012, 6)]), MAT.nickel);
}
