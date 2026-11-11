// The interface: typing, time control, ways of looking inside, part inspection and the guided tour.

import * as THREE from 'three';
import type { App } from '../app';
import { ViewModes, ShellMode } from '../view/modes';
import { ForceView, FORCE_LEGEND } from '../view/forces';
import { Part, Sys, SYS_COLOR, SYS_LABEL } from '../view/rig';
import { CameraRig } from './camera';
import { Sound } from './sound';
import { Replay } from './replay';
import { Scope } from './scope';
import { Tour, StepView, TourHost } from './tour';
import { TOUR } from './tourContent';
import { info } from './partsInfo';
import { clear, h, segmented, slider, toggle } from './dom';
import { MARGIN } from '../sim/layout';

const SPEEDS: Array<[number, string]> = [[1, '1×'], [0.25, '¼'], [0.05, '1⁄20'], [0.01, '1⁄100'], [0.002, '1⁄500']];
const FOCUS: Array<[string, Sys[] | null]> = [
  ['Everything', null], ['Type action', ['keys', 'typeaction']], ['Escapement', ['escapement', 'carriage']], ['Ribbon', ['ribbon', 'typeaction']],
  ['Shift', ['shift', 'feed', 'paper']], ['Line feed', ['feed', 'carriage', 'paper', 'shift']], ['Bell', ['bell', 'carriage']],
];
const LABELLED = ['lever:KeyG', 'sub:KeyG', 'bar:KeyG', 'link2:KeyG', 'segment', 'ubar', 'rocker', 'escapeWheel', 'drum', 'truck', 'platen', 'lineLever', 'vibrator', 'shiftFrame', 'spaceBar', 'bell', 'ribbonLever', 'cradle'];

export class UI implements TourHost {
  readonly modes: ViewModes;
  readonly cam: CameraRig;
  readonly sound = new Sound();
  readonly replay: Replay;
  readonly scope: Scope;
  readonly tour: Tour;
  readonly forces: ForceView;
  private forceLegend = h('ul', { class: 'legend forces', hidden: true }, ...FORCE_LEGEND.map(([color, text]) => h('li', {}, h('i', { style: { background: color } }), text)), h('li', { class: 'hint' }, 'Arrow length grows with the square root of the force. Live only: use slow motion.'));
  private root: HTMLElement;
  private tooltip = h('div', { class: 'tooltip', hidden: true });
  private toast = h('div', { class: 'toast', hidden: true, role: 'status' });
  private infoCard = h('section', { class: 'panel info', hidden: true, 'aria-label': 'Selected part' });
  private labelLayer = h('div', { class: 'labels' });
  private labels = new Map<string, HTMLElement>();
  private status = h('div', { class: 'status' });
  private scrub!: HTMLInputElement;
  private scrubRow!: HTMLElement;
  private playBtn!: HTMLButtonElement;
  private speedNote = h('span', { class: 'lbl note' });
  private speedSeg!: { el: HTMLElement; set: (v: string) => void };
  private shellSeg!: { el: HTMLElement; set: (v: ShellMode) => void };
  private explodeSl!: { row: HTMLElement; set: (v: number) => void };
  private sliceSl!: { row: HTMLElement; set: (v: number) => void };
  private focusBtns: HTMLButtonElement[] = [];
  private colorTg!: { el: HTMLButtonElement; set: (v: boolean) => void };
  private forceTg!: { el: HTMLButtonElement; set: (v: boolean) => void };
  private showLabels = false;
  private hovered: Part | null = null;
  private selected: Part | null = null;
  private tourHi: Part[] = [];
  private ray = new THREE.Raycaster();
  private fingerMeshes: THREE.Mesh[] = [];
  private handMesh: THREE.Mesh;
  private byChar = new Map<string, { code: string; shift: boolean }>();
  private slow: string | null = null;
  private tick = 0;
  private tmp = new THREE.Vector3();

  constructor(private app: App) {
    this.modes = new ViewModes(app.rig);
    this.cam = new CameraRig(app.stage);
    this.replay = new Replay(app);
    this.scope = new Scope(app);
    this.tour = new Tour(app, this, TOUR);
    this.forces = new ForceView(app);
    app.onReset.push(() => { this.replay.reset(); this.scope.reset(); });
    for (const k of app.tw.keys) { this.byChar.set(k.lower, { code: k.code, shift: false }); this.byChar.set(k.upper, { code: k.code, shift: true }); }
    this.root = document.getElementById('ui')!;
    this.build();

    const skin = new THREE.MeshStandardMaterial({ color: 0xd9a989, roughness: 0.7, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.0072, 0.03, 6, 14), skin);
      m.geometry.translate(0, 0.0222, 0);
      m.rotation.x = -0.5;
      m.visible = false;
      m.castShadow = true;
      app.stage.scene.add(m);
      this.fingerMeshes.push(m);
    }
    this.handMesh = new THREE.Mesh(new THREE.SphereGeometry(0.017, 20, 14), skin);
    this.handMesh.scale.set(1, 0.7, 1.2);
    this.handMesh.visible = false;
    app.stage.scene.add(this.handMesh);

    app.typist.onChange = () => this.updateStatus();
    app.stage.controls.addEventListener('start', () => this.cam.cancel());
    window.addEventListener('keydown', (e) => this.onKey(e));
    const cv = app.stage.canvas;
    // A press that does not drag is a click on a part; a drag orbits the camera.
    let down: { x: number; y: number } | null = null;
    cv.addEventListener('pointerdown', (e) => { this.sound.unlock(); down = { x: e.clientX, y: e.clientY }; });
    cv.addEventListener('pointerup', (e) => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) this.click(e); down = null; });
    cv.addEventListener('pointermove', (e) => { if (e.buttons === 0) this.hover(e); });
    cv.addEventListener('pointerleave', () => this.setHover(null));
    app.onFrame.push((dt, simDt) => this.frame(dt, simDt));
    this.updateStatus();
  }

  // --- TourHost -----------------------------------------------------------------------------------
  applyView(v: StepView, seconds: number): void {
    const m = this.modes;
    this.cam.go(v.shot, seconds);
    // A step states its whole view: anything it leaves out goes back to the plain machine.
    m.shell = v.shell ?? 'solid';
    this.shellSeg.set(m.shell);
    this.setFocus(v.focus ?? null);
    m.explodeTarget = v.explode ?? 0;
    this.explodeSl.set(m.explodeTarget);
    m.colorBySystem = v.color ?? false;
    this.colorTg.set(m.colorBySystem);
    m.solo = v.solo ?? null;
    m.slice = v.slice ?? null;
    m.sliceBack = v.sliceBack ?? null;
    this.sliceSl.set(0);
    this.forces.enabled = v.forces ?? false;
    this.forceTg.set(this.forces.enabled);
    this.forceLegend.hidden = !this.forces.enabled;
    this.tourHi = (v.highlight ?? []).map((id) => this.app.rig.byId.get(id)).filter((p): p is Part => !!p);
    this.applyHighlight();
    m.invalidate();
  }
  setSpeed(scale: number): void {
    this.app.timeScale = scale;
    const s = SPEEDS.find(([v]) => Math.abs(v - scale) < 1e-9);
    this.speedSeg.set(s ? s[1] : '');
    this.speedNote.textContent = s ? '' : `slowed ${Math.round(1 / scale)}×`;
  }
  setPaused(p: boolean): void {
    if (!p) this.replay.exit();
    this.app.paused = p;
    this.playBtn.textContent = p ? '▶ Play' : '❚❚ Pause';
    this.playBtn.setAttribute('aria-pressed', String(p));
    this.scrubRow.hidden = !p || this.replay.length < 2;
    if (p) { this.scrub.max = String(this.replay.length - 1); this.scrub.value = this.scrub.max; }
  }
  onTourChange(): void { this.infoCard.hidden = this.tour.active || !this.selected; this.updateStatus(); if (!this.tour.active) { this.tourHi = []; this.modes.solo = null; this.applyHighlight(); this.modes.invalidate(); } }

  // --- Building the panels ------------------------------------------------------------------------
  private build(): void {
    const m = this.modes, app = this.app;
    const top = h('header', { class: 'topbar' },
      h('div', { class: 'brand' }, h('b', {}, 'Typewriter'), h('span', {}, 'a working model you can take apart')),
      h('button', { class: 'btn primary', onclick: () => { this.sound.unlock(); this.tour.start(0); } }, 'Guided tour'),
    );

    this.shellSeg = segmented<ShellMode>([['solid', 'Solid'], ['glass', 'Glass'], ['hidden', 'Off']], 'solid', (v) => { m.shell = v; m.invalidate(); });
    const focusRow = h('div', { class: 'chips' }, ...FOCUS.map(([label, set], i) => {
      const b = h('button', { type: 'button', class: 'chip' + (i === 0 ? ' on' : ''), onclick: () => { this.setFocus(set); if (set && m.shell === 'solid') { m.shell = 'glass'; this.shellSeg.set('glass'); } } }, label);
      this.focusBtns.push(b);
      return b;
    }));
    this.explodeSl = slider('Exploded', 0, 1, 0.01, 0, (v) => { m.explodeTarget = v; }, (v) => `${Math.round(v * 100)}%`);
    const slice = (this.sliceSl = slider('Slice', 0, 1, 0.01, 0, (v) => { m.sliceBack = null; m.slice = v < 0.01 ? null : 0.16 - v * 0.32; }, (v) => (v < 0.01 ? 'off' : `${Math.round(v * 100)}%`)));
    this.colorTg = toggle('Colour by job', false, (v) => { m.colorBySystem = v; m.invalidate(); }, 'Tint each part by the job it does');
    const labelsTg = toggle('Labels', false, (v) => { this.showLabels = v; if (!v) this.labelLayer.replaceChildren(), this.labels.clear(); }, 'Name the main parts');
    const scopeTg = toggle('Instruments', false, (v) => { this.scope.el.hidden = !v; }, 'Chart the last keystroke and the energy ledger');
    const forceTg = this.forceTg = toggle('Forces', false, (v) => { this.forces.enabled = v; this.forceLegend.hidden = !v; }, 'Draw the forces the solver computes: finger, links, impact, spring');
    const shots: Array<[string, string]> = [['typist', 'Typist'], ['side', 'Side'], ['top', 'Top'], ['rear', 'Rear'], ['linkage', 'Linkage'], ['print', 'Print point'], ['escapement', 'Escapement'], ['drum', 'Spring']];
    const right = h('aside', { class: 'panel look', 'aria-label': 'Look inside' },
      h('h3', {}, 'Look inside'),
      h('div', { class: 'row' }, h('span', { class: 'lbl' }, 'Body'), this.shellSeg.el),
      h('div', { class: 'lbl' }, 'Focus on'), focusRow,
      this.explodeSl.row, slice.row,
      h('div', { class: 'chips' }, this.colorTg.el, labelsTg.el, scopeTg.el, forceTg.el),
      this.forceLegend,
      h('div', { class: 'lbl' }, 'Camera'),
      h('div', { class: 'chips' }, ...shots.map(([id, label]) => h('button', { type: 'button', class: 'chip', onclick: () => this.cam.go(id) }, label))),
    );

    this.playBtn = h('button', { class: 'btn', 'aria-pressed': 'false', title: 'Pause or resume (`)', onclick: () => this.setPaused(!app.paused) }, '❚❚ Pause');
    const stepBtn = h('button', { class: 'btn', title: 'Advance one millisecond of machine time (→)', onclick: () => this.nudge(1) }, '+1 ms');
    this.speedSeg = segmented(SPEEDS.map(([, l]) => [l, l] as [string, string]), '1×', (l) => { app.timeScale = SPEEDS.find(([, x]) => x === l)![0]; this.speedNote.textContent = ''; });
    this.scrub = h('input', { type: 'range', min: '0', max: '1', step: '1', value: '1', 'aria-label': 'Replay position', oninput: () => { this.replay.show(Number(this.scrub.value)); this.updateStatus(); } });
    this.scrubRow = h('label', { class: 'row scrub', hidden: true }, h('span', { class: 'lbl' }, 'Replay'), this.scrub);
    const touch = slider('Touch', 1, 6, 0.1, app.tw.touch, (v) => { app.tw.touch = v; }, (v) => `${v.toFixed(1)} N`);
    const soundTg = toggle('Sound', true, (v) => { this.sound.enabled = v; if (v) this.sound.unlock(); });
    const autoTg = toggle('Auto return', false, (v) => { app.typist.autoReturn = v; }, 'Return the carriage automatically when the line is full');
    const bottom = h('footer', { class: 'panel time', 'aria-label': 'Time and typing' },
      h('div', { class: 'row' }, this.playBtn, stepBtn, h('span', { class: 'lbl' }, 'Speed'), this.speedSeg.el, this.speedNote, touch.row, soundTg.el, autoTg.el,
        h('button', { class: 'btn', onclick: () => { app.typist.clear(); app.tw.newSheet(); this.replay.reset(); }, title: 'Put in a fresh sheet of paper' }, 'New sheet')),
      this.scrubRow, this.status,
    );
    this.root.append(top, this.tour.panel, this.infoCard, right, this.scope.el, bottom, this.labelLayer, this.tooltip, this.toast);
    // Clicking a control must not steal the keyboard from the typewriter.
    this.root.addEventListener('pointerup', () => window.setTimeout(() => { const a = document.activeElement as HTMLElement | null; if (a && a.tagName === 'BUTTON') a.blur(); }, 0));
    this.root.addEventListener('pointerdown', () => this.sound.unlock());
  }

  private setFocus(set: Sys[] | null): void {
    this.modes.focus = set ? new Set(set) : null;
    this.focusBtns.forEach((b, i) => b.classList.toggle('on', JSON.stringify(FOCUS[i][1]) === JSON.stringify(set)));
    this.modes.invalidate();
  }

  private applyHighlight(): void {
    const set = new Set<Part>(this.tourHi);
    if (this.hovered) set.add(this.hovered);
    if (this.selected) set.add(this.selected);
    this.modes.setHighlight(set);
  }

  // --- Typing -------------------------------------------------------------------------------------
  private onKey(e: KeyboardEvent): void {
    this.sound.unlock();
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' && (el as HTMLInputElement).type !== 'range' || el.tagName === 'TEXTAREA')) return;
    const app = this.app;
    if (e.key === 'Escape') { if (this.tour.active) this.tour.stop(); else this.select(null); return; }
    if (e.code === 'Backquote') { this.setPaused(!app.paused); e.preventDefault(); return; }
    if (e.code === 'Backslash') { this.setSpeed(app.timeScale === 1 ? 0.05 : 1); e.preventDefault(); return; }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { this.nudge(e.key === 'ArrowRight' ? 1 : -1); e.preventDefault(); return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const i = SPEEDS.findIndex(([v]) => Math.abs(v - app.timeScale) < 1e-9);
      this.setSpeed(SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, (i < 0 ? 0 : i) + (e.key === 'ArrowDown' ? 1 : -1)))][0]);
      e.preventDefault();
      return;
    }
    if (e.repeat) { if (e.key === ' ' || e.key === 'Backspace') e.preventDefault(); return; }
    if (!this.tour.typingAllowed) { if (e.key === ' ') e.preventDefault(); if (e.key.length === 1 || e.key === 'Enter') this.say('The tour is driving the machine. Press Esc to leave it and type yourself.'); return; }
    if (this.replay.active || app.paused) { if (e.key.length === 1 || e.key === 'Enter') this.say('Paused. Press Play (or `) to type.'); if (e.key === ' ') e.preventDefault(); return; }
    if (e.key === ' ') { app.typist.enqueue({ kind: 'space' }); e.preventDefault(); }
    else if (e.key === 'Enter') { app.typist.enqueue({ kind: 'return' }); e.preventDefault(); }
    else if (e.key === 'Backspace') { app.typist.enqueue({ kind: 'backspace' }); e.preventDefault(); }
    else {
      const k = this.byChar.get(e.key) ?? (e.key.length === 1 ? this.byCode(e.code, e.shiftKey) : undefined);
      if (k) { app.typist.enqueue({ kind: 'char', ...k }); e.preventDefault(); }
    }
  }

  private byCode(code: string, shift: boolean): { code: string; shift: boolean } | undefined { return this.app.tw.byCode.has(code) ? { code, shift } : undefined; }

  /** While paused: move through the replay, or step the machine forward a millisecond at a time. */
  private nudge(dir: number): void {
    const app = this.app;
    if (!app.paused) this.setPaused(true);
    if (dir < 0 || this.replay.active && this.replay.cursor < this.replay.length - 1) {
      const i = (this.replay.active ? this.replay.cursor : this.replay.length - 1) + dir * 4;
      this.replay.show(i);
      this.scrub.value = String(this.replay.cursor);
    } else {
      this.replay.exit();
      app.tw.advance(0.001);
      this.replay.record();
      this.scrub.max = String(this.replay.length - 1);
      this.scrub.value = this.scrub.max;
      this.scrubRow.hidden = this.replay.length < 2;
    }
    this.updateStatus();
  }

  // --- Pointing at parts --------------------------------------------------------------------------
  private pick(e: PointerEvent): Part | null {
    const r = this.app.stage.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.app.stage.camera);
    for (const hit of this.ray.intersectObject(this.app.rig.root, true)) {
      const mesh = hit.object as THREE.Mesh, part = mesh.userData.part as Part | undefined;
      if (!part || !part.group.visible) continue;
      if ((mesh.material as THREE.Material).transparent && (mesh.material as THREE.Material).opacity < 0.5) continue;
      return part;
    }
    return null;
  }

  private setHover(p: Part | null): void {
    if (p === this.hovered) return;
    this.hovered = p;
    this.applyHighlight();
    this.tooltip.hidden = !p;
    if (p) this.tooltip.replaceChildren(h('b', {}, this.partName(p)), h('span', {}, SYS_LABEL[p.sys]));
    this.app.stage.canvas.style.cursor = p ? 'pointer' : '';
  }

  private hover(e: PointerEvent): void {
    const p = this.pick(e);
    this.setHover(p);
    if (p) { this.tooltip.style.left = `${e.clientX + 14}px`; this.tooltip.style.top = `${e.clientY + 14}px`; }
  }

  private partName(p: Part): string {
    const key = p.id.includes(':') ? this.app.tw.byCode.get(p.id.split(':')[1]) : undefined;
    return key ? `${info(p.kind).name} · ${key.geom.upper === key.geom.lower.toUpperCase() ? key.geom.upper : key.geom.lower + ' ' + key.geom.upper}` : info(p.kind).name;
  }

  private click(e: PointerEvent): void {
    const p = this.pick(e);
    // Clicking a key types it (when you are in charge of the machine).
    if (p && this.tour.typingAllowed && !this.app.paused) {
      if (p.kind === 'keyLever') { const code = p.id.split(':')[1]; this.app.typist.enqueue({ kind: 'char', code, shift: false }); }
      else if (p.kind === 'spaceBar') this.app.typist.enqueue({ kind: 'space' });
      else if (p.kind === 'backspace') this.app.typist.enqueue({ kind: 'backspace' });
      else if (p.kind === 'lineLever') this.app.typist.enqueue({ kind: 'return' });
    }
    this.select(p);
  }

  private select(p: Part | null): void {
    if (this.slow) { this.app.tw.keyUp(this.slow); this.slow = null; }
    this.selected = p;
    this.applyHighlight();
    const card = this.infoCard;
    clear(card);
    card.hidden = !p || this.tour.active;
    if (!p) return;
    const i = info(p.kind);
    card.append(
      h('header', {}, h('span', { class: 'eyebrow' }, h('i', { style: { background: '#' + SYS_COLOR[p.sys].toString(16).padStart(6, '0') } }), SYS_LABEL[p.sys]), h('button', { class: 'icon', title: 'Close', 'aria-label': 'Close', onclick: () => this.select(null) }, '×')),
      h('h2', {}, this.partName(p)), h('p', {}, i.what), h('p', {}, i.how),
    );
    if (p.kind === 'keyLever') {
      const code = p.id.split(':')[1];
      const s = slider('Press slowly', 0, 1, 0.005, 0, (v) => {
        if (this.app.paused || !this.tour.typingAllowed) return;
        if (this.slow !== code) { this.app.tw.keyDown(code, { servo: true }); this.slow = code; }
        this.app.tw.servoDepth.set(code, v * 0.0155);
      }, (v) => `${Math.round(v * 100)}%`);
      card.append(s.row, h('p', { class: 'hint' }, 'Drag to push this key down by hand. Go slowly and the type only kisses the paper: without momentum it leaves a faint ghost at most. The carriage waits until you let the key up.'),
        h('button', { class: 'btn', onclick: () => { s.set(0); if (this.slow) { this.app.tw.keyUp(this.slow); this.slow = null; } } }, 'Let go'));
    }
    card.append(h('button', { class: 'btn', onclick: () => { const f = FOCUS.find(([, set]) => set?.includes(p.sys)); this.setFocus(f ? f[1] : null); if (this.modes.shell === 'solid') { this.modes.shell = 'glass'; this.shellSeg.set('glass'); } } }, 'Focus on its mechanism'));
  }

  private say(text: string): void {
    this.toast.textContent = text;
    this.toast.hidden = false;
    window.clearTimeout((this.toast as unknown as { t?: number }).t);
    (this.toast as unknown as { t?: number }).t = window.setTimeout(() => { this.toast.hidden = true; }, 3200);
  }

  private updateStatus(): void {
    const { tw, typist } = this.app;
    const parts: string[] = [];
    if (this.replay.active) parts.push(`Replay: ${((this.replay.timeAt(this.replay.cursor) - this.replay.timeAt(this.replay.length - 1)) * 1000).toFixed(1)} ms`);
    parts.push(`Line ${Math.round(tw.line) + 1}, column ${Math.round(tw.column - MARGIN.left) + 1} of ${MARGIN.right - MARGIN.left}`);
    if (typist.pending) parts.push(`${typist.pending} keystroke${typist.pending > 1 ? 's' : ''} waiting`);
    if (typist.lineLocked) parts.push('End of line: the keys are locked. Press Enter to return the carriage.');
    if (this.app.achieved < 0.9 && !this.app.paused) parts.push('Running slower than real time on this device');
    if (!tw.marks.length && !typist.pending && !this.tour.active) parts.push('Just type. Enter returns the carriage; the guided tour explains every part.');
    this.status.textContent = parts.join('  ·  ');
    this.status.classList.toggle('warn', typist.lineLocked);
  }

  // --- Per frame ----------------------------------------------------------------------------------
  private frame(dt: number, simDt: number): void {
    const app = this.app, tw = app.tw;
    for (const e of tw.events) { this.sound.play(e, app.timeScale); this.tour.observe(e.type); if (e.type === 'locked') this.say('End of line: press Enter to return the carriage.'); }
    tw.events = [];
    this.replay.record();
    this.scope.sample();
    this.scope.cursor = this.replay.active ? this.replay.timeAt(this.replay.cursor) : null;
    this.cam.update(dt);
    this.modes.update(dt);
    this.forces.update(simDt, !this.replay.active);

    // Fingers and the returning hand, live or from the recording.
    const live = !this.replay.active;
    for (let i = 0; i < this.fingerMeshes.length; i++) {
      const m = this.fingerMeshes[i];
      if (live) { const f = tw.fingers[i]; m.visible = !!f; if (f) { const p = f.body.world(f.contact.pa); m.position.set(p[0], p[1], p[2]); } }
      else { m.visible = i * 3 < this.replay.fingers.length; if (m.visible) m.position.set(this.replay.fingers[i * 3], this.replay.fingers[i * 3 + 1], this.replay.fingers[i * 3 + 2]); }
    }
    const push = live ? tw.hand.push : this.replay.handPush;
    this.handMesh.visible = push > 0.05;
    if (this.handMesh.visible) { const lever = app.rig.byId.get('lineLever')!; lever.world(tw.core.points.leverHandle, this.tmp); this.handMesh.position.copy(this.tmp).add(new THREE.Vector3(-0.02, 0.004, 0.004)); }

    if (++this.tick % 6 === 0) { this.scope.draw(); this.updateStatus(); if (this.tour.active) this.tour.refresh(); }
    if (this.showLabels) this.placeLabels();
  }

  private placeLabels(): void {
    const cam = this.app.stage.camera, cv = this.app.stage.canvas, w = cv.clientWidth, hh = cv.clientHeight;
    for (const id of LABELLED) {
      const p = this.app.rig.byId.get(id);
      if (!p) continue;
      let el = this.labels.get(id);
      const shown = p.group.visible && !(this.modes.focus && !this.modes.focus.has(p.sys)) && !(p.sys === 'shell');
      if (!shown) { if (el) el.hidden = true; continue; }
      if (!el) { el = h('div', { class: 'label' }, info(p.kind).name); this.labels.set(id, el); this.labelLayer.append(el); }
      p.world(p.anchor, this.tmp).project(cam);
      el.hidden = this.tmp.z > 1 || Math.abs(this.tmp.x) > 1 || Math.abs(this.tmp.y) > 1;
      if (!el.hidden) el.style.transform = `translate(${((this.tmp.x + 1) / 2) * w}px, ${((1 - this.tmp.y) / 2) * hh}px)`;
    }
  }
}
