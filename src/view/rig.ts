// The model rig: every visible part is a group whose transform comes straight from the physics body it
// represents. Nothing here is animated by hand; if the simulation state changes, the model follows.

import * as THREE from 'three';
import type { Body } from '../sim/solver';
import type { Vec3 } from '../sim/vec';
import { span } from './geo';

export type Sys = 'shell' | 'frame' | 'keys' | 'typeaction' | 'escapement' | 'carriage' | 'ribbon' | 'shift' | 'feed' | 'bell' | 'paper';

export const SYS_LABEL: Record<Sys, string> = {
  shell: 'Body shell', frame: 'Frame', keys: 'Keyboard', typeaction: 'Type action', escapement: 'Escapement',
  carriage: 'Carriage & mainspring', ribbon: 'Ribbon', shift: 'Shift', feed: 'Line feed', bell: 'Bell & margins', paper: 'Paper',
};

/** Colours used when parts are tinted by the job they do. */
export const SYS_COLOR: Record<Sys, number> = {
  shell: 0x30343a, frame: 0x6b7078, keys: 0xe8b84a, typeaction: 0xe8793a, escapement: 0x3aa6e8, carriage: 0x4fc47f,
  ribbon: 0xd8433f, shift: 0xa06be0, feed: 0x2fc7c0, bell: 0xe86aa8, paper: 0xf2efe6,
};

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o);

export const MAT = {
  enamel: new THREE.MeshPhysicalMaterial({ color: 0x0d1013, roughness: 0.42, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12 }),
  enamelTrim: new THREE.MeshPhysicalMaterial({ color: 0x15191d, roughness: 0.5, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
  iron: std({ color: 0x23262a, roughness: 0.62, metalness: 0.45 }),
  steel: std({ color: 0xb4b8be, roughness: 0.34, metalness: 1 }),
  steelDark: std({ color: 0x6d7178, roughness: 0.42, metalness: 1 }),
  blued: std({ color: 0x2c3442, roughness: 0.3, metalness: 1 }),
  nickel: std({ color: 0xdcdcd4, roughness: 0.16, metalness: 1 }),
  brass: std({ color: 0xc79a45, roughness: 0.3, metalness: 1 }),
  rubber: std({ color: 0x0b0b0c, roughness: 0.82, metalness: 0 }),
  rubberGrey: std({ color: 0x2a2a2c, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }),
  felt: std({ color: 0x7c2a26, roughness: 1, metalness: 0 }),
  feltGreen: std({ color: 0x2d5a3a, roughness: 1, metalness: 0 }),
  keyBlack: new THREE.MeshPhysicalMaterial({ color: 0x0c0c0d, roughness: 0.25, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 }),
  ivory: std({ color: 0xe9e2cf, roughness: 0.5, metalness: 0 }),
  ribbonBlack: std({ color: 0x151517, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }),
  spring: std({ color: 0x8d9299, roughness: 0.38, metalness: 1 }),
  wire: std({ color: 0xa9adb3, roughness: 0.36, metalness: 1 }),
  cord: std({ color: 0xb9a37a, roughness: 0.9, metalness: 0 }),
  bell: std({ color: 0xd2b25a, roughness: 0.22, metalness: 1 }),
  skin: std({ color: 0xd9a989, roughness: 0.75, metalness: 0, transparent: true, opacity: 0.92 }),
};

export interface PartOptions {
  /** Kind used to look up the name and explanation (e.g. 'typebar'). */
  kind: string;
  sys: Sys;
  body?: Body | null;
  /** Displacement (m) at full "exploded view". */
  explode?: Vec3;
  /** Anchor point for labels (assembly coords). */
  anchor?: Vec3;
}

export class Part {
  readonly group = new THREE.Group();
  readonly meshes: THREE.Mesh[] = [];
  readonly kind: string;
  readonly sys: Sys;
  readonly body: Body | null;
  readonly explode: THREE.Vector3;
  anchor: Vec3;
  /** For parts geared to the mechanism rather than simulated bodies (pinion, spring drum, spools): sets the pose. */
  pose: ((m: THREE.Matrix4) => void) | null = null;
  /** Current world-space offset from exploding the view. */
  readonly offset = new THREE.Vector3();

  constructor(readonly id: string, o: PartOptions) {
    this.kind = o.kind;
    this.sys = o.sys;
    this.body = o.body ?? null;
    this.explode = new THREE.Vector3(...(o.explode ?? [0, 0, 0]));
    this.anchor = o.anchor ?? [0, 0, 0];
    this.group.matrixAutoUpdate = false;
    this.group.name = id;
  }

  add(geometry: THREE.BufferGeometry, material: THREE.Material, opts: { shadow?: boolean } = {}): THREE.Mesh {
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = opts.shadow ?? true;
    m.receiveShadow = true;
    m.userData.part = this;
    m.userData.base = material;
    m.userData.shadow = opts.shadow ?? true;
    this.meshes.push(m);
    this.group.add(m);
    return m;
  }

  /** World position of an assembly-space point on this part (including the exploded offset). */
  world(p0: Vec3, out: THREE.Vector3): THREE.Vector3 {
    if (this.body) { const w = this.body.world(p0); out.set(w[0], w[1], w[2]); } else out.set(p0[0], p0[1], p0[2]);
    return out.add(this.offset);
  }
}

interface LinkVis { obj: THREE.Object3D; a: Part; pa: Vec3; b: Part; pb: Vec3 }

export class Rig {
  readonly root = new THREE.Group();
  readonly parts: Part[] = [];
  readonly byId = new Map<string, Part>();
  private links: LinkVis[] = [];
  /** 0 = assembled, 1 = fully exploded. */
  explode = 0;
  /** Extra per-frame updaters (paper, ribbon, band...). */
  readonly updaters: Array<() => void> = [];
  private A = new THREE.Vector3();
  private B = new THREE.Vector3();
  private T = new THREE.Vector3();

  part(id: string, o: PartOptions): Part {
    const p = new Part(id, o);
    this.parts.push(p);
    this.byId.set(id, p);
    this.root.add(p.group);
    return p;
  }

  /**
   * A wire link or spring drawn between a point on part a and a point on part b. `part` owns the mesh (for
   * labels and highlighting); its geometry must be a unit object along +Y.
   */
  link(part: Part, geometry: THREE.BufferGeometry, material: THREE.Material, a: Part, pa: Vec3, b: Part, pb: Vec3): THREE.Mesh {
    const m = part.add(geometry, material);
    m.matrixAutoUpdate = true;
    part.group.matrixAutoUpdate = false;
    this.links.push({ obj: m, a, pa, b, pb });
    return m;
  }

  /** Copy the simulation state into the scene graph. */
  sync(): void {
    const e = this.explode;
    for (const p of this.parts) {
      p.offset.copy(p.explode).multiplyScalar(e);
      const m = p.group.matrix;
      const b = p.body;
      if (b) {
        b.ensureFrame();
        const R = b.R, t = b.t;
        m.set(R[0], R[1], R[2], t[0] + p.offset.x, R[3], R[4], R[5], t[1] + p.offset.y, R[6], R[7], R[8], t[2] + p.offset.z, 0, 0, 0, 1);
      } else if (p.pose) {
        p.pose(m);
        m.elements[12] += p.offset.x; m.elements[13] += p.offset.y; m.elements[14] += p.offset.z;
      } else m.makeTranslation(p.offset.x, p.offset.y, p.offset.z);
      p.group.matrixWorldNeedsUpdate = true;
    }
    for (const l of this.links) {
      const owner = (l.obj.userData.part as Part);
      l.a.world(l.pa, this.A);
      l.b.world(l.pb, this.B);
      // Link meshes live inside their owner's group, whose matrix is a pure translation.
      this.A.sub(owner.offset); this.B.sub(owner.offset);
      span(l.obj, this.A, this.B, this.T);
    }
    for (const u of this.updaters) u();
  }
}
