// Geometry of the machine, in metres, shared by the physics and the 3D model.
// World frame: X to the typist's right, Y up, Z toward the typist. "Assembly coordinates" are world
// positions with every mechanism at rest (carriage at travel 0, i.e. slid fully to the right).

import { Vec3, add, addScaled, cross, dist, norm, rotate, rotateAbout, scale, sub } from './vec';

// --- Type basket -----------------------------------------------------------------------------
/** Backward lean of the segment (and of the strike direction). */
export const TILT = 0.14;
/** Unit vectors of the basket frame: U runs up the segment face, F points out of it toward the typist. */
export const X: Vec3 = [1, 0, 0];
export const U: Vec3 = [0, Math.cos(TILT), -Math.sin(TILT)];
export const F: Vec3 = [0, Math.sin(TILT), Math.cos(TILT)];
/** Printing point for lower case: where every type slug meets the paper. */
export const P0: Vec3 = [0, 0.168, -0.018];
/** Typebar length from pivot to the lower-case type face. */
export const R_SEG = 0.075;
/** Angle a typebar swings from its rest pad to the platen. */
export const TRAVEL = (100 * Math.PI) / 180;
export const PHI_MAX = (55 * Math.PI) / 180;
/** Centre distance between the two characters on a slug = how far Shift lifts the platen. */
export const GLYPH_PITCH = 0.0068;
export const SLUG = { width: 0.003, depth: 0.0035, below: 0.0034, above: 0.0034 };
/** Radius of the typebar heel, where the draw link hooks on. Its angle differs per bar (see buildKey). */
export const HEEL_R = 0.0105;
/** Radius on the typebar shank that picks up the universal bar. */
export const UBAR_R = 0.012;
export const UBAR_PICKUP = Math.asin(0.0046 / UBAR_R);
export const SHANK_REAR = 0.0005;

// --- Platen, paper, carriage -----------------------------------------------------------------
/** 24 line-space teeth x 1/6 inch = a 4 inch circumference. */
export const PLATEN_R = 0.1016 / (2 * Math.PI);
export const PLATEN_LEN = 0.262;
export const PAPER_T = 0.0001;
export const RIBBON_T = 0.00012;
export const STACK = PAPER_T + RIBBON_T;
export const PLATEN_AXIS: Vec3 = addScaled(P0, F, -(PLATEN_R + STACK));
export const CHAR_PITCH = 0.00254;
export const LINE_PITCH = 0.0254 / 6;
export const PAPER = { width: 0.2159, height: 0.2794, topMargin: 0.0254 };
/** Carriage centre X at travel c is CARRIAGE_X0 - c, so travel c puts paper column c/CHAR_PITCH under the print point. */
export const CARRIAGE_X0 = PAPER.width / 2;
export const MARGIN = { left: 10, right: 75, bellBefore: 8 };
export const RIBBON = { width: 0.013, restTop: -0.0026, lift: 0.0125 };

// --- Escapement -------------------------------------------------------------------------------
export const ESC = {
  teeth: 16,
  wheelR: 0.014,
  pinionR: (16 * CHAR_PITCH) / (2 * Math.PI),
  wheelCenter: [0, 0.1215, -0.096] as Vec3,
  pinionZ: -0.085,
  wheelT: 0.0016,
  rockerPivot: [0, 0.0795, -0.096] as Vec3,
  /** Radius from the rocker pivot to the dogs, and to where the universal bar pushes. */
  dogR: 0.028,
  pushR: 0.0235,
  /** Free play before the universal bar meets the rocker. */
  tripGap: 0.001,
  /** Dog travel (along the wheel axis) at which the loose dog leaves / the fixed dog enters the wheel. */
  looseOut: 0.0025,
  fixedIn: 0.0022,
  /** How far the loose dog springs back against the wheel's rotation once released. */
  looseBack: 0.0016,
  /** Fixed dog sits this far downstream of the loose dog's holding position ("drop"). */
  drop: 0.00015,
  /** Play of the retaining pawl that stops the wheel turning backward (measured at the rim). */
  backlash: 0.0003,
  /** The left margin stop lets the carriage overrun the first column by this much before it settles onto the dog. */
  marginOverrun: 0.35 * CHAR_PITCH,
  spaceArm: 0.02,
};
export const TOOTH_PITCH = (2 * Math.PI * ESC.wheelR) / ESC.teeth;
/** Tooth-tip travel per unit carriage travel. */
export const WHEEL_RATIO = ESC.wheelR / ESC.pinionR;
export const DRUM = { center: [-0.128, 0.098, -0.07] as Vec3, radius: 0.022 };

// --- Keyboard ---------------------------------------------------------------------------------
export const KEY_PITCH = 0.019;
export const ROW_Z = [0.101, 0.12, 0.139, 0.158];
export const ROW_Y = [0.115, 0.104, 0.093, 0.082];
export const KEY_DIP = 0.014;
export const KEY_FULCRUM = { y: 0.036, z: -0.1 };
/** Second fulcrum rod, below the key levers, for the shift frame and the space bar. */
export const AUX_FULCRUM = { y: 0.024, z: -0.02 };
export const RAILS = { y: 0.127, front: -0.052, rear: -0.08, radius: 0.003 };
export const SUBLEVER = { y: 0.05, z: 0.03, out: 0.032, dx: 0.0016 };
export const SPACE_BAR = { y: 0.071, z: 0.181, dip: 0.012, width: 0.13 };
export const SHIFT = { x: 0.1235, railZ: -0.106, railY: 0.118, dip: 0.017 };
export const BACKSPACE = { x: 0.1045 + 1.4 * KEY_PITCH, row: 0 };

const ROWS: Array<{ codes: string[]; lower: string; upper: string; offset: number }> = [
  { codes: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'], lower: '1234567890-=', upper: '!@#$%^&*()_+', offset: 0 },
  { codes: ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft'], lower: 'qwertyuiop½', upper: 'QWERTYUIOP¼', offset: 0.5 },
  { codes: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote'], lower: "asdfghjkl;'", upper: 'ASDFGHJKL:"', offset: 0.75 },
  { codes: ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash'], lower: 'zxcvbnm,./', upper: 'ZXCVBNM<>?', offset: 1.25 },
];

export interface KeyGeom {
  code: string;
  lower: string;
  upper: string;
  row: number;
  /** Index across the type basket, left to right (key levers and typebars share this order). */
  slot: number;
  x: number;
  /** Keytop centre (top surface). */
  top: Vec3;
  /** Key lever rotation at full depression. */
  keyAngle: number;
  fulcrum: Vec3;
  // Sub-lever (bell crank)
  subPivot: Vec3;
  subIn: Vec3;
  subOut: Vec3;
  subAngle: number;
  /** Where link 1 hangs from the key lever. */
  leverPin: Vec3;
  link1: number;
  link2: number;
  // Typebar
  phi: number;
  pivot: Vec3;
  axis: Vec3;
  /** Unit vector from pivot toward the print point when the bar is at the platen. */
  radial: Vec3;
  heel: Vec3;
  /** Angle of the heel from the bar's own direction, about the pivot. */
  heelAngle: number;
  /** Rest-pose points on the typebar. */
  glyphLower: Vec3;
  glyphUpper: Vec3;
  ubarPoint: Vec3;
  com: Vec3;
  springLever: Vec3;
  springAnchor: Vec3;
}

/** Move a point given in the bar's strike pose into the rest (assembly) pose. */
export const toRest = (k: { pivot: Vec3; axis: Vec3 }, p: Vec3): Vec3 => rotateAbout(p, k.pivot, k.axis, -TRAVEL);

function solve1D(f: (x: number) => number, lo: number, hi: number): number {
  let flo = f(lo);
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (lo + hi);
    const fm = f(mid);
    if ((fm > 0) === (flo > 0)) { lo = mid; flo = fm; } else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/** Kinematics of one key train: given the key-lever angle, where are the sub-lever and the typebar? */
export function trainPose(k: KeyGeom, keyAngle: number): { sub: number; bar: number } {
  const pin = rotateAbout(k.leverPin, k.fulcrum, X, keyAngle);
  const sub = solve1D((g) => dist(pin, rotateAbout(k.subIn, k.subPivot, X, g)) - k.link1, -0.2, 1.2);
  const out = rotateAbout(k.subOut, k.subPivot, X, sub);
  const bar = solve1D((b) => dist(out, rotateAbout(k.heel, k.pivot, k.axis, b)) - k.link2, -0.25, TRAVEL + 0.25);
  return { sub, bar };
}

function buildKey(code: string, lower: string, upper: string, row: number, x: number, slot: number, count: number): KeyGeom {
  const top: Vec3 = [x, ROW_Y[row], ROW_Z[row]];
  const fulcrum: Vec3 = [x, KEY_FULCRUM.y, KEY_FULCRUM.z];
  // Key lever angle for the standard key dip (the keytop moves on a circle about the fulcrum).
  const ry = top[1] - fulcrum[1], rz = top[2] - fulcrum[2];
  const keyAngle = solve1D((a) => ry - (ry * Math.cos(a) - rz * Math.sin(a)) - KEY_DIP, 0, 0.2);

  const phi = -PHI_MAX + (2 * PHI_MAX * slot) / (count - 1);
  const radial: Vec3 = add(scale(X, -Math.sin(phi)), scale(U, Math.cos(phi)));
  const pivot = addScaled(P0, radial, -R_SEG);
  const axis: Vec3 = scale(add(scale(X, Math.cos(phi)), scale(U, Math.sin(phi))), -1);
  const restDir = rotate(radial, axis, -TRAVEL);
  const perp = cross(axis, restDir);
  const ref = { pivot, axis };

  const sx = x + SUBLEVER.dx;
  const subPivot: Vec3 = [sx, SUBLEVER.y, SUBLEVER.z];
  const subOut: Vec3 = [sx, SUBLEVER.y + SUBLEVER.out, SUBLEVER.z];
  // The draw link runs from the sub-lever up to the bar's heel. Bars at the ends of the segment see the
  // link arrive from a different direction than the middle ones, so each heel is clocked to stand square
  // to its own link at mid-stroke; otherwise the outer bars would reach a dead centre before the platen.
  const heelAt = (psi: number): Vec3 => add(pivot, add(scale(restDir, HEEL_R * Math.cos(psi)), scale(perp, HEEL_R * Math.sin(psi))));
  const outMid = rotateAbout(subOut, subPivot, X, 0.22);
  let heelAngle = Math.PI * 1.2;
  for (let i = 0; i < 4; i++) {
    const d = sub(outMid, heelAt(heelAngle + TRAVEL / 2));
    heelAngle = Math.atan2(d[0] * perp[0] + d[1] * perp[1] + d[2] * perp[2], d[0] * restDir[0] + d[1] * restDir[1] + d[2] * restDir[2]) - Math.PI / 2 - TRAVEL / 2;
  }
  const heel = heelAt(heelAngle);
  const leverTop = KEY_FULCRUM.y + 0.0035;

  const k: KeyGeom = {
    code, lower, upper, row, slot, x, top, keyAngle, fulcrum,
    subPivot, subIn: subPivot, subOut, subAngle: 0, leverPin: fulcrum, link1: 0, link2: dist(subOut, heel),
    phi, pivot, axis, radial, heel, heelAngle,
    glyphLower: toRest(ref, P0),
    glyphUpper: toRest(ref, addScaled(P0, U, GLYPH_PITCH)),
    ubarPoint: toRest(ref, add(addScaled(pivot, radial, UBAR_R), scale(F, SHANK_REAR))),
    com: addScaled(pivot, restDir, 0.0515),
    springLever: [x, leverTop, KEY_FULCRUM.z + 0.06],
    springAnchor: [x, leverTop + 0.03, KEY_FULCRUM.z + 0.052],
  };
  // Choose the sub-lever input arm so that full key dip brings the type face exactly to the paper.
  const withArm = (arm: number): number => {
    k.subIn = [sx, SUBLEVER.y, SUBLEVER.z + arm];
    k.leverPin = [x, leverTop, SUBLEVER.z + arm];
    k.link1 = dist(k.subIn, k.leverPin);
    return trainPose(k, keyAngle).bar - TRAVEL;
  };
  withArm(solve1D(withArm, 0.008, 0.06));
  k.subAngle = trainPose(k, keyAngle).sub;
  return k;
}

export function buildKeys(): KeyGeom[] {
  const flat: Array<{ code: string; lower: string; upper: string; row: number; x: number }> = [];
  ROWS.forEach((r, row) => r.codes.forEach((code, i) => flat.push({ code, lower: r.lower[i], upper: r.upper[i], row, x: (i + r.offset - 5.5) * KEY_PITCH })));
  const order = [...flat].sort((a, b) => a.x - b.x);
  return flat.map((f) => buildKey(f.code, f.lower, f.upper, f.row, f.x, order.indexOf(f), flat.length));
}

/** Rest position of the universal bar's front face, measured along F from the print point. */
export const UBAR_REST_F = SHANK_REAR + UBAR_R * Math.sin(UBAR_PICKUP);
export const UBAR_TRAVEL = UBAR_REST_F - SHANK_REAR;

/** Ribbon lever: pivot behind the typebars, an upright arm pushed by the universal bar, a forward arm lifting the vibrator. */
export const RIBBON_LEVER = (() => {
  // The vibrator's stem runs just behind the plane the typebars arrive in, under the platen.
  const stemF = -0.0015, down = 0.047;
  const upArm = 0.01, liftArm = RIBBON.lift / (UBAR_TRAVEL / upArm);
  const pivot = add(addScaled(P0, F, stemF - liftArm), scale(U, -down));
  return { pivot, up: addScaled(pivot, U, upArm), lift: addScaled(pivot, F, liftArm), upArm, liftArm, stemF, down };
})();

export const norm3 = norm;
export const sub3 = sub;
