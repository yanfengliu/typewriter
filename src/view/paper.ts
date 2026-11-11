// The sheet of paper: a strip that follows the platen, and the ink stamped onto it.
// Each impression is drawn where the physics says the type face met the paper, as dark as the blow was hard.

import * as THREE from 'three';
import type { Mark, Typewriter } from '../sim/machine';
import { CARRIAGE_X0, F, PAPER, PAPER_T, PLATEN_AXIS, PLATEN_R, U } from '../sim/layout';
import type { Vec3 } from '../sim/vec';
import { Rig } from './rig';

const COLS = 12, ROWS = 8, CW = 96, CH = 128;
/** Size of one stamped glyph cell on the sheet (m). */
const STAMP_W = 0.0029, STAMP_H = (STAMP_W * CH) / CW;

function glyphAtlas(chars: string[]): { texture: THREE.CanvasTexture; index: Map<string, number> } {
  const cv = document.createElement('canvas');
  cv.width = COLS * CW; cv.height = ROWS * CH;
  const g = cv.getContext('2d')!;
  g.clearRect(0, 0, cv.width, cv.height);
  g.fillStyle = '#fff';
  g.strokeStyle = '#fff';
  g.lineWidth = 4.2;
  g.lineJoin = 'round';
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.font = 'bold 134px "Courier Prime","Courier New",Courier,monospace';
  const index = new Map<string, number>();
  chars.forEach((ch, i) => {
    index.set(ch, i);
    const cx = (i % COLS) * CW + CW / 2, cy = Math.floor(i / COLS) * CH + CH * 0.72;
    g.save();
    g.beginPath();
    g.rect((i % COLS) * CW, Math.floor(i / COLS) * CH, CW, CH);
    g.clip();
    g.shadowColor = '#fff';
    g.shadowBlur = 1.5;
    g.fillText(ch, cx, cy);
    g.strokeText(ch, cx, cy);
    g.restore();
  });
  const texture = new THREE.CanvasTexture(cv);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return { texture, index };
}

const STAMP_FRAG = /* glsl */ `
uniform sampler2D atlas; uniform vec4 cell; uniform float ink; uniform float seed;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main() {
  float a = texture2D(atlas, cell.xy + vUv * cell.zw).a;
  vec2 p = gl_FragCoord.xy;
  // cloth ribbon weave and the unevenness of a struck impression
  float weave = 0.86 + 0.14 * sin(p.x * 1.9) * sin(p.y * 1.9);
  float blot = 0.8 + 0.4 * noise(p * 0.13 + seed);
  float alpha = clamp(a * ink * weave * blot * 1.35, 0.0, 1.0);
  gl_FragColor = vec4(vec3(0.07, 0.065, 0.085), alpha);
}`;

export class PaperView {
  readonly target: THREE.WebGLRenderTarget;
  private stampScene = new THREE.Scene();
  private stampCam: THREE.OrthographicCamera;
  private stamp: THREE.Mesh;
  private uniforms: { atlas: { value: THREE.Texture }; cell: { value: THREE.Vector4 }; ink: { value: number }; seed: { value: number } };
  private glyphs: Map<string, number>;
  private drawn = 0;
  private drawnUntil = Infinity;
  /** Hide impressions made after this simulation time (used when scrubbing a replay). */
  visibleUntil = Infinity;
  private geometry: THREE.BufferGeometry;
  private lastFeed = NaN;
  private readonly segs = 120;
  readonly mesh: THREE.Mesh;

  constructor(private rig: Rig, private tw: Typewriter, private renderer: THREE.WebGLRenderer) {
    const chars = tw.keys.flatMap((k) => [k.lower, k.upper]);
    const atlas = glyphAtlas(chars);
    this.glyphs = atlas.index;
    const pxPerM = 2048 / PAPER.width;
    this.target = new THREE.WebGLRenderTarget(2048, Math.round(PAPER.height * pxPerM), { depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
    this.target.texture.colorSpace = THREE.SRGBColorSpace;
    this.target.texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    this.stampCam = new THREE.OrthographicCamera(0, PAPER.width, PAPER.height, 0, -1, 1);
    this.uniforms = { atlas: { value: atlas.texture }, cell: { value: new THREE.Vector4() }, ink: { value: 1 }, seed: { value: 0 } };
    this.stamp = new THREE.Mesh(new THREE.PlaneGeometry(STAMP_W, STAMP_H), new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: STAMP_FRAG,
    }));
    this.stampScene.add(this.stamp);
    this.clear();

    // The sheet is carried by the cradle (so it travels with the carriage and rises with Shift).
    const part = rig.part('paper', { kind: 'paper', sys: 'paper', body: tw.core.cradle, explode: [0, 0.22, -0.09], anchor: [CARRIAGE_X0, PLATEN_AXIS[1] + 0.09, PLATEN_AXIS[2] - 0.03] });
    const n = this.segs + 1;
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));
    this.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));
    const uv = new Float32Array(n * 2 * 2);
    const idx: number[] = [];
    for (let i = 0; i < n; i++) {
      uv.set([0, 1 - i / this.segs, 1, 1 - i / this.segs], i * 4);
      if (i < this.segs) idx.push(2 * i, 2 * i + 2, 2 * i + 1, 2 * i + 1, 2 * i + 2, 2 * i + 3);
    }
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geometry.setIndex(idx);
    const mat = new THREE.MeshStandardMaterial({ map: this.target.texture, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
    this.mesh = part.add(this.geometry, mat, { shadow: true });
    this.mesh.frustumCulled = false;
    rig.updaters.push(() => this.update());
  }

  /** Point on the paper path at arc length s from the printing line (s > 0 is the already-typed part). */
  private path(s: number, out: Vec3, nrm: Vec3): void {
    const R = PLATEN_R + PAPER_T, A = PLATEN_AXIS;
    const up = 0.82, back = 2.62; // radians of wrap above the print line in front, and round the back
    const set = (f: number, u: number, nf: number, nu: number) => {
      out[1] = A[1] + f * F[1] + u * U[1]; out[2] = A[2] + f * F[2] + u * U[2];
      nrm[1] = nf * F[1] + nu * U[1]; nrm[2] = nf * F[2] + nu * U[2];
    };
    if (s >= -back * R && s <= up * R) { const d = s / R; set(R * Math.cos(d), R * Math.sin(d), Math.cos(d), Math.sin(d)); return; }
    if (s > up * R) {
      // Leaves the platen under the bail, then straightens up to lean back on the paper rest.
      const t = s - up * R, k = 0.035;
      const lean0 = up, lean1 = 0.42;
      // lean(t) = lean1 + (lean0 - lean1) exp(-t/k)
      const dl = lean0 - lean1, e = Math.exp(-t / k);
      // mean lean over the free length gives the chord direction
      const mid = lean1 + (dl * (1 - e) * k) / Math.max(t, 1e-9);
      const f = R * Math.cos(up) - t * Math.sin(mid), u = R * Math.sin(up) + t * Math.cos(mid);
      const a = lean1 + dl * e;
      set(f, u, Math.cos(a), Math.sin(a));
      return;
    }
    const t = -s - back * R;
    const d = -back;
    // unused part: runs up the paper table behind the platen
    set(R * Math.cos(d) + t * Math.sin(d), R * Math.sin(d) - t * Math.cos(d), Math.cos(d), Math.sin(d));
  }

  private update(): void {
    this.drawMarks();
    const feed = PAPER.topMargin + PLATEN_R * this.tw.core.platen.q;
    if (feed === this.lastFeed) return;
    this.lastFeed = feed;
    const pos = this.geometry.attributes.position as THREE.BufferAttribute, nor = this.geometry.attributes.normal as THREE.BufferAttribute;
    const p: Vec3 = [0, 0, 0], nv: Vec3 = [0, 0, 0];
    const x0 = CARRIAGE_X0 - PAPER.width / 2, x1 = CARRIAGE_X0 + PAPER.width / 2;
    for (let i = 0; i <= this.segs; i++) {
      this.path(feed - (i / this.segs) * PAPER.height, p, nv);
      pos.setXYZ(2 * i, x0, p[1], p[2]); pos.setXYZ(2 * i + 1, x1, p[1], p[2]);
      nor.setXYZ(2 * i, 0, nv[1], nv[2]); nor.setXYZ(2 * i + 1, 0, nv[1], nv[2]);
    }
    pos.needsUpdate = true; nor.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }

  clear(): void {
    const r = this.renderer, prev = r.getRenderTarget(), color = r.getClearColor(new THREE.Color()).clone(), alpha = r.getClearAlpha();
    r.setRenderTarget(this.target);
    r.setClearColor(new THREE.Color(0.93, 0.915, 0.875), 1);
    r.clear(true, false, false);
    // Rendering (even nothing) is what regenerates the target's mipmaps.
    const auto = r.autoClear;
    r.autoClear = false;
    this.stamp.visible = false;
    r.render(this.stampScene, this.stampCam);
    this.stamp.visible = true;
    r.autoClear = auto;
    r.setRenderTarget(prev);
    r.setClearColor(color, alpha);
    this.drawn = 0;
  }

  private drawMarks(): void {
    const marks = this.tw.marks;
    const visible = (m: Mark) => m.t <= this.visibleUntil;
    let want = marks.length;
    if (this.visibleUntil !== Infinity) { want = 0; while (want < marks.length && visible(marks[want])) want++; }
    if (want === this.drawn && this.drawnUntil === this.visibleUntil) return;
    if (want < this.drawn) this.clear();
    this.drawnUntil = this.visibleUntil;
    if (want === this.drawn) return;
    const r = this.renderer, prev = r.getRenderTarget(), auto = r.autoClear;
    r.setRenderTarget(this.target);
    r.autoClear = false;
    for (let i = this.drawn; i < want; i++) {
      const m = marks[i];
      const g = this.glyphs.get(m.ch);
      if (g === undefined || m.ink <= 0.01) continue;
      this.uniforms.cell.value.set((g % COLS) / COLS, 1 - (Math.floor(g / COLS) + 1) / ROWS, 1 / COLS, 1 / ROWS);
      this.uniforms.ink.value = m.ink;
      this.uniforms.seed.value = (m.seq * 7.13) % 97;
      this.stamp.position.set(m.u, PAPER.height - m.v - STAMP_H * 0.07, 0);
      r.render(this.stampScene, this.stampCam);
    }
    r.autoClear = auto;
    r.setRenderTarget(prev);
    this.drawn = want;
  }
}
