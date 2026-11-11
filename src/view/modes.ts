// Ways of looking inside: glass or hidden shell, x-ray focus, colour by function, isolate, exploded, slice.

import * as THREE from 'three';
import { Part, Rig, Sys, SYS_COLOR } from './rig';

export type ShellMode = 'solid' | 'glass' | 'hidden';

const GHOST = new THREE.MeshStandardMaterial({ color: 0x9db3d6, transparent: true, opacity: 0.07, depthWrite: false, roughness: 0.4, metalness: 0, side: THREE.DoubleSide });
const GLASS = new THREE.MeshPhysicalMaterial({ color: 0x9fc0e6, transparent: true, opacity: 0.13, depthWrite: false, roughness: 0.05, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 1.6 });

export class ViewModes {
  shell: ShellMode = 'solid';
  /** When set, only these subsystems are drawn solid; everything else becomes a faint ghost. */
  focus: Set<Sys> | null = null;
  /** Show only this key's train (key code); the other 43 are hidden. */
  solo: string | null = null;
  /** Subsystems hidden completely. */
  readonly hidden = new Set<Sys>();
  colorBySystem = false;
  /** Parts drawn with a glowing emphasis (hover, selection, tour). */
  readonly highlight = new Set<Part>();
  /** Target for the exploded view (0..1); the rig eases toward it. */
  explodeTarget = 0;
  /** Slice plane position along X in metres, or null. Everything to the right of it is cut away. */
  slice: number | null = null;
  /** With a slice: also cut away everything to the left of this X, leaving a slab (a true cross-section). */
  sliceBack: number | null = null;
  private readonly plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  private readonly back = new THREE.Plane(new THREE.Vector3(1, 0, 0), 10);
  private readonly planes: THREE.Plane[] = [this.plane, this.back];
  private readonly none: THREE.Plane[] = [];
  private readonly variants = new Map<string, THREE.Material>();
  private readonly all = new Set<THREE.Material>([GHOST, GLASS]);
  private sliced = false;
  private dirty = true;
  private pulse = 0;
  private readonly hi: THREE.MeshStandardMaterial[] = [];

  constructor(private rig: Rig) {
    for (const p of rig.parts) for (const m of p.meshes) this.all.add(m.userData.base as THREE.Material);
  }

  invalidate(): void { this.dirty = true; }

  setHighlight(parts: Iterable<Part>): void {
    this.highlight.clear();
    for (const p of parts) this.highlight.add(p);
    this.dirty = true;
  }

  private variant(base: THREE.Material, kind: string, make: () => THREE.Material): THREE.Material {
    const key = `${base.uuid}:${kind}`;
    let v = this.variants.get(key);
    if (!v) {
      v = make();
      this.variants.set(key, v);
      this.all.add(v);
      v.userData.side = v.side;
      v.clippingPlanes = this.sliced ? this.planes : this.none;
      if (this.sliced) v.side = THREE.DoubleSide;
    }
    return v;
  }

  private tinted(base: THREE.Material, sys: Sys): THREE.Material {
    if ((base as THREE.MeshStandardMaterial).map) return base;
    return this.variant(base, `tint:${sys}`, () => {
      const b = base as THREE.MeshStandardMaterial;
      const c = new THREE.Color(SYS_COLOR[sys]).lerp(b.color, 0.25);
      return new THREE.MeshStandardMaterial({ color: c, roughness: Math.max(0.4, b.roughness), metalness: Math.min(0.5, b.metalness), side: b.side });
    });
  }

  private glowing(base: THREE.Material): THREE.Material {
    return this.variant(base, 'hi', () => {
      const m = (base as THREE.MeshStandardMaterial).clone();
      m.emissive = new THREE.Color(0xffb020);
      m.emissiveIntensity = 0.3;
      this.hi.push(m);
      return m;
    });
  }

  /** Call every frame. */
  update(dt: number): void {
    const rig = this.rig;
    const d = this.explodeTarget - rig.explode;
    rig.explode = Math.abs(d) < 1e-4 ? this.explodeTarget : rig.explode + d * Math.min(1, dt * 5);
    this.pulse += dt;
    const glow = 0.26 + 0.12 * Math.sin(this.pulse * 4);
    for (const m of this.hi) m.emissiveIntensity = glow;

    const wantSlice = this.slice !== null;
    if (wantSlice) { this.plane.constant = this.slice!; this.back.constant = this.sliceBack === null ? 10 : -this.sliceBack; }
    if (wantSlice !== this.sliced) {
      this.sliced = wantSlice;
      // Cut parts are drawn double-sided so you look into them rather than through them.
      for (const m of this.all) {
        if (m.userData.side === undefined) m.userData.side = m.side;
        m.clippingPlanes = wantSlice ? this.planes : this.none;
        m.side = wantSlice ? THREE.DoubleSide : m.userData.side;
        m.needsUpdate = true;
      }
    }
    if (!this.dirty) return;
    this.dirty = false;
    for (const p of rig.parts) {
      const isShell = p.sys === 'shell';
      let visible = !this.hidden.has(p.sys) && !(isShell && this.shell === 'hidden');
      if (this.solo) { const i = p.id.indexOf(':'); if (i > 0 && p.id.slice(i + 1) !== this.solo) visible = false; }
      const lit = this.highlight.has(p);
      const ghost = !lit && this.focus !== null && !this.focus.has(p.sys);
      if (ghost && isShell) visible = false;
      p.group.visible = visible;
      if (!visible) continue;
      for (const mesh of p.meshes) {
        const base = mesh.userData.base as THREE.Material;
        let mat: THREE.Material = base;
        if (lit) mat = this.glowing(this.colorBySystem ? this.tinted(base, p.sys) : base);
        else if (ghost) mat = GHOST;
        else if (isShell && this.shell === 'glass') mat = GLASS;
        else if (this.colorBySystem && !isShell) mat = this.tinted(base, p.sys);
        mesh.material = mat;
        const see = mat === GHOST || mat === GLASS;
        mesh.castShadow = !see && mesh.userData.shadow !== false;
        mesh.renderOrder = see ? 5 : 0;
      }
    }
  }
}
