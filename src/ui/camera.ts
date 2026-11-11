// Camera viewpoints and smooth moves between them.

import * as THREE from 'three';
import type { Stage } from '../view/stage';
import { DRUM, ESC, P0, PLATEN_AXIS } from '../sim/layout';

export interface Shot { pos: [number, number, number]; target: [number, number, number] }

export const SHOTS: Record<string, Shot> = {
  typist: { pos: [0.02, 0.5, 0.72], target: [0, 0.1, 0.02] },
  hero: { pos: [-0.5, 0.36, 0.62], target: [0.02, 0.1, 0.0] },
  side: { pos: [0.72, 0.16, 0.04], target: [0, 0.085, 0.02] },
  sideLeft: { pos: [-0.72, 0.16, 0.04], target: [0, 0.085, 0.02] },
  top: { pos: [0, 0.85, 0.06], target: [0, 0.1, 0.02] },
  rear: { pos: [0.18, 0.3, -0.72], target: [0, 0.11, -0.04] },
  keys: { pos: [0.12, 0.3, 0.42], target: [0.01, 0.07, 0.11] },
  linkage: { pos: [0.4, 0.13, 0.19], target: [0.02, 0.075, 0.035] },
  basket: { pos: [0.1, 0.33, 0.25], target: [0, 0.13, 0.02] },
  print: { pos: [0.085, 0.215, 0.115], target: [P0[0], P0[1] - 0.004, P0[2]] },
  printSide: { pos: [0.2, 0.175, 0.012], target: [0, P0[1] - 0.012, P0[2] + 0.004] },
  ubar: { pos: [0.16, 0.16, 0.1], target: [0, 0.115, -0.01] },
  escapement: { pos: [0.085, 0.135, -0.27], target: [ESC.wheelCenter[0], ESC.wheelCenter[1] - 0.012, ESC.wheelCenter[2]] },
  escapementSide: { pos: [0.17, 0.125, -0.115], target: [0, 0.103, -0.094] },
  drum: { pos: [-0.3, 0.2, -0.36], target: [DRUM.center[0] + 0.07, DRUM.center[1] + 0.01, DRUM.center[2]] },
  carriage: { pos: [-0.36, 0.34, 0.26], target: [0.0, PLATEN_AXIS[1], PLATEN_AXIS[2]] },
  shift: { pos: [0.62, 0.2, -0.16], target: [0.03, 0.115, -0.05] },
  lever: { pos: [-0.3, 0.33, 0.24], target: [-0.06, 0.17, -0.01] },
  bell: { pos: [-0.3, 0.1, -0.3], target: [-0.1, 0.07, -0.088] },
  lockPost: { pos: [0.115, 0.09, -0.2], target: [0.068, 0.12, -0.063] },
  lockTeeth: { pos: [0.062, 0.11, -0.16], target: [0.06, 0.03, -0.063] },
  lockKey: { pos: [0.2, 0.2, 0.34], target: [0.05, 0.085, 0.1] },
  tripLock: { pos: [0.08, 0.128, -0.15], target: [0.022, 0.116, -0.09] },
  exploded: { pos: [-0.82, 0.62, 1.0], target: [0, 0.17, 0.0] },
  under: { pos: [0.45, 0.02, 0.4], target: [0, 0.06, 0.03] },
};

export class CameraRig {
  private from = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  private to = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  private t = 1;
  private duration = 1;
  /** When set, the target follows this moving point (e.g. the printing column). */
  follow: (() => THREE.Vector3) | null = null;

  constructor(private stage: Stage) {}

  get moving(): boolean { return this.t < 1; }

  go(shot: Shot | string, seconds = 1.1): void {
    const s = typeof shot === 'string' ? SHOTS[shot] : shot;
    if (!s) return;
    this.from.pos.copy(this.stage.camera.position);
    this.from.target.copy(this.stage.controls.target);
    this.to.pos.set(...s.pos);
    this.to.target.set(...s.target);
    this.duration = Math.max(0.01, seconds);
    this.t = seconds <= 0 ? 1 : 0;
    if (seconds <= 0) this.apply(1);
  }

  /** Stop a move in progress (the user grabbed the camera). */
  cancel(): void { this.t = 1; }

  private apply(k: number): void {
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    this.stage.camera.position.lerpVectors(this.from.pos, this.to.pos, e);
    this.stage.controls.target.lerpVectors(this.from.target, this.to.target, e);
  }

  update(dt: number): void {
    if (this.t >= 1) return;
    this.t = Math.min(1, this.t + dt / this.duration);
    this.apply(this.t);
  }
}
