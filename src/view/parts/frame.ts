// Frame, body shell, shift frame, space bar, backspace key and the ribbon system.

import * as THREE from 'three';
import type { Typewriter } from '../../sim/machine';
import {
  AUX_FULCRUM, BACKSPACE, ESC, F, KEY_FULCRUM, P0, RAILS, RIBBON, RIBBON_LEVER, ROW_Y, ROW_Z, SHIFT, SPACE_BAR, SUBLEVER, U, X,
} from '../../sim/layout';
import { Vec3, add, addScaled, scale } from '../../sim/vec';
import { MAT, Part, Rig } from '../rig';
import { arc, bar2D, box, circle, merge, plate, roundRect, slab, tube } from '../geo';
import { UNIT_ROD, keytop } from './typeaction';
import { spin } from './carriage';

const zy = (x: number) => ({ origin: [x, 0, 0] as Vec3, a: [0, 0, 1] as Vec3, b: [0, 1, 0] as Vec3 });
const AXY = new THREE.Vector3(0, 1, 0);

export function buildFrame(rig: Rig, tw: Typewriter, legendMat: THREE.Material, cell: (i: number) => [number, number, number]): void {
  const c = tw.core;
  const nKeys = tw.keys.length;

  // --- Frame: base, side plates with windows, the fulcrum rods and the key down-stop
  const frame = rig.part('frame', { kind: 'frame', sys: 'frame', explode: [0, -0.07, 0], anchor: [0.146, 0.1, 0.05] });
  const side: Array<[number, number]> = [[-0.122, 0.01], [0.192, 0.01], [0.192, 0.044], [0.112, 0.108], [0.09, 0.132], [0.0, 0.132], [-0.012, 0.12], [-0.122, 0.12]];
  const windows = [roundRect(-0.095, 0.03, 0.06, 0.092, 0.012).reverse() as Array<[number, number]>, roundRect(0.078, 0.022, 0.165, 0.05, 0.008).reverse() as Array<[number, number]>];
  const rod = (y: number, z: number, r = 0.002, hx = 0.1465) => tube([-hx, y, z], [hx, y, z], r, 10);
  frame.add(merge([
    plate(side, 0.003, zy(-0.1465), windows), plate(side, 0.003, zy(0.1465), windows),
    slab([-0.15, 0.006, -0.125], [0.15, 0.01, 0.195]),
    // rail saddles, escapement bracket, bell post
    ...[-0.1465, 0.1465].flatMap((x) => [box([x, 0.1225, RAILS.front], [0.006, 0.006, 0.012]), box([x, 0.1225, RAILS.rear], [0.006, 0.006, 0.012])]),
    slab([-0.022, 0.01, ESC.wheelCenter[2] - 0.011], [0.022, ESC.wheelCenter[1] + 0.006, ESC.wheelCenter[2] - 0.008]),
    slab([-0.02, ESC.rockerPivot[1] - 0.004, ESC.rockerPivot[2] - 0.011], [-0.016, ESC.rockerPivot[1] + 0.004, ESC.rockerPivot[2] + 0.004]),
    slab([0.016, ESC.rockerPivot[1] - 0.004, ESC.rockerPivot[2] - 0.011], [0.02, ESC.rockerPivot[1] + 0.004, ESC.rockerPivot[2] + 0.004]),
    // segment carriers
    tube([-0.07, 0.132, 0.004], [-0.1465, 0.128, 0.004], 0.003, 8), tube([0.07, 0.132, 0.004], [0.1465, 0.128, 0.004], 0.003, 8),
    tube([-0.112, 0.0695, -0.048], [-0.1465, 0.0695, -0.048], 0.0015, 6), tube([0.112, 0.0695, -0.048], [0.1465, 0.0695, -0.048], 0.0015, 6),
  ]), MAT.iron);
  frame.add(merge([rod(KEY_FULCRUM.y, KEY_FULCRUM.z, 0.0012), rod(SUBLEVER.y, SUBLEVER.z, 0.0012), rod(AUX_FULCRUM.y, AUX_FULCRUM.z, 0.002)]), MAT.steel);
  // Down-stop bar under the key levers (gaps let the space-bar arms pass).
  const stopSeg = (x0: number, x1: number, y0: number, y1: number) => slab([x0, y0, 0.044], [x1, y1, 0.056]);
  const gaps: Array<[number, number]> = [[-0.146, -0.0575], [-0.0518, 0.0518], [0.0575, 0.146]];
  frame.add(merge(gaps.map(([a, b]) => stopSeg(a, b, 0.01, 0.0218))), MAT.iron);
  frame.add(merge(gaps.map(([a, b]) => stopSeg(Math.max(a, -0.112), Math.min(b, 0.112), 0.0218, 0.0236))), MAT.rubberGrey);
  const feet = rig.part('feet', { kind: 'frame', sys: 'frame', explode: [0, -0.09, 0], anchor: [0.13, 0, 0.17] });
  feet.add(merge([[-0.13, 0.17], [0.13, 0.17], [-0.13, -0.105], [0.13, -0.105]].map(([x, z]) => tube([x, 0, z], [x, 0.006, z], 0.011, 18))), MAT.rubberGrey);

  // --- Shell: enamelled panels around the mechanism
  const shell = rig.part('shell', { kind: 'shell', sys: 'shell', explode: [0, 0.2, 0.02], anchor: [-0.12, 0.146, 0.05] });
  const panel: Array<[number, number]> = [[-0.129, 0.004], [0.197, 0.004], [0.197, 0.05], [0.12, 0.116], [0.097, 0.1455], [-0.006, 0.1455], [-0.018, 0.122], [-0.129, 0.122]];
  const deck: Array<[number, number]> = [[-0.153, -0.006], [-0.153, 0.097], [0.153, 0.097], [0.153, -0.006], [0.086, -0.006], [0.086, 0.064], ...arc(0.072, 0.064, 0.014, 0, Math.PI / 2, 6), ...arc(-0.072, 0.064, 0.014, Math.PI / 2, Math.PI, 6), [-0.086, -0.006]];
  shell.add(merge([
    plate(panel, 0.003, zy(-0.1515), [], 0.0008), plate(panel, 0.003, zy(0.1515), [], 0.0008),
    slab([-0.153, 0.004, 0.194], [0.153, 0.05, 0.197]), slab([-0.153, 0.004, -0.129], [0.153, 0.122, -0.126]),
    plate(deck, 0.003, { origin: [0, 0.144, 0], a: [1, 0, 0], b: [0, 0, 1] }, [], 0.0008),
    slab([-0.153, 0.124, 0.094], [0.153, 0.1455, 0.097]),
  ]), MAT.enamel);
  // Keyboard deck: a sloping plate with a hole for every key, hiding the forest of key stems.
  const kb = rig.part('keyDeck', { kind: 'shell', sys: 'shell', explode: [0, 0.16, 0.14], anchor: [0.13, 0.1, 0.12] });
  const z0 = 0.193, yz0 = 0.0545, z1 = 0.0955, yz1 = 0.1115;
  const slope = Math.hypot(z1 - z0, yz1 - yz0), dz = (z1 - z0) / slope, dy = (yz1 - yz0) / slope;
  const holesFor = (pts: Array<[number, number, number]>) => pts.map(([x, y, z, r = 0.0086]: any) => {
    // distance along the slope of the point where the key's vertical stem pierces the deck
    const s = (z - z0) / dz;
    return circle(x, s, r, 18, true);
  });
  const keyPts: Array<[number, number, number]> = [...tw.keys.map((k) => k.top as [number, number, number]), c.points.backTop as [number, number, number]];
  const shiftPts = [c.points.shiftTopL, c.points.shiftTopR].map((p) => [p[0], p[1], p[2], 0.0098] as unknown as [number, number, number]);
  kb.add(plate(roundRect(-0.1505, 0.0266, 0.1505, slope, 0.004), 0.0022, { origin: [0, yz0, z0], a: [1, 0, 0], b: [0, dy, dz] }, [...holesFor(keyPts), ...holesFor(shiftPts)]), MAT.enamel);
  // apron behind the space bar, closing the front of the key well
  kb.add(slab([-0.1505, 0.031, 0.1688], [0.1505, 0.0688, 0.1708]), MAT.enamel);
  // Gold pinstripes and a maker's plate
  const trim = rig.part('trim', { kind: 'shell', sys: 'shell', explode: [0, 0.2, 0.02], anchor: [0, 0.135, 0.097] });
  trim.add(merge([slab([-0.15, 0.012, 0.1971], [0.15, 0.0128, 0.1974]), slab([-0.15, 0.042, 0.1971], [0.15, 0.0428, 0.1974])]), MAT.brass, { shadow: false });
  // Maker's plate: gold lettering on black, as on machines of the period.
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 128;
  const g2 = cv.getContext('2d')!;
  g2.fillStyle = '#0b0c0e'; g2.fillRect(0, 0, 1024, 128);
  g2.strokeStyle = '#c9a24a'; g2.lineWidth = 3; g2.strokeRect(8, 8, 1008, 112);
  g2.fillStyle = '#d8b25a'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
  g2.font = 'italic 600 64px Georgia, "Times New Roman", serif';
  g2.fillText('Standard  Nº 5', 512, 68);
  const plateTex = new THREE.CanvasTexture(cv);
  plateTex.colorSpace = THREE.SRGBColorSpace;
  plateTex.anisotropy = 8;
  const plateGeo = new THREE.PlaneGeometry(0.11, 0.01375);
  plateGeo.translate(0, 0.135, 0.09715);
  trim.add(plateGeo, new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.35, metalness: 0.5 }), { shadow: false });

  // --- Shift frame: two side levers joined at the back by the rail that lifts the carriage cradle
  const yA = AUX_FULCRUM.y, zA = AUX_FULCRUM.z;
  const shift = rig.part('shiftFrame', { kind: 'shiftFrame', sys: 'shift', body: c.shift, explode: [0, -0.1, -0.02], anchor: [SHIFT.x, yA, 0.06] });
  const zt = ROW_Z[3], yt = ROW_Y[3];
  const arm = (x: number) => merge([
    plate(bar2D([zt, yt - 0.004], [zt, yA], 0.0016), 0.0016, zy(x)), plate(bar2D([zt, yA], [zA, yA], 0.0034), 0.0016, zy(x)),
    plate(bar2D([zA, yA], [SHIFT.railZ, SHIFT.railY - 0.003], 0.0034), 0.0016, zy(x)),
  ]);
  shift.add(merge([arm(-SHIFT.x), arm(SHIFT.x), tube([-SHIFT.x, SHIFT.railY - 0.003, SHIFT.railZ], [SHIFT.x, SHIFT.railY - 0.003, SHIFT.railZ], 0.003, 12)]), MAT.steelDark);
  for (const [x, i] of [[-SHIFT.x, nKeys], [SHIFT.x, nKeys]] as Array<[number, number]>) {
    const k = keytop([x, yt, zt], cell(i), 0.0082);
    shift.add(k.body, MAT.keyBlack); shift.add(k.ring, MAT.nickel); shift.add(k.face, legendMat, { shadow: false });
  }

  // --- Space bar: a first-class lever whose rear cross-bar lifts the escapement rocker's arm
  const space = rig.part('spaceBar', { kind: 'spaceBar', sys: 'escapement', body: c.space, explode: [0, -0.08, 0.14], anchor: c.points.spaceTop });
  const sx = SPACE_BAR.armX, tip = c.points.spaceTip;
  const sArm = (x: number) => merge([
    plate(bar2D([SPACE_BAR.z - 0.003, SPACE_BAR.y - 0.008], [SPACE_BAR.z - 0.003, yA], 0.0016), 0.0012, zy(x)),
    plate(bar2D([SPACE_BAR.z - 0.003, yA], [zA, yA], 0.003), 0.0012, zy(x)),
    plate(bar2D([zA, yA], [tip[2], tip[1] - 0.002], SPACE_BAR.tailHalf), 0.0012, zy(x)),
  ]);
  space.add(merge([sArm(-sx), sArm(sx), tube([-sx, tip[1] - 0.002, tip[2]], [sx, tip[1] - 0.002, tip[2]], 0.0018, 8), box([-0.004, tip[1] - 0.001, tip[2]], [0.012, 0.002, 0.005])]), MAT.steelDark);
  const bar = plate(roundRect(-SPACE_BAR.width / 2, -0.0075, SPACE_BAR.width / 2, 0.0075, 0.005), 0.008, { origin: [0, SPACE_BAR.y - 0.004, SPACE_BAR.z], a: [1, 0, 0], b: [0, 0, -1] }, [], 0.0015);
  space.add(bar, MAT.keyBlack);

  // --- Backspace key
  const bx = BACKSPACE.x, bt = c.points.backTop;
  const back = rig.part('backspace', { kind: 'backspace', sys: 'carriage', body: c.backspace, explode: [0.03, -0.035, 0.11], anchor: bt });
  const y0 = KEY_FULCRUM.y - 0.0035, y1 = KEY_FULCRUM.y + 0.0035;
  back.add(plate([[KEY_FULCRUM.z - 0.006, y0], [bt[2] + 0.0016, y0], [bt[2] + 0.0016, bt[1] - 0.0035], [bt[2] - 0.0016, bt[1] - 0.0035], [bt[2] - 0.0016, y1], [KEY_FULCRUM.z - 0.006, y1]], 0.0012, zy(bx)), MAT.steel);
  const bk = keytop(bt, cell(nKeys + 1));
  back.add(bk.body, MAT.keyBlack); back.add(bk.ring, MAT.nickel); back.add(bk.face, legendMat, { shadow: false });
  // its push-rod to the rack (drawn as a wire from the lever to the frame behind the carriage)
  frame.add(tube([bx, 0.11, -0.092], [0.1465, 0.11, -0.092], 0.0015, 6), MAT.steel);
  const backLink = rig.part('backLink', { kind: 'backspace', sys: 'carriage', explode: [0.03, 0, -0.03], anchor: [bx, 0.08, -0.09] });
  rig.link(backLink, UNIT_ROD, MAT.wire, back, [bx, y1, -0.085], frame, [bx, 0.11, -0.092]);

  // --- Ribbon: spools, vibrator and its lever
  const spoolY = 0.147, spoolZ = 0.038, spoolX = 0.113;
  const cups = rig.part('spoolCups', { kind: 'spoolCup', sys: 'ribbon', explode: [0, 0.23, 0.02], anchor: [spoolX, spoolY, spoolZ] });
  cups.add(merge([-1, 1].flatMap((s) => [tube([s * spoolX, 0.1455, spoolZ], [s * spoolX, 0.1475, spoolZ], 0.031, 36), tube([s * spoolX, 0.1455, spoolZ], [s * spoolX, 0.163, spoolZ], 0.0022, 8)])), MAT.enamelTrim);
  // ribbon guide posts at the rear corners of the deck
  const guideX = 0.05, guideZ = -0.004, ribbonY = P0[1] + U[1] * (RIBBON.restTop - RIBBON.width / 2);
  cups.add(merge([-1, 1].map((s) => tube([s * guideX, 0.1455, guideZ], [s * guideX, ribbonY + 0.009, guideZ], 0.0012, 6))), MAT.nickel);
  const spools: Part[] = [];
  for (const s of [-1, 1]) {
    const sp = rig.part(`spool${s < 0 ? 'L' : 'R'}`, { kind: 'spool', sys: 'ribbon', explode: [s * 0.03, 0.27, 0.02], anchor: [s * spoolX, spoolY + 0.014, spoolZ] });
    const o: Vec3 = [s * spoolX, spoolY, spoolZ];
    sp.pose = (m) => spin(m, o, AXY, -s * c.wheel.q * 0.12);
    const flange = (y: number) => plate(circle(0, 0, 0.027, 36), 0.0008, { origin: [o[0], y, o[2]], a: [1, 0, 0], b: [0, 0, 1] }, [0, 1, 2].map((i) => circle(0.016 * Math.cos(i * 2.094), 0.016 * Math.sin(i * 2.094), 0.006, 14, true)));
    sp.add(merge([flange(spoolY + 0.001), flange(spoolY + 0.0145)]), MAT.nickel);
    sp.add(tube([o[0], spoolY + 0.0014, o[2]], [o[0], spoolY + 0.0141, o[2]], s < 0 ? 0.021 : 0.014, 32), MAT.ribbonBlack);
    spools.push(sp);
  }

  const vib = rig.part('vibrator', { kind: 'vibrator', sys: 'ribbon', body: c.vibrator, explode: [0, 0.14, 0.05], anchor: addScaled(P0, U, -0.012) });
  const at = (x: number, u: number, f: number): Vec3 => add(add(addScaled(P0, X, x), scale(U, u)), scale(F, f));
  const px = 0.013, sf = RIBBON_LEVER.stemF;
  const prong = (s: number) => [tube(at(s * px, -0.03, sf), at(s * px, -0.0105, sf), 0.0006, 5), tube(at(s * px, -0.0105, sf), at(s * px, RIBBON.restTop - RIBBON.width - 0.001, 0.0008), 0.0006, 5), tube(at(s * px, RIBBON.restTop - RIBBON.width - 0.001, 0.0008), at(s * px, RIBBON.restTop + 0.001, 0.0008), 0.0009, 5)];
  vib.add(merge([...prong(-1), ...prong(1), tube(at(-px, -0.03, sf), at(px, -0.03, sf), 0.0007, 5), tube(at(0, -0.03, sf), c.points.vibratorPin, 0.0008, 5)]), MAT.nickel);

  const rl = rig.part('ribbonLever', { kind: 'ribbonLever', sys: 'ribbon', body: c.ribbonLever, explode: [0, 0.08, -0.02], anchor: RIBBON_LEVER.lift });
  const inPlane = (p: Vec3): [number, number] => [p[2], p[1]];
  rl.add(merge([
    plate(bar2D(inPlane(RIBBON_LEVER.pivot), inPlane(RIBBON_LEVER.up), 0.0017), 0.001, zy(0)),
    plate(bar2D(inPlane(RIBBON_LEVER.pivot), inPlane(RIBBON_LEVER.lift), 0.0017), 0.001, zy(0)),
  ]), MAT.brass);
  frame.add(tube([-0.006, RIBBON_LEVER.pivot[1], RIBBON_LEVER.pivot[2]], [0.006, RIBBON_LEVER.pivot[1], RIBBON_LEVER.pivot[2]], 0.0011, 6), MAT.steel);
  const ubar = rig.byId.get('ubar')!;
  const rl1 = rig.part('ribbonLink1', { kind: 'ribbonLink', sys: 'ribbon', explode: [0, 0.05, -0.03], anchor: RIBBON_LEVER.up });
  rig.link(rl1, UNIT_ROD, MAT.wire, ubar, c.points.ubarPin, rl, RIBBON_LEVER.up);
  const rl2 = rig.part('ribbonLink2', { kind: 'ribbonLink', sys: 'ribbon', explode: [0, 0.11, 0.02], anchor: RIBBON_LEVER.lift });
  rig.link(rl2, UNIT_ROD, MAT.wire, rl, RIBBON_LEVER.lift, vib, c.points.vibratorPin);

  // The ribbon itself: a band from spool to spool through the guides and the vibrator, rebuilt as it lifts.
  const ribbon = rig.part('ribbon', { kind: 'ribbon', sys: 'ribbon', explode: [0, 0.16, 0.03], anchor: at(0.02, RIBBON.restTop - 0.005, 0.001) });
  const pos = new Float32Array(6 * 2 * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const idx: number[] = [];
  for (let i = 0; i < 5; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
  g.setIndex(idx);
  const mesh = ribbon.add(g, MAT.ribbonBlack, { shadow: false });
  mesh.frustumCulled = false;
  const half = RIBBON.width / 2;
  const put = (i: number, p: Vec3, up: Vec3) => {
    pos[i * 6] = p[0] + up[0] * half; pos[i * 6 + 1] = p[1] + up[1] * half; pos[i * 6 + 2] = p[2] + up[2] * half;
    pos[i * 6 + 3] = p[0] - up[0] * half; pos[i * 6 + 4] = p[1] - up[1] * half; pos[i * 6 + 5] = p[2] - up[2] * half;
  };
  const Y: Vec3 = [0, 1, 0];
  rig.updaters.push(() => {
    const lift = c.vibrator.q;
    const centre = RIBBON.restTop - half + lift;
    // Each stretch of ribbon follows the part it runs over, so it stays threaded when the view is exploded.
    const on = (part: Part, p: Vec3): Vec3 => [p[0] + part.offset.x - ribbon.offset.x, p[1] + part.offset.y - ribbon.offset.y, p[2] + part.offset.z - ribbon.offset.z];
    put(0, on(spools[0], [-spoolX + 0.02, spoolY + 0.008, spoolZ - 0.006]), Y);
    put(1, on(cups, [-guideX, ribbonY, guideZ]), Y);
    put(2, on(vib, at(-px, centre, 0.0008)), U);
    put(3, on(vib, at(px, centre, 0.0008)), U);
    put(4, on(cups, [guideX, ribbonY, guideZ]), Y);
    put(5, on(spools[1], [spoolX - 0.013, spoolY + 0.008, spoolZ - 0.006]), Y);
    (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    g.computeVertexNormals();
  });
}
