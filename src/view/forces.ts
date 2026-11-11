// Force arrows: the load path of a keystroke drawn on the parts that carry it.
// Every arrow is a force the solver computed this instant (a contact force, a link tension, an applied push).
// Length grows with the square root of the force so a 3 N finger and a 90 N impact both stay readable.

import * as THREE from 'three';
import type { App } from '../app';
import { CARRIAGE_X0, DRUM, ESC, F, U } from '../sim/layout';
import { SPEC } from '../sim/mechanism';
import type { Vec3 } from '../sim/vec';

const UP = new THREE.Vector3(0, 1, 0);
const COLORS = { push: 0x4aa3ff, link: 0xffa63a, impact: 0xff4a3a, bar: 0x3ae8d0, spring: 0x4fc47f, shift: 0xb48bf0 };

/** Legend shown in the interface. */
export const FORCE_LEGEND: Array<[string, string]> = [
  ['#4aa3ff', 'finger and hand'], ['#ffa63a', 'pull in the wire links'], ['#ff4a3a', 'type on the paper'],
  ['#3ae8d0', 'typebar on universal bar'], ['#4fc47f', 'mainspring and tooth load'], ['#b48bf0', 'shift rail lifting the cradle'],
];

class Arrow {
  readonly group = new THREE.Group();
  private shaft: THREE.Mesh;
  private head: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  shown = 0;
  constructor() {
    this.mat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.95 });
    const sg = new THREE.CylinderGeometry(0.0009, 0.0009, 1, 8);
    sg.translate(0, 0.5, 0);
    this.shaft = new THREE.Mesh(sg, this.mat);
    const hg = new THREE.ConeGeometry(0.0028, 0.008, 12);
    hg.translate(0, -0.004, 0);
    this.head = new THREE.Mesh(hg, this.mat);
    this.group.add(this.shaft, this.head);
    this.group.renderOrder = 20;
    this.shaft.renderOrder = this.head.renderOrder = 20;
    this.group.visible = false;
  }
  /** Draw a force of `newtons` acting at `tip` along unit direction `dir` (the head touches the point). */
  set(tip: THREE.Vector3, dir: THREE.Vector3, newtons: number, color: number, decay: number): void {
    this.shown = Math.max(newtons, this.shown * decay);
    if (this.shown < 0.08) { this.group.visible = false; return; }
    const len = Math.min(0.16, 0.012 * Math.sqrt(this.shown));
    this.group.visible = true;
    this.mat.color.setHex(color);
    this.group.quaternion.setFromUnitVectors(UP, dir);
    this.group.position.copy(tip).addScaledVector(dir, -len);
    this.shaft.scale.set(1, Math.max(1e-4, len - 0.008), 1);
    this.head.position.set(0, len, 0);
  }
  hide(): void { this.shown = 0; this.group.visible = false; }
}

export class ForceView {
  enabled = false;
  // One arrow per source, so each keeps its own peak-hold.
  private arrows = new Map<string, Arrow>();
  private seen = new Set<string>();
  private p = new THREE.Vector3();
  private d = new THREE.Vector3();
  private a: Vec3 = [0, 0, 0];
  private b: Vec3 = [0, 0, 0];

  constructor(private app: App) {}

  private put(key: string, tip: ArrayLike<number>, dir: ArrayLike<number>, newtons: number, color: number, decay: number): void {
    let arrow = this.arrows.get(key);
    if (!arrow) { arrow = new Arrow(); this.arrows.set(key, arrow); this.app.stage.scene.add(arrow.group); }
    this.seen.add(key);
    this.p.set(tip[0], tip[1], tip[2]);
    this.d.set(dir[0], dir[1], dir[2]).normalize();
    arrow.set(this.p, this.d, newtons, color, decay);
  }

  /** Call once per frame with the simulated time that just elapsed. `live` is false while a recording is shown. */
  update(simDt: number, live: boolean): void {
    const app = this.app, tw = app.tw, c = tw.core;
    if (!this.enabled || !live || app.rig.explode > 0.02) { for (const a of this.arrows.values()) a.hide(); return; }
    this.seen.clear();
    // Arrows hold a peak for about half a millisecond of machine time, so a 0.3 ms impact is visible in slow motion.
    const decay = simDt > 0 ? Math.exp(-simDt / 0.0005) : 1;
    const { a, b } = this;

    for (const f of tw.fingers) this.put(`finger:${f.id}`, f.body.world(f.contact.pa, a), [0, -1, 0], f.padForce, COLORS.push, decay);
    if (tw.hand.busy) this.put('hand', c.lineLever.world(c.points.leverHandle, a), [1, 0, 0], tw.hand.push, COLORS.push, decay);

    for (const t of tw.movingTrains) {
      // Tension in a link pulls each end toward the other: draw the pull on the driven end.
      t.link1.ends(a, b);
      const code = t.geom.code;
      this.put(`l1:${code}`, b, [a[0] - b[0], a[1] - b[1], a[2] - b[2]], Math.max(0, t.link1.tension), COLORS.link, decay);
      t.link2.ends(a, b);
      this.put(`l2:${code}`, b, [a[0] - b[0], a[1] - b[1], a[2] - b[2]], Math.max(0, t.link2.tension), COLORS.link, decay);
      const hit = t.hit[0].force >= t.hit[1].force ? t.hit[0] : t.hit[1];
      if (hit.force > 0) this.put(`hit:${code}`, hit.point, [-hit.normal[0], -hit.normal[1], -hit.normal[2]], hit.force, COLORS.impact, decay);
      else if (this.arrows.has(`hit:${code}`)) { const h = this.arrows.get(`hit:${code}`)!; this.seen.add(`hit:${code}`); h.shown *= decay; if (h.shown < 0.08) h.hide(); }
      this.put(`ub:${code}`, t.bar.world(t.geom.ubarPoint, a), [-F[0], -F[1], -F[2]], t.ubar.force, COLORS.bar, decay);
    }

    // The carriage: spring pull on the draw band, and the tooth pressing on whichever dog holds it.
    const band = SPEC.bandTension - SPEC.bandRate * c.carriage.q;
    this.put('band', c.carriage.world([CARRIAGE_X0 + 0.09, DRUM.center[1] + DRUM.radius, DRUM.center[2]], a), [-1, 0, 0], band, COLORS.spring, 0);
    const yDog = ESC.wheelCenter[1] - ESC.wheelR + 0.001;
    // The load on the holding dog is shared between the direct hold constraint and the wheel-and-ratchet chain.
    this.put('tooth', [-0.0005, yDog, ESC.wheelCenter[2]], [1, 0, 0], c.holdLoose.force + c.holdFixed.force + c.ratchet.force, COLORS.spring, c.groups.esc.awake ? decay : 1);
    if (c.groups.shift.awake) this.put('shift', c.cradle.world(c.points.shoe, a), U, c.shiftRail.force, COLORS.shift, decay);
    if (c.groups.space.awake) this.put('space', c.space.world(c.points.spaceTip, a), [0, 1, 0], c.spacePush.force, COLORS.bar, decay);

    for (const [key, arrow] of this.arrows) if (!this.seen.has(key)) arrow.hide();
  }
}
