// Escapement, carriage, platen, line-space lever, mainspring drum and bell.

import * as THREE from 'three';
import type { Typewriter } from '../../sim/machine';
import { CARRIAGE_X0, CHAR_PITCH, DRUM, ESC, MARGIN, PLATEN_AXIS, PLATEN_LEN, PLATEN_R, RAILS, SHIFT, TRIP_LOCK } from '../../sim/layout';
import { SPEC } from '../../sim/mechanism';
import type { Vec3 } from '../../sim/vec';
import { MAT, Part, Rig } from '../rig';
import { arc, box, circle, lathe, merge, plate, slab, toothed, tube } from '../geo';

const xy = (z: number, o: Vec3 = [0, 0, 0]) => ({ origin: [o[0], o[1], z] as Vec3, a: [1, 0, 0] as Vec3, b: [0, 1, 0] as Vec3 });
const zy = (x: number) => ({ origin: [x, 0, 0] as Vec3, a: [0, 0, 1] as Vec3, b: [0, 1, 0] as Vec3 });

/** Rotation about a line through `o` along unit `axis`. */
export function spin(m: THREE.Matrix4, o: Vec3, axis: THREE.Vector3, angle: number): void {
  m.makeRotationAxis(axis, angle);
  const e = m.elements;
  e[12] = o[0] - (e[0] * o[0] + e[4] * o[1] + e[8] * o[2]);
  e[13] = o[1] - (e[1] * o[0] + e[5] * o[1] + e[9] * o[2]);
  e[14] = o[2] - (e[2] * o[0] + e[6] * o[1] + e[10] * o[2]);
}

const AXZ = new THREE.Vector3(0, 0, 1);

export function buildCarriage(rig: Rig, tw: Typewriter): { carriageParts: Part[] } {
  const c = tw.core;
  const W = ESC.wheelCenter, zw = W[2];

  // --- Escape wheel: a 16-tooth ratchet whose steep faces lead as it turns
  const wheel = rig.part('escapeWheel', { kind: 'escapeWheel', sys: 'escapement', body: c.wheel, explode: [0, -0.02, -0.13], anchor: [0, W[1] + ESC.wheelR, zw] });
  const step = (Math.PI * 2) / ESC.teeth, R = ESC.wheelR, r0 = R - 0.0032;
  const teeth: Array<[number, number]> = [];
  for (let i = 0; i < ESC.teeth; i++) {
    const a = -Math.PI / 2 - step + i * step;
    const P = (r: number, f: number): [number, number] => [r * Math.cos(a + f * step), r * Math.sin(a + f * step)];
    teeth.push(P(r0, 0.02), P(R, 0.86), P(R, 0.995), P(r0, 1.0));
  }
  const spokes = [0, 1, 2, 3].map((i) => circle(0.0062 * Math.cos(i * Math.PI / 2 + 0.6), 0.0062 * Math.sin(i * Math.PI / 2 + 0.6), 0.0026, 12, true));
  wheel.add(plate(teeth, ESC.wheelT, xy(zw, [W[0], W[1], 0]), spokes), MAT.brass);
  wheel.add(merge([tube([W[0], W[1], zw - 0.005], [W[0], W[1], zw + 0.006], 0.0032, 14), tube([W[0], W[1], zw + 0.006], [W[0], W[1], ESC.pinionZ - 0.001], 0.0016, 10)]), MAT.steel);

  // --- Pinion: turns with the rack; it drives the wheel through a one-way ratchet
  const pinion = rig.part('pinion', { kind: 'pinion', sys: 'escapement', explode: [0, -0.02, -0.105], anchor: [0, W[1] + ESC.pinionR, ESC.pinionZ] });
  pinion.pose = (m) => spin(m, W, AXZ, c.carriage.q / ESC.pinionR);
  pinion.add(plate(toothed(16, ESC.pinionR - 0.0011, ESC.pinionR + 0.0009, 'spur', Math.PI / 2), 0.0042, xy(ESC.pinionZ, [W[0], W[1], 0])), MAT.steel);
  pinion.add(plate(toothed(16, 0.0036, 0.0049, 'ratchet'), 0.0016, xy(ESC.pinionZ - 0.0034, [W[0], W[1], 0])), MAT.blued);

  // --- Rocker with the fixed dog; the loose dog slides on it
  const P = ESC.rockerPivot;
  // Trip-lock finger: a flat strip from the shaft to its tip, square at the top where the carriage's tab stands behind it.
  const fLen = Math.hypot(TRIP_LOCK.tip[0], TRIP_LOCK.tip[1]), fn: [number, number] = [(TRIP_LOCK.tip[1] / fLen) * TRIP_LOCK.fingerHalf, (-TRIP_LOCK.tip[0] / fLen) * TRIP_LOCK.fingerHalf];
  const fTip: [number, number] = [ESC.rockerPivot[2] + TRIP_LOCK.tip[0], ESC.rockerPivot[1] + TRIP_LOCK.tip[1]];
  const finger: Array<[number, number]> = [
    [ESC.rockerPivot[2] - fn[0], ESC.rockerPivot[1] - fn[1]], [ESC.rockerPivot[2] + fn[0], ESC.rockerPivot[1] + fn[1]], [fTip[0] + fn[0], fTip[1] + fn[1]], [fTip[0] - fn[0], fTip[1] - fn[1]],
  ];
  const rocker = rig.part('rocker', { kind: 'rocker', sys: 'escapement', body: c.rocker, explode: [0, -0.055, -0.13], anchor: [0.0045, P[1] + 0.02, zw] });
  const yDog0 = W[1] - R - 0.0022, yDog1 = W[1] - R + 0.0026;
  rocker.add(merge([
    tube([-0.014, P[1], P[2]], [0.014, P[1], P[2]], 0.0021, 12),
    plate([[zw - 0.003, P[1] - 0.003], [zw + 0.0065, P[1] - 0.003], [zw + 0.0065, yDog1], [zw - 0.003, yDog1]], 0.0018, zy(0.0052)),
    // push face for the universal bar, and the forward arm the space bar lifts
    box([0, P[1] + ESC.pushR, P[2] + 0.0007], [0.0086, 0.0044, 0.0016]),
    tube([-0.008, P[1], P[2]], [-0.008, P[1], P[2] + ESC.spaceArm + 0.002], 0.0015, 8),
    box([-0.004, P[1] + 0.0008, P[2] + ESC.spaceArm], [0.01, 0.0016, 0.004]),
    // trip-lock finger: on the shaft's far end, outside its bearing, reaching up toward the carriage
    tube([0.014, P[1], P[2]], [TRIP_LOCK.fingerX + 0.0008, P[1], P[2]], 0.0016, 10),
    plate(finger, 0.0016, zy(TRIP_LOCK.fingerX)),
  ]), MAT.steelDark);
  // fixed dog: stands in front of the wheel and swings into it
  rocker.add(slab([ESC.drop / 1, yDog0, zw + 0.003], [0.0043, yDog1, zw + 0.005]), MAT.blued);

  const dog = rig.part('looseDog', { kind: 'looseDog', sys: 'escapement', body: c.looseDog, explode: [0.03, -0.055, -0.13], anchor: [0.001, yDog1, zw] });
  dog.add(merge([slab([0, yDog0, zw - 0.0008], [0.0022, yDog1, zw + 0.0017]), slab([0.0022, yDog0, zw - 0.0008], [0.0043, yDog0 + 0.0018, zw + 0.0017])]), MAT.nickel);
  const dogSpring = rig.part('dogSpring', { kind: 'dogSpring', sys: 'escapement', explode: [0.015, -0.055, -0.13], anchor: [-0.004, yDog0, zw] });
  const coilSmall = (() => { const g = new THREE.CylinderGeometry(0.0004, 0.0004, 1, 5, 1); g.translate(0, 0.5, 0); return g; })();
  rig.link(dogSpring, coilSmall, MAT.spring, dog, [0.0011, yDog0 + 0.0009, zw - 0.0008], rocker, [-0.006, yDog0 + 0.0009, zw - 0.002]);

  // Retaining pawl riding the wheel's teeth (part of the frame).
  const pawl = rig.part('retainingPawl', { kind: 'retainingPawl', sys: 'escapement', explode: [-0.03, -0.02, -0.13], anchor: [-R, W[1], zw] });
  pawl.add(merge([tube([-R - 0.0125, W[1] - 0.008, zw], [-R + 0.0004, W[1] + 0.001, zw], 0.0007, 6), tube([-R - 0.0125, W[1] - 0.008, zw - 0.004], [-R - 0.0125, W[1] - 0.008, zw + 0.004], 0.0012, 8)]), MAT.blued);

  // --- Mainspring drum and draw band
  const D = DRUM.center;
  const drum = rig.part('drum', { kind: 'mainspring', sys: 'carriage', explode: [-0.07, -0.03, -0.09], anchor: [D[0], D[1] + DRUM.radius, D[2]] });
  drum.pose = (m) => spin(m, D, AXZ, c.carriage.q / DRUM.radius);
  const holes = [0, 1, 2, 3, 4].map((i) => circle(0.0125 * Math.cos(i * 1.2566), 0.0125 * Math.sin(i * 1.2566), 0.0042, 14, true));
  drum.add(merge([
    plate(circle(0, 0, DRUM.radius + 0.002, 40), 0.0012, xy(D[2] + 0.008, [D[0], D[1], 0]), holes),
    plate(circle(0, 0, DRUM.radius + 0.002, 40), 0.0012, xy(D[2] - 0.008, [D[0], D[1], 0]), holes),
  ]), MAT.brass);
  drum.add(tube([D[0], D[1], D[2] - 0.0075], [D[0], D[1], D[2] + 0.0075], DRUM.radius, 40), MAT.steelDark);
  // The coiled spring, visible through the drum's windows.
  const coilPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 220; i++) { const a = i * 0.2, r = 0.004 + (DRUM.radius - 0.006) * (i / 220); coilPts.push(new THREE.Vector3(D[0] + r * Math.cos(a), D[1] + r * Math.sin(a), D[2] + 0.0092)); }
  drum.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coilPts), 440, 0.0004, 4), MAT.blued);
  const drumFrame = rig.part('drumArbor', { kind: 'frame', sys: 'frame', explode: [-0.07, -0.03, -0.09], anchor: D });
  drumFrame.add(tube([D[0], D[1], D[2] - 0.014], [D[0], D[1], D[2] + 0.013], 0.0024, 10), MAT.steel);

  // --- Rails (frame) and the carriage truck that rolls on them
  const rails = rig.part('rails', { kind: 'rails', sys: 'carriage', explode: [0, 0.045, -0.03], anchor: [0.16, 0.127, -0.04] });
  rails.add(merge([tube([-0.2, RAILS.y, RAILS.front], [0.2, RAILS.y, RAILS.front], RAILS.radius, 14), tube([-0.2, RAILS.y, RAILS.rear], [0.2, RAILS.y, RAILS.rear], RAILS.radius, 14)]), MAT.nickel);

  const X0 = CARRIAGE_X0, half = 0.15;
  const [tipZ, tipY] = TRIP_LOCK.tip, a = TRIP_LOCK.angle;
  const tabZ = P[2] + tipZ * Math.cos(a) - tipY * Math.sin(a) - TRIP_LOCK.fingerHalf;
  // The tab's leading face reaches the side of the finger at carriage travel cTrip, and it is wide enough to
  // cover the finger with the carriage at the margin stop.
  const tabX = TRIP_LOCK.fingerX + 0.0008 + c.limits.cTrip, tabW = c.limits.cRight - c.limits.cTrip + 0.0024;
  const exC: Vec3 = [0, 0.11, -0.05];
  const truck = rig.part('truck', { kind: 'truck', sys: 'carriage', body: c.carriage, explode: exC, anchor: [X0 + 0.12, 0.136, -0.06] });
  const rackY = W[1] + ESC.pinionR;
  const rack: Array<[number, number]> = [[X0 - 0.142, rackY + 0.006], [X0 - 0.142, rackY + 0.0012]];
  for (let x = X0 - 0.142; x < X0 + 0.142 - 1e-6; x += CHAR_PITCH) rack.push([x + CHAR_PITCH * 0.25, rackY - 0.0011], [x + CHAR_PITCH * 0.5, rackY - 0.0011], [x + CHAR_PITCH * 0.75, rackY + 0.0012], [x + CHAR_PITCH, rackY + 0.0012]);
  rack.push([X0 + 0.142, rackY + 0.006]);
  truck.add(merge([
    slab([X0 - half, 0.132, -0.09], [X0 + half, 0.136, -0.074]), slab([X0 - half, 0.132, -0.058], [X0 + half, 0.136, -0.044]),
    slab([X0 - half, 0.132, -0.09], [X0 - half + 0.012, 0.136, -0.044]), slab([X0 + half - 0.012, 0.132, -0.09], [X0 + half, 0.136, -0.044]),
    slab([X0 - 0.006, 0.132, -0.09], [X0 + 0.006, 0.136, -0.044]),
    // bearing shoes on the rails
    ...[-0.11, 0.11].flatMap((dx) => [box([X0 + dx, 0.1312, RAILS.front], [0.02, 0.0024, 0.009]), box([X0 + dx, 0.1312, RAILS.rear], [0.02, 0.0024, 0.009])]),
    // trip-lock tab: hangs under the truck's rear member and comes to stand behind the rocker's finger over the
    // last step of the line. Its face is where the back of the finger is with the rocker at the angle it is left.
    slab([tabX, TRIP_LOCK.tabBottom, tabZ - 0.0025], [tabX + tabW, 0.132, tabZ]),
    // draw band lug and bell trip cam
    slab([X0 + 0.133, 0.118, -0.072], [X0 + 0.137, 0.132, -0.068]),
    slab([c.points.hammerPivot[0] + c.limits.cBell, 0.1235, -0.09], [c.points.hammerPivot[0] + c.limits.cBell + 0.0026, 0.132, -0.086]),
  ]), MAT.iron);
  truck.add(plate(rack, 0.004, xy(ESC.pinionZ)), MAT.steel);
  // Margin scale on the truck's front edge, with the two margin stops.
  const scaleZ = -0.043;
  truck.add(slab([X0 - 0.125, 0.1362, scaleZ - 0.004], [X0 + 0.125, 0.1372, scaleZ]), MAT.ivory);
  const stopAt = (colNo: number) => X0 - colNo * CHAR_PITCH + 0;
  truck.add(merge([MARGIN.left, MARGIN.right].map((m) => box([stopAt(m) + 0, 0.139, scaleZ - 0.002], [0.004, 0.0045, 0.006]))), MAT.nickel);

  const band = rig.part('drawBand', { kind: 'drawBand', sys: 'carriage', explode: [0, 0.03, -0.07], anchor: [0, D[1] + DRUM.radius, D[2]] });
  const strip = new THREE.BoxGeometry(0.0004, 1, 0.003);
  strip.translate(0, 0.5, 0);
  rig.link(band, strip, MAT.cord, drumFrame, [D[0], D[1] + DRUM.radius + 0.0002, D[2]], truck, [X0 + 0.135, D[1] + DRUM.radius + 0.0002, D[2]]);

  // --- Cradle: the part of the carriage that Shift lifts, carrying the platen
  const cradle = rig.part('cradle', { kind: 'cradle', sys: 'shift', body: c.cradle, explode: [0, 0.14, -0.07], anchor: [X0 - 0.14, PLATEN_AXIS[1] + 0.02, PLATEN_AXIS[2]] });
  const A = PLATEN_AXIS;
  const endPlate = (x: number) => plate([[-0.092, 0.137], [-0.044, 0.137], [-0.022, A[1] - 0.004], [-0.022, A[1] + 0.012], [-0.04, A[1] + 0.024], [-0.07, A[1] + 0.03], [-0.094, A[1] + 0.012]], 0.003, zy(x), [circle(A[2], A[1], 0.0034, 14, true)]);
  cradle.add(merge([
    endPlate(X0 - 0.137), endPlate(X0 + 0.137),
    tube([X0 - 0.137, 0.14, -0.088], [X0 + 0.137, 0.14, -0.088], 0.0026, 10),
    tube([X0 - 0.137, A[1] + 0.026, -0.066], [X0 + 0.137, A[1] + 0.026, -0.066], 0.0022, 10),
    // shoe that rides on the shift rail
    tube([X0, 0.14, -0.088], [X0, c.points.shoe[1] + 0.002, SHIFT.railZ], 0.0022, 8),
    box([X0, c.points.shoe[1] + 0.0012, SHIFT.railZ], [0.014, 0.0024, 0.006]),
  ]), MAT.enamelTrim);
  // Paper table behind the platen and the paper bail in front.
  // It lies just behind the sheet, leaning back at the angle the paper leaves the platen.
  const table = plate([[-0.0505, A[1] - 0.013], [-0.0485, A[1] - 0.0115], [-0.1165, A[1] + 0.0755], [-0.1185, A[1] + 0.074]], 0.236, zy(X0));
  cradle.add(table, MAT.enamel);
  const bailY = A[1] + PLATEN_R * 0.72, bailZ = A[2] + PLATEN_R * 0.78;
  cradle.add(merge([
    tube([X0 - 0.128, bailY + 0.004, bailZ + 0.003], [X0 + 0.128, bailY + 0.004, bailZ + 0.003], 0.0013, 8),
    tube([X0 - 0.128, bailY + 0.004, bailZ + 0.003], [X0 - 0.134, A[1] + 0.006, A[2] + 0.004], 0.0013, 8),
    tube([X0 + 0.128, bailY + 0.004, bailZ + 0.003], [X0 + 0.134, A[1] + 0.006, A[2] + 0.004], 0.0013, 8),
  ]), MAT.nickel);
  cradle.add(merge([-0.06, 0.06].map((dx) => tube([X0 + dx - 0.006, bailY + 0.004, bailZ + 0.003], [X0 + dx + 0.006, bailY + 0.004, bailZ + 0.003], 0.0042, 14))), MAT.rubberGrey);

  // --- Platen with knobs and the line-space ratchet
  const platen = rig.part('platen', { kind: 'platen', sys: 'feed', body: c.platen, explode: [0, 0.19, -0.07], anchor: [X0 + 0.05, A[1] + PLATEN_R, A[2]] });
  platen.add(tube([X0 - PLATEN_LEN / 2, A[1], A[2]], [X0 + PLATEN_LEN / 2, A[1], A[2]], PLATEN_R, 48), MAT.rubber);
  // Solid rubber over a steel core: thin discs every few millimetres, so any slice through it shows a filled section.
  const ring = (x: number, r0: number, r1: number) => { const g = new THREE.RingGeometry(r0, r1, 40); g.rotateY(Math.PI / 2); g.translate(x, A[1], A[2]); return g; };
  const xs: number[] = [];
  for (let x = X0 - PLATEN_LEN / 2 + 0.002; x < X0 + PLATEN_LEN / 2; x += 0.004) xs.push(x);
  platen.add(merge(xs.map((x) => ring(x, 0.0062, PLATEN_R - 0.0002))), MAT.rubberGrey, { shadow: false });
  platen.add(merge(xs.map((x) => ring(x, 0.0, 0.0062))), MAT.steelDark, { shadow: false });
  const knob = (side: number): THREE.BufferGeometry => lathe([[0.004, 0], [0.004, 0.012], [0.015, 0.012], [0.0175, 0.015], [0.0175, 0.027], [0.015, 0.03], [0, 0.03]], [X0 + side * (PLATEN_LEN / 2 + 0.002), A[1], A[2]], [side, 0, 0], 28);
  platen.add(merge([tube([X0 - PLATEN_LEN / 2 - 0.004, A[1], A[2]], [X0 + PLATEN_LEN / 2 + 0.004, A[1], A[2]], 0.0033, 12)]), MAT.steel);
  platen.add(merge([knob(1), knob(-1)]), MAT.keyBlack);
  const ratchetX = X0 - PLATEN_LEN / 2 - 0.0008;
  platen.add(plate(toothed(SPEC.lineTeeth, SPEC.ratchetR - 0.0022, SPEC.ratchetR, 'star'), 0.0016, { origin: [ratchetX, A[1], A[2]], a: [0, 0, 1], b: [0, 1, 0] }), MAT.nickel);
  // detent roller arm on the cradle
  cradle.add(merge([tube([ratchetX, A[1] - SPEC.ratchetR - 0.0006, A[2] - 0.004], [ratchetX, A[1] - SPEC.ratchetR - 0.0006, A[2] + 0.004], 0.0016, 10), tube([ratchetX, A[1] - SPEC.ratchetR - 0.0006, A[2]], [ratchetX, 0.139, -0.05], 0.0009, 6)]), MAT.steel);

  // --- Line-space / carriage-return lever
  const L = c.points.leverPivot, H = c.points.leverHandle;
  const lever = rig.part('lineLever', { kind: 'lineLever', sys: 'feed', body: c.lineLever, explode: [-0.06, 0.16, 0.0], anchor: H });
  lever.add(merge([
    tube([L[0], L[1] - 0.006, L[2]], [L[0], L[1] + 0.012, L[2]], 0.0032, 12),
    tube([L[0], L[1] + 0.008, L[2]], [H[0] + 0.012, H[1] - 0.002, H[2] - 0.014], 0.0021, 10),
    tube([H[0] + 0.012, H[1] - 0.002, H[2] - 0.014], H, 0.0021, 10),
    tube([L[0], L[1], L[2]], [ratchetX, A[1] + 0.006, A[2] + SPEC.ratchetR + 0.002], 0.0012, 6),
  ]), MAT.nickel);
  const paddle = new THREE.SphereGeometry(0.0085, 16, 10);
  paddle.scale(1, 0.45, 1.25);
  paddle.translate(H[0], H[1], H[2]);
  lever.add(paddle, MAT.nickel);
  cradle.add(tube([L[0], L[1] - 0.006, L[2]], [X0 - 0.137, A[1] + 0.004, A[2] + 0.012], 0.002, 8), MAT.enamelTrim);

  // --- Bell and its hammer
  const B = c.points.hammerPivot;
  const hammer = rig.part('hammer', { kind: 'bellHammer', sys: 'bell', body: c.hammer, explode: [-0.05, -0.03, -0.12], anchor: [B[0], B[1] - 0.028, B[2]] });
  hammer.add(merge([tube(B, [B[0], B[1] - 0.026, B[2]], 0.0009, 6), tube(B, [B[0], 0.1225, B[2]], 0.0011, 6), tube([B[0], B[1], B[2] - 0.004], [B[0], B[1], B[2] + 0.004], 0.0018, 8)]), MAT.steel);
  const head = new THREE.SphereGeometry(0.003, 12, 8);
  head.translate(B[0], B[1] - 0.028, B[2]);
  hammer.add(head, MAT.brass);
  const bell = rig.part('bell', { kind: 'bell', sys: 'bell', explode: [-0.09, -0.03, -0.12], anchor: [B[0] - 0.027, B[1] - 0.012, B[2]] });
  const dome = new THREE.SphereGeometry(0.022, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.translate(B[0] - 0.0045 - 0.022, B[1] - 0.028, B[2]);
  bell.add(dome, MAT.bell);
  (MAT.bell as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  bell.add(tube([B[0] - 0.0265, B[1] - 0.006, B[2]], [B[0] - 0.0265, B[1] + 0.012, B[2]], 0.0016, 8), MAT.steelDark);

  return { carriageParts: [truck, cradle, platen, lever] };
}

export { arc };
