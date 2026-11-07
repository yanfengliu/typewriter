/// <reference types="vite/client" />
import './style.css';
import { BufferedTypewriter } from './buffered-typewriter';
import { createStudio } from './scene';
import { PaperStore } from './paper';
import { TypewriterAudio } from './audio';
import { createTutorial } from './tutorial';
import { baseKey, COLUMNS, PAPER_WIDTH, SHIFT_MAP, type SceneAPI, type ViewMode, type Sheet } from './contracts';

const icons = {
  sound: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 6 6m0-6-6 6"/>',
  inspect: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M10 7v6m-3-3h6"/>',
  paper: '<path d="M6 3h8l4 4v14H6Z"/><path d="M14 3v5h4M9 12h6m-6 4h6"/>',
  type: '<path d="M5 10V3h14v7M3 12h18v8H3ZM8 6h8M6 15h.01M10 15h.01M14 15h.01M18 15h.01M8 18h8"/>',
  sliders: '<path d="M4 7h7m4 0h5M4 17h3m4 0h9"/><circle cx="13" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  reset: '<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
};
function icon(name: keyof typeof icons): string { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`; }
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header class="masthead">
    <a class="brand" href="./" aria-label="Atelier writing room"><span class="brand-symbol">${icon('type')}</span><span>ATELIER<small>A MECHANICAL WRITING ROOM</small></span></a>
    <div class="header-actions"><button id="how-button" class="text-button">The mechanism <span class="tiny-arrow">↗</span></button><span class="header-rule"></span><button id="sound-button" class="icon-button sound-button" aria-label="Mute mechanical sound" aria-pressed="true">${icon('sound')}<span>Sound on</span></button></div>
  </header>
  <main class="studio">
    <section class="intro" aria-labelledby="room-title">
      <div class="eyebrow"><span class="orange-line"></span>AN EXERCISE IN PRESENCE</div>
      <h1 id="room-title">Make <br>your mark<span>.</span></h1>
      <p class="intro-copy">One key. One impression. <br>A page that remembers.</p>
      <div class="permanence-note"><span class="small-asterisk">✳</span><p>Real mechanisms. Permanent ink. <br>No undo. Just the next word.</p></div>
    </section>
    <div id="stage" class="stage" tabindex="0" role="application" aria-label="Interactive 3D typewriter. Type on your keyboard or click a key. Enter returns the carriage. Backspace moves without erasing. Escape releases keyboard focus."></div>
    <div class="machine-caption"><span class="caption-number">NO. 01</span><span>THE MANUAL TYPEWRITER</span><small>10 CHARACTERS / INCH</small></div>
    <div class="orbit-hint"><span class="orbit-glyph">⤾</span> Drag to explore <span>·</span> Scroll to get closer <button id="reset-view" class="icon-button" aria-label="Reset camera" title="Reset camera">${icon('reset')}</button></div>
    <section class="paper-status" aria-label="Paper and carriage position">
      <div class="loaded-label"><span class="status-light"></span><span id="loaded-label">PAPER LOADED</span></div>
      <div class="sheet-line"><span class="sheet-word">Sheet</span><span id="sheet-number">01</span><button id="tray-button" class="text-button tray-button" aria-label="Open saved sheets">View tray ${icon('arrow')}</button></div>
      <div class="position-line"><span>LINE <b id="line-number">01</b></span><span>COL <b id="column-number">01</b><span class="column-limit"> / 66</span></span></div>
      <div class="carriage-track" aria-hidden="true"><span id="carriage-progress"></span></div>
      <div class="stock-label">IVORY STOCK <span>8½ × 11 IN</span></div>
    </section>
    <div class="message-area" aria-live="polite" aria-atomic="true"><span id="status-message">Your page is waiting. Start typing.</span><button id="clear-jam" class="clear-jam" hidden>Release typebars ${icon('reset')}</button></div>
    <div id="storage-warning" class="storage-warning" role="status" hidden></div>
    <nav class="control-dock" aria-label="Typewriter controls">
      <div class="view-controls" role="group" aria-label="Viewing mode"><button class="view-button active" data-view="write" aria-pressed="true">${icon('type')}<span>Write</span></button><button class="view-button" data-view="inspect" aria-pressed="false">${icon('inspect')}<span>Inspect</span></button><button class="view-button" data-view="paper" aria-pressed="false">${icon('paper')}<span>Paper</span></button></div>
      <span class="dock-rule"></span><button id="cutaway-button" class="cutaway-button" aria-pressed="false"><span class="toggle"><i></i></span><span>Open cover</span></button>
      <button id="settings-button" class="icon-button settings-button" aria-label="Machine settings" title="Machine settings">${icon('sliders')}</button><span class="dock-rule"></span><button id="new-sheet" class="new-sheet">${icon('plus')}<span>New sheet</span></button><button id="download-button" class="icon-button download-button" aria-label="Download current sheet as PNG" title="Download this sheet">${icon('download')}</button>
    </nav>
  </main>
  <footer class="footer"><span class="footer-note">SLOW DOWN. SOMETHING IS TAKING SHAPE.</span><div class="keyboard-hints"><span><kbd>↵</kbd> Return</span><span><kbd>⌫</kbd> Backspace ≠ erase</span><span><kbd>⇧</kbd> Shift</span><span><kbd>↑ ↓</kbd> Feed paper</span></div><span class="local-note"><span></span> Stays on your device</span></footer>
  <section id="paper-view" class="paper-view" aria-label="Live paper view" hidden><div class="paper-view-header"><div><span class="eyebrow">THE ORIGINAL</span><h2>Every mark stays.</h2></div><button id="close-paper" class="icon-button" aria-label="Close paper view">${icon('close')}</button></div><div class="paper-zoom" role="group" aria-label="Paper magnification"><button id="paper-fit" aria-pressed="true">Fit</button><button id="paper-zoom-out" aria-label="Zoom paper out">−</button><output id="paper-zoom-value" aria-live="polite">Fit</output><button id="paper-zoom-in" aria-label="Zoom paper in">+</button><button id="paper-actual" aria-label="Show paper at full resolution" aria-pressed="false">100%</button><span>Scroll to read</span></div><div class="paper-canvas-wrap" id="paper-canvas-wrap"></div><div class="paper-view-footer"><span id="paper-view-count">0 impressions · Ivory stock</span><button id="paper-download" class="text-button">Download paper ${icon('download')}</button></div></section>
  <dialog id="how-dialog" class="modal how-dialog"><div class="dialog-header"><span class="eyebrow">INSIDE THE MACHINE</span><button class="icon-button dialog-close" aria-label="Close mechanism guide">${icon('close')}</button></div><h2>A small orchestra<br>of moving parts.</h2><p class="dialog-intro">There is no cursor. The strike point stays still, and the paper comes to it.</p><ol class="mechanism-list"><li><span>01</span><div><h3>The key & the typebar</h3><p>A key lever drives its typebar toward a shared printing point. The bar has inertia; its return spring brings it back. Fast keystrokes wait in order so the typebars do not collide.</p></div></li><li><span>02</span><div><h3>Ribbon, paper, platen</h3><p>The ribbon rises into the path of the type. Impact transfers ink onto paper backed by the rubber platen. Overtyping adds another impression.</p></div></li><li><span>03</span><div><h3>One tooth at a time</h3><p>After impact, the escapement releases the spring-pulled carriage by one character. At the right margin it stops. A bell warns you before you arrive.</p></div></li><li><span>04</span><div><h3>The return</h3><p>Enter returns the carriage and turns the platen for a new line. Backspace reverses one space without lifting ink. Arrow keys turn the platen in either direction.</p></div></li></ol><details class="model-note"><summary>About the simulation & its sources</summary><p>This is a reduced mechanical model: fixed-step angular motion, inertia, spring forces, damping, contact, and carriage stops. Values are illustrative, not measurements of a particular machine. Paper follows a constrained path around the platen; it is not a full sheet-deformation or ink-fluid simulation. Your keyboard cannot sense pressure, so strike force is adjustable.</p><p>The design combines a basket shift with full-drop escapement; it is a mechanical study, not a replica of a named model.</p><ul><li><a href="https://files.eric.ed.gov/fulltext/ED173578.pdf" target="_blank" rel="noopener noreferrer">U.S. Navy, Basic Machines — typewriter mechanisms, PDF pages 103–116 ↗</a></li><li><a href="https://site.xavier.edu/polt/typewriters/Royal1955.pdf" target="_blank" rel="noopener noreferrer">Royal service manual, 1955 — escapement, ribbon and basket shift ↗</a></li><li><a href="https://www.uspto.gov/web/patents/classification/uspc400/defs400.htm" target="_blank" rel="noopener noreferrer">USPTO Class 400 — full-drop escapement and ink transfer ↗</a></li></ul></details><p class="guide-tip"><kbd>Tab</kbd> advances to the next 8-column stop while the machine has focus. <kbd>Esc</kbd> releases focus, or frees jammed bars.</p></dialog>
  <dialog id="settings-dialog" class="modal settings-dialog"><div class="dialog-header"><span class="eyebrow">FIND YOUR TOUCH</span><button class="icon-button dialog-close" aria-label="Close machine settings">${icon('close')}</button></div><h2>The small adjustments.</h2><label class="range-label" for="force-input">Strike force <output id="force-value">1.00×</output></label><input id="force-input" type="range" min="0.55" max="1.4" step="0.05" value="1"><div class="range-ends"><span>Light touch</span><span>Firm impression</span></div><label class="select-label" for="spacing-input">Line spacing<select id="spacing-input"><option value="1">Single · 1/6 in</option><option value="1.5">One and a half</option><option value="2">Double · 1/3 in</option></select></label><fieldset class="ribbon-field"><legend>Ribbon color</legend><label><input type="radio" name="ribbon" value="black" checked><span class="ribbon-dot black"></span> Carbon black</label><label><input type="radio" name="ribbon" value="red"><span class="ribbon-dot red"></span> Vermilion</label></fieldset><label class="select-label" for="speed-input">Mechanism speed<select id="speed-input"><option value="1">Real time · 1×</option><option value="0.25">Slow motion · ¼×</option></select></label><p class="setting-note">Slow motion makes each impact visible. Your keystrokes stay queued while the mechanism catches up.</p></dialog>
  <dialog id="tray-dialog" class="modal tray-dialog"><div class="dialog-header"><span class="eyebrow">NOTHING DISAPPEARS</span><button class="icon-button dialog-close" aria-label="Close saved sheets">${icon('close')}</button></div><h2>The paper tray.</h2><p class="dialog-intro">Previous sheets stay here. Each one can be viewed and downloaded with every impression intact.</p><div id="tray-list" class="tray-list"></div><div id="archive-preview" class="archive-preview" hidden><div class="archive-preview-heading"><span id="archive-title"></span><button id="archive-download" class="text-button">Download ${icon('download')}</button></div><div id="archive-canvas"></div></div></dialog>
`;

const get = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const machine = new BufferedTypewriter();
const paper = new PaperStore();
const audio = new TypewriterAudio();
const stage = get('stage');
const paperView = get('paper-view');
let scene: SceneAPI | undefined;
let tutorial: ReturnType<typeof createTutorial> | undefined;
let view: ViewMode = 'write';
let cutaway = false;
let speed = 1;
let shiftHeld = false;
let capsLock = false;
let pointerShiftLatched = false;
let pointerShiftInFlight: string | undefined;
let lastStatus = '';
let statusUntil = 0;
let persistTimer: number | undefined;
let archivedSelection: Sheet | undefined;
let paperZoom: number | null = null;
const heldKeys = new Set<string>();
const shiftedFaces = Object.fromEntries(Object.entries(SHIFT_MAP).map(([face, base]) => [base, face]));
const abort = new AbortController();
const listen = <K extends keyof HTMLElementEventMap>(target: HTMLElement, event: K, handler: (event: HTMLElementEventMap[K]) => void) => target.addEventListener(event, handler, { signal: abort.signal });

paper.onWarning = message => { get('storage-warning').textContent = message; get('storage-warning').hidden = false; };
paper.reportPendingWarning();
machine.restorePosition(paper.position.column, paper.position.line);
get<HTMLInputElement>('force-input').value = String(machine.options.force);
get('force-value').textContent = `${machine.options.force.toFixed(2)}×`;
get('paper-canvas-wrap').append(paper.canvas);

function message(text: string, duration = 3200): void {
  if (text !== lastStatus) { get('status-message').textContent = text; lastStatus = text; }
  statusUntil = performance.now() + duration;
}
function saveNow(): void { window.clearTimeout(persistTimer); paper.save({ column: machine.state.column, line: machine.state.line }); }
function saveSoon(): void { window.clearTimeout(persistTimer); persistTimer = window.setTimeout(saveNow, 350); }
function gesture(): void { void audio.unlock(); }
function restoreShift(): void { machine.setShift(shiftHeld || capsLock || pointerShiftLatched || !!pointerShiftInFlight); }

function clickKey(key: string, down: boolean): void {
  if (tutorial?.active && down) return;
  if (down) {
    gesture(); stage.focus({ preventScroll: true });
    if (key === 'Shift') {
      pointerShiftLatched = !pointerShiftLatched;
      restoreShift();
      message(pointerShiftLatched ? 'Shift is ready for the next clicked key. Click Shift again to release it.' : 'Shift released.', 3000);
      return;
    }
    if (key.length === 1 && key !== ' ') {
      const shifted = pointerShiftLatched || shiftHeld || capsLock;
      if (pointerShiftLatched) {
        pointerShiftInFlight = baseKey(key);
        pointerShiftLatched = false;
      }
      machine.setShift(shifted);
      if (shifted) key = shiftedFaces[key] ?? key.toUpperCase();
    }
    machine.press(key);
  } else {
    // Pointer clicks cannot hold one key while selecting another. Keep Shift
    // latched across the scene's automatic 100 ms key release.
    if (key === 'Shift') return;
    machine.release(key);
    if (pointerShiftInFlight === baseKey(key) && !machine.state.bars.some(bar => bar.key === pointerShiftInFlight && bar.angle > .015)) {
      pointerShiftInFlight = undefined;
      restoreShift();
    }
  }
}

try { scene = createStudio(stage, paper.canvas, clickKey); }
catch {
  stage.innerHTML = '<div class="webgl-fallback"><span class="eyebrow">THE WRITING CAN CONTINUE</span><h2>The 3D room needs WebGL 2.</h2><p>Try a browser with hardware acceleration enabled. You can still type and read your paper here.</p><button id="fallback-paper" class="new-sheet">Open paper</button></div>';
  get('fallback-paper').addEventListener('click', () => setView('paper'), { signal: abort.signal });
}

tutorial = createTutorial(stage, scene, {
  onOpen() { releaseAll(); saveNow(); paperView.hidden = true; },
  onClose() { paperView.hidden = view !== 'paper'; if (view === 'paper') updatePaperZoom(); },
  onSources() { showDialog('how-dialog'); },
});
// Keep the supporting modal inside its parent tour so native modal focus and
// the accessibility tree agree about which guide is on top.
get('tutorial-dialog').append(get('how-dialog'));
get('how-button').setAttribute('aria-label', 'Open interactive mechanism tutorial');

machine.onEvent = event => {
  if (event.type === 'impression') {
    if (pointerShiftInFlight === baseKey(event.impression.char)) {
      pointerShiftInFlight = undefined;
      restoreShift();
    }
    paper.append(event.impression); scene?.markPaperDirty(); saveSoon();
    get('paper-view-count').textContent = `${paper.current.impressions.length} impressions · Ivory stock`;
    message('Ink on paper. A little more permanent.', 1300);
  } else if (event.type === 'sound') {
    audio.play(event.sound, event.energy);
    if (event.sound === 'bell') message('The margin is close. A new line is one return away.', 3800);
    else if (event.sound === 'return') message('A fresh line. Keep going.', 2000);
  } else message(event.message, 4500);
};

function setView(next: ViewMode): void {
  view = next; scene?.setView(next); paperView.hidden = next !== 'paper';
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => { const active = button.dataset.view === next; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
  if (next === 'inspect') { setCutaway(true); message('The cover is open. Type and follow the mechanism.', 4500); }
  if (next === 'paper') { updatePaperZoom(); get('paper-view-count').textContent = `${paper.current.impressions.length} impressions · Ivory stock`; message('You can keep typing here. The ink still lands on the same sheet.', 4500); }
}
function fitPaperZoom(): number {
  const wrap = get('paper-canvas-wrap'), style = getComputedStyle(wrap);
  return (wrap.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)) / PAPER_WIDTH;
}
function updatePaperZoom(): void {
  paper.canvas.style.width = paperZoom === null ? '100%' : `${PAPER_WIDTH * paperZoom}px`;
  const value = paperZoom ?? fitPaperZoom();
  get('paper-zoom-value').textContent = `${Math.round(value * 100)}%`;
  get('paper-fit').setAttribute('aria-pressed', String(paperZoom === null));
  get('paper-actual').setAttribute('aria-pressed', String(paperZoom === 1));
  get<HTMLButtonElement>('paper-zoom-out').disabled = value <= .1;
  get<HTMLButtonElement>('paper-zoom-in').disabled = value >= 2;
}
function setCutaway(active: boolean): void {
  cutaway = active; scene?.setCutaway(active);
  get('cutaway-button').setAttribute('aria-pressed', String(active));
}
function showDialog(id: string): void { releaseAll(); get<HTMLDialogElement>(id).showModal(); }

document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => listen(button, 'click', () => { gesture(); setView(button.dataset.view as ViewMode); button.blur(); }));
listen(get('close-paper'), 'click', () => { setView('write'); get('close-paper').blur(); });
listen(get('paper-fit'), 'click', () => { paperZoom = null; updatePaperZoom(); get('paper-fit').blur(); });
listen(get('paper-actual'), 'click', () => { paperZoom = 1; updatePaperZoom(); get('paper-actual').blur(); });
for (const [id, factor] of [['paper-zoom-in', 1.4], ['paper-zoom-out', 1 / 1.4]] as const) listen(get(id), 'click', () => {
  paperZoom = Math.max(.1, Math.min(2, (paperZoom ?? fitPaperZoom()) * factor));
  updatePaperZoom(); get(id).blur();
});
const paperResize = new ResizeObserver(() => { if (view === 'paper') updatePaperZoom(); });
paperResize.observe(get('paper-canvas-wrap'));
listen(get('cutaway-button'), 'click', () => { gesture(); setCutaway(!cutaway); get('cutaway-button').blur(); });
listen(get('reset-view'), 'click', () => { scene?.resetCamera(); get('reset-view').blur(); });
listen(get('how-button'), 'click', () => tutorial?.open());
listen(get('settings-button'), 'click', () => showDialog('settings-dialog'));
listen(get('sound-button'), 'click', () => {
  audio.enabled = !audio.enabled; if (audio.enabled) gesture();
  const button = get('sound-button'); button.setAttribute('aria-pressed', String(audio.enabled)); button.setAttribute('aria-label', audio.enabled ? 'Mute mechanical sound' : 'Enable mechanical sound');
  button.innerHTML = `${icon(audio.enabled ? 'sound' : 'mute')}<span>Sound ${audio.enabled ? 'on' : 'off'}</span>`; button.blur();
});
document.querySelectorAll<HTMLButtonElement>('.dialog-close').forEach(button => listen(button, 'click', () => button.closest('dialog')?.close()));
document.querySelectorAll<HTMLDialogElement>('dialog.modal').forEach(dialog => {
  listen(dialog, 'click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  listen(dialog, 'close', () => { if (!tutorial?.active) (document.activeElement as HTMLElement | null)?.blur(); });
});

listen(get<HTMLInputElement>('force-input'), 'input', event => {
  machine.options.force = Number((event.target as HTMLInputElement).value);
  get('force-value').textContent = `${machine.options.force.toFixed(2)}×`;
});
listen(get<HTMLSelectElement>('spacing-input'), 'change', event => { machine.options.lineSpacing = Number((event.target as HTMLSelectElement).value); });
listen(get<HTMLSelectElement>('speed-input'), 'change', event => { speed = Number((event.target as HTMLSelectElement).value); });
document.querySelectorAll<HTMLInputElement>('input[name="ribbon"]').forEach(input => listen(input, 'change', () => { machine.options.ribbon = input.value === 'red' ? 'red' : 'black'; }));

listen(get('new-sheet'), 'click', () => {
  releaseAll(); gesture();
  get('new-sheet').blur();
  // New paper may be loaded only after all moving bars have returned.
  if (machine.busy || (machine.pendingCount > 0 && !machine.waitingAtMargin)) { message('Let the queued keystrokes finish before loading a new sheet.'); return; }
  paper.newSheet(); machine.newSheet(); scene?.markPaperDirty(); saveNow();
  message('A new sheet is ready. The previous page is safe in the tray.', 4200);
  get('new-sheet').blur();
});
for (const id of ['download-button', 'paper-download']) listen(get(id), 'click', () => { paper.download(); get(id).blur(); });
listen(get('clear-jam'), 'click', () => { releaseAll(); machine.clearJam(); message('Typebars released. Find a steady rhythm.', 3000); get('clear-jam').blur(); });

function renderTray(): void {
  const list = get('tray-list'); list.replaceChildren();
  const sheets = [paper.current, ...[...paper.archive].reverse()];
  for (const sheet of sheets) {
    const button = document.createElement('button'); button.className = 'tray-sheet';
    const title = document.createElement('span'); title.textContent = `Sheet ${String(sheet.id).padStart(2, '0')}`;
    const detail = document.createElement('small'); detail.textContent = `${sheet.impressions.length} impressions${sheet === paper.current ? ' · in the machine' : ' · archived'}`;
    button.append(title, detail);
    button.addEventListener('click', () => {
      archivedSelection = sheet;
      get('archive-preview').hidden = false;
      get('archive-title').textContent = `SHEET ${String(sheet.id).padStart(2, '0')}`;
      get('archive-canvas').replaceChildren(paper.render(sheet));
      list.querySelectorAll('button').forEach(b => b.classList.toggle('selected', b === button));
    });
    list.append(button);
  }
}
listen(get('tray-button'), 'click', () => { renderTray(); get('archive-preview').hidden = true; showDialog('tray-dialog'); });
listen(get('archive-download'), 'click', () => { if (archivedSelection) paper.download(archivedSelection); });

function releaseAll(): void {
  for (const key of heldKeys) machine.release(key);
  heldKeys.clear(); shiftHeld = false; pointerShiftLatched = false; pointerShiftInFlight = undefined; machine.setShift(capsLock);
}
const controlsTarget = (target: EventTarget | null): boolean => target instanceof HTMLElement && !!target.closest('input, select, textarea, [contenteditable="true"]');
const modalOpen = (): boolean => !!document.querySelector('dialog[open]');
window.addEventListener('keydown', event => {
  if (modalOpen() || controlsTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
  if (event.key === 'Escape') { if (machine.state.jammed) { releaseAll(); machine.clearJam(); } else { releaseAll(); stage.blur(); if (view === 'paper') setView('write'); } return; }
  if (event.key === 'Shift') { shiftHeld = true; machine.setShift(true); return; }
  if (event.key === 'CapsLock') { capsLock = event.getModifierState('CapsLock'); restoreShift(); return; }
  if (event.key === 'Tab' && document.activeElement !== stage) return;
  if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof HTMLElement && event.target.closest('button,a')) return;
  const supported = event.key.length === 1 || ['Enter', 'Backspace', 'Tab', 'ArrowUp', 'ArrowDown'].includes(event.key);
  if (!supported) return;
  event.preventDefault(); if (event.repeat) return;
  // Once writing starts, subsequent spaces belong to the sheet rather than a
  // previously focused toolbar button (including the tutorial's return focus).
  stage.focus({ preventScroll: true });
  capsLock = event.getModifierState('CapsLock');
  // event.key already includes the browser's CapsLock/Shift selection. Match
  // that face before the model maps a base key, including CapsLock + Shift.
  machine.setShift(event.key.length === 1 ? /^[A-Z]$/.test(event.key) || event.key in SHIFT_MAP : event.shiftKey || capsLock); gesture();
  heldKeys.add(event.key); machine.press(event.key);
}, { signal: abort.signal });
window.addEventListener('keyup', event => {
  if (event.key === 'Shift') { shiftHeld = false; restoreShift(); }
  machine.release(event.key); heldKeys.delete(event.key);
}, { signal: abort.signal });
window.addEventListener('blur', releaseAll, { signal: abort.signal });
listen(stage, 'pointerdown', () => { stage.focus({ preventScroll: true }); gesture(); });

let lastTime = performance.now(), lastPosition = '', lastHud = '';
let animationFrame = 0;
let disposed = false;
function frame(now: number): void {
  if (disposed) return;
  const dt = Math.min((now - lastTime) / 1000, .05); lastTime = now;
  if (tutorial?.active) tutorial.update(dt);
  else machine.step(dt * speed);
  scene?.update(machine.state, dt);
  const state = machine.state;
  const position = `${state.column}/${state.line}`;
  if (position !== lastPosition) { lastPosition = position; saveSoon(); }
  const hud = `${position}/${paper.current.id}/${state.jammed}/${state.returning}/${machine.pendingCount}`;
  if (hud !== lastHud) {
    lastHud = hud;
    get('sheet-number').textContent = String(paper.current.id).padStart(2, '0');
    get('line-number').textContent = String(state.line + 1).padStart(2, '0');
    get('column-number').textContent = String(Math.min(COLUMNS, state.column + 1)).padStart(2, '0');
    get('carriage-progress').style.width = `${Math.min(100, state.column / COLUMNS * 100)}%`;
    get('loaded-label').textContent = state.jammed ? 'TYPEBARS JAMMED' : state.returning ? 'CARRIAGE RETURN' : state.column >= COLUMNS ? 'RIGHT MARGIN' : 'PAPER LOADED';
    get('clear-jam').hidden = !state.jammed;
    document.body.classList.toggle('is-jammed', state.jammed);
  }
  if (machine.pendingCount > 0) {
    const waiting = machine.waitingAtMargin
      ? `${machine.pendingCount} keystrokes waiting. Press Enter or load a new sheet to continue.`
      : `${machine.pendingCount} keystrokes queued. The machine is catching up.`;
    if (lastStatus !== waiting) { get('status-message').textContent = waiting; lastStatus = waiting; }
    statusUntil = 0;
  } else if (now > statusUntil && !state.jammed) {
    const idle = paper.current.impressions.length ? 'Take your time. The page is yours.' : 'Your page is waiting. Start typing.';
    if (lastStatus !== idle) { get('status-message').textContent = idle; lastStatus = idle; }
  }
  animationFrame = requestAnimationFrame(frame);
}
animationFrame = requestAnimationFrame(frame);
document.addEventListener('visibilitychange', () => { lastTime = performance.now(); if (document.hidden) { releaseAll(); saveNow(); } }, { signal: abort.signal });
window.addEventListener('beforeunload', event => {
  saveNow();
  if (machine.hasPendingInput) { event.preventDefault(); event.returnValue = ''; }
}, { signal: abort.signal });
function dispose(): void { if (disposed) return; disposed = true; saveNow(); cancelAnimationFrame(animationFrame); releaseAll(); paperResize.disconnect(); tutorial?.dispose(); abort.abort(); scene?.dispose(); audio.dispose(); }
window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); else { releaseAll(); saveNow(); } }, { signal: abort.signal });
if (import.meta.hot) import.meta.hot.dispose(dispose);
if (import.meta.env.DEV) (window as unknown as { __atelier: unknown }).__atelier = { machine, paper, scene, tutorial };
