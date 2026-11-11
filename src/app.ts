// Wires the simulation to the 3D model and runs the frame loop.

import * as THREE from 'three';
import { Typewriter } from './sim/machine';
import { Typist } from './sim/typist';
import { Rig } from './view/rig';
import { Stage } from './view/stage';
import { PaperView } from './view/paper';
import { buildTypeAction, legendAtlas } from './view/parts/typeaction';
import { buildCarriage } from './view/parts/carriage';
import { buildFrame } from './view/parts/frame';

export class App {
  readonly tw = new Typewriter();
  readonly typist = new Typist(this.tw);
  readonly rig = new Rig();
  readonly stage: Stage;
  readonly paper: PaperView;
  /** Simulated seconds per real second. 1 = real time. */
  timeScale = 1;
  paused = false;
  /** Fraction of real time actually achieved last frame (below 1 when the machine can't keep up). */
  achieved = 1;
  /** Called after each frame's simulation step, before rendering. */
  readonly onFrame: Array<(dt: number, simDt: number) => void> = [];
  /** When set, checked every 0.1 ms of simulated time; returning true pauses the run at that instant. */
  stopWhen: (() => boolean) | null = null;
  /** Called when the machine state is replaced (tour reset), so recordings of the past can be dropped. */
  readonly onReset: Array<() => void> = [];
  private last = performance.now();
  private debt = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.stage = new Stage(canvas);
    const atlas = legendAtlas(this.tw.keys, ['Shift', 'Back']);
    const legendMat = new THREE.MeshStandardMaterial({ map: atlas.texture, roughness: 0.22, metalness: 0 });
    buildTypeAction(this.rig, this.tw, legendMat, atlas.cell);
    buildCarriage(this.rig, this.tw);
    buildFrame(this.rig, this.tw, legendMat, atlas.cell);
    this.paper = new PaperView(this.rig, this.tw, this.stage.renderer);
    this.stage.scene.add(this.rig.root);
    // Let everything settle onto its stops before the first frame.
    this.tw.advance(0.05);
    this.tw.events = [];
    this.rig.sync();
  }

  /** Advance the simulation by up to dt of simulated time, within a wall-clock budget. */
  simulate(simDt: number, budgetMs = 9): number {
    const h = this.tw.sys.h, t0 = performance.now(), start = this.tw.time;
    let left = simDt;
    while (left > h * 0.5) {
      const chunk = Math.min(left, this.stopWhen ? 0.0001 : 0.0005);
      this.tw.advance(chunk);
      left -= chunk;
      if (this.stopWhen && this.stopWhen()) break;
      if (this.paused || performance.now() - t0 > budgetMs) break;
    }
    return this.tw.time - start;
  }

  frame = (): void => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.tick(dt);
    requestAnimationFrame(this.frame);
  };

  /** One frame: advance the machine by dt of real time (scaled), update the model and draw. */
  tick(dt: number): void {
    let done = 0;
    if (!this.paused) {
      const want = dt * this.timeScale + this.debt;
      done = this.simulate(want);
      if (this.paused) this.debt = 0;
      // Carry a small remainder so slow motion advances smoothly; drop what we cannot catch up on.
      this.debt = Math.min(want - done, this.tw.sys.h * 4);
      this.achieved = want > 1e-9 ? Math.min(1, done / want) : 1;
    }
    for (const f of this.onFrame) f(dt, done);
    this.rig.sync();
    this.stage.render();
  }

  resetHistory(): void { this.debt = 0; this.tw.events = []; for (const f of this.onReset) f(); }

  start(): void { this.last = performance.now(); requestAnimationFrame(this.frame); }
}
