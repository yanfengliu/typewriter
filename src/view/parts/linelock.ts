// The line lock: a comb under the key levers that the carriage pushes sideways at the end of the line.

import * as THREE from 'three';
import type { Typewriter } from '../../sim/machine';
import { AUX_FULCRUM, CHAR_PITCH, KEY_FULCRUM, KEY_LEVER_HALF, KEY_LEVER_T, LOCK, LOCK_ENGAGE, MARGIN, SPACE_BAR } from '../../sim/layout';
import { MAT, Rig } from '../rig';
import { coil, merge, plate, slab, span, tube } from '../geo';
import { UNIT_COIL } from './typeaction';

export function buildLineLock(rig: Rig, tw: Typewriter): void {
  const c = tw.core;
  const xs = tw.keys.map((k) => k.x).sort((a, b) => a - b);
  const zc = LOCK.z, half = LOCK.thickness / 2;

  // --- The comb: a strip standing on edge across the machine, with a slot under every key lever.
  // Its teeth end just below the levers' lower edges; the slots are deep enough for a lever at the bottom of its stroke.
  const yTop = KEY_FULCRUM.y - KEY_LEVER_HALF - LOCK.play;
  const drop = (zc - KEY_FULCRUM.z) * Math.max(...tw.keys.map((k) => k.keyAngle)) * 1.05;
  const ySlot = yTop - drop - 0.0006, yBase = ySlot - 0.0055;
  const x0 = xs[0] - LOCK.slot / 2 - 0.002, x1 = xs[xs.length - 1] + LOCK.slot / 2 + 0.004;
  const outline: Array<[number, number]> = [[x0, yBase], [x1, yBase], [x1, yTop]];
  for (let i = xs.length - 1; i >= 0; i--) {
    const a = xs[i] - LOCK.slot / 2, b = xs[i] + LOCK.slot / 2;
    outline.push([b, yTop], [b, ySlot], [a, ySlot], [a, yTop]);
  }
  outline.push([x0, yTop]);

  const lock = rig.part('lockComb', { kind: 'lineLock', sys: 'bell', body: c.lockBar, explode: [0.03, -0.05, -0.06], anchor: [LOCK.seatX, yTop + 0.03, zc] });
  // The post rises between two key levers to the carriage, where a lug meets the buffer spring on it.
  const [z0, z1] = LOCK.postZ, postX = LOCK.seatX - LOCK.postT;
  // A finger on the post reaches over the tail of the right-hand space lever, which rises when the bar is pressed:
  // it sits where the tail's upper edge stands with the space bar at its locked depth.
  const tip = c.points.spaceTip;
  const tailTop = (q: number, z: number): number => {
    const dz = tip[2] - AUX_FULCRUM.z, dy = tip[1] - 0.002 - AUX_FULCRUM.y, len = Math.hypot(dz, dy);
    // Turning the lever by q about its fulcrum (positive q lowers the front): vectors in (z, y).
    const turn = (vz: number, vy: number): [number, number] => [vz * Math.cos(q) + vy * Math.sin(q), vy * Math.cos(q) - vz * Math.sin(q)];
    const [az, ay] = turn(dz / len, dy / len), [nz, ny] = turn(dy / len, -dz / len);
    const s = (z - AUX_FULCRUM.z - SPACE_BAR.tailHalf * nz) / az;
    return AUX_FULCRUM.y + s * ay + SPACE_BAR.tailHalf * ny;
  };
  const yFinger = Math.max(tailTop(c.spaceLock.bound, z0), tailTop(c.spaceLock.bound, z1));
  lock.add(merge([
    plate(outline, LOCK.thickness, { origin: [0, 0, zc], a: [1, 0, 0], b: [0, 1, 0] }),
    slab([postX, yBase, z0], [LOCK.seatX, LOCK.lugY[1], z1]),
    slab([SPACE_BAR.armX + KEY_LEVER_T / 2 + LOCK_ENGAGE, yFinger, z0], [postX, yFinger + 0.002, z1]),
    // seat of the buffer spring and the hook of the return spring
    slab([LOCK.seatX, LOCK.lugY[0] + 0.002, z0 + 0.001], [LOCK.seatX + 0.0008, LOCK.lugY[1] - 0.002, z1 - 0.001]),
    slab([x1, yBase + 0.002, zc - half], [x1 + 0.0012, yBase + 0.004, zc + half]),
  ]), MAT.blued);

  // Buffer spring on the post: free until the carriage's lug reaches it, then squeezed between the two.
  const yb = (LOCK.lugY[0] + LOCK.lugY[1]) / 2, zb = (z0 + z1) / 2;
  const buffer = lock.add(coil(6, 0.0014, 0.00025), MAT.spring);
  buffer.matrixAutoUpdate = true;
  const A = new THREE.Vector3(LOCK.seatX + 0.0008, yb, zb), B = new THREE.Vector3(), T = new THREE.Vector3();
  rig.updaters.push(() => { B.set(LOCK.seatX + LOCK.buffer - c.lockSqueeze(), yb, zb); span(buffer, A, B, T); });

  // --- On the frame: two guides the comb slides in, and the post its return spring pulls against.
  const frame = rig.byId.get('frame')!;
  const guide = (x: number) => [
    slab([x - 0.004, 0.01, zc - half - 0.0016], [x + 0.004, ySlot - 0.001, zc - half - 0.0002]),
    slab([x - 0.004, 0.01, zc + half + 0.0002], [x + 0.004, ySlot - 0.001, zc + half + 0.0016]),
    slab([x - 0.004, 0.01, zc - half - 0.0016], [x + 0.004, yBase - 0.0002, zc + half + 0.0016]),
  ];
  const pinX = x1 + 0.011, ySpring = yBase + 0.003;
  frame.add(merge([...guide(-0.0855), ...guide(0.0855), tube([pinX, 0.01, zc], [pinX, ySpring + 0.0015, zc], 0.001, 8)]), MAT.iron);
  const spring = rig.part('lockSpring', { kind: 'lockSpring', sys: 'bell', explode: [0.05, -0.05, -0.06], anchor: [x1 + 0.006, ySpring, zc] });
  rig.link(spring, UNIT_COIL, MAT.spring, lock, [x1 + 0.0012, ySpring, zc], frame, [pinX, ySpring, zc]);

  // --- On the carriage: the lug that meets the buffer spring over the last 2.3 mm of travel.
  const truck = rig.byId.get('truck')!;
  const lugX = LOCK.seatX + LOCK.buffer + MARGIN.right * CHAR_PITCH - LOCK.lead;
  truck.add(slab([lugX, LOCK.lugY[0], z0], [lugX + 0.0029, 0.132, z1]), MAT.iron);
}
