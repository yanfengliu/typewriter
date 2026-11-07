import './tutorial.css';
import { LESSONS, tutorialFrame } from './tutorial-model';
import type { SceneAPI } from './contracts';

export function createTutorial(stage: HTMLElement, scene: SceneAPI | undefined, hooks: { onOpen(): void; onClose(): void; onSources(): void }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'tutorial-dialog';
  dialog.id = 'tutorial-dialog';
  dialog.setAttribute('aria-labelledby', 'tutorial-heading');
  dialog.innerHTML = `
    <header class="tutorial-header"><div><span class="eyebrow">ATELIER / FIELD GUIDE</span><span class="tutorial-header-title">Inside the typewriter</span></div><button type="button" class="tutorial-close" aria-label="Close tutorial">Back to writing <span aria-hidden="true">×</span></button></header>
    <aside class="tutorial-sidebar">
      <nav class="tutorial-chapters" aria-label="Tutorial chapters">${LESSONS.map((lesson, index) => `<button type="button" data-lesson="${index}" aria-label="Chapter ${index + 1}: ${lesson.label}"><span>${String(index + 1).padStart(2, '0')}</span><span>${lesson.label}</span></button>`).join('')}</nav>
      <div class="tutorial-copy" aria-live="polite" aria-atomic="true"><div class="tutorial-step-number eyebrow"></div><h2 id="tutorial-heading"></h2><p class="tutorial-body"></p><p class="tutorial-detail"></p></div>
      <button type="button" class="tutorial-sources">Mechanics & sources ↗</button>
    </aside>
    <section class="tutorial-visual" aria-label="Animated mechanism diagram"><div class="tutorial-scene-host"></div><div class="tutorial-diagram-note"><span class="tutorial-diagram-mode">ASSEMBLY STUDY</span><span>Drag to orbit · Scroll or pinch to zoom</span></div><div class="tutorial-phase" role="status"></div><div class="tutorial-no-webgl" hidden>The interactive 3D diagram needs WebGL 2. You can still read every chapter and use the timeline.</div></section>
    <footer class="tutorial-controls">
      <div class="tutorial-transport"><button type="button" class="tutorial-play" aria-label="Play animation">▶ <span>Play</span></button><label class="tutorial-timeline-label" for="tutorial-timeline">Animation</label><input id="tutorial-timeline" type="range" min="0" max="1000" step="1" value="0" aria-label="Animation progress"/><output class="tutorial-progress" for="tutorial-timeline">0%</output></div>
      <div class="tutorial-actions"><button type="button" class="tutorial-explode" aria-pressed="false">Separate assemblies</button><button type="button" class="tutorial-reset">Reset view</button><div class="tutorial-step-actions"><button type="button" class="tutorial-prev" aria-label="Previous chapter">←</button><button type="button" class="tutorial-next">Next chapter →</button></div></div>
      <p class="tutorial-safe-note">Demonstration sheet · Your writing is paused and kept safe. Timeline motion is slowed and illustrative.</p>
    </footer>`;
  document.body.append(dialog);
  const find = <T extends HTMLElement = HTMLElement>(selector: string) => dialog.querySelector<T>(selector)!;
  const host = find('.tutorial-scene-host');
  const slider = find<HTMLInputElement>('#tutorial-timeline');
  const play = find<HTMLButtonElement>('.tutorial-play');
  const separate = find<HTMLButtonElement>('.tutorial-explode');
  const previous = find<HTMLButtonElement>('.tutorial-prev');
  const next = find<HTMLButtonElement>('.tutorial-next');
  const phase = find('.tutorial-phase');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const events = new AbortController();
  let active = false, playing = false, index = 0, progress = 0, separated = false;
  let marker: Comment | undefined;
  let previousFocus: HTMLElement | null = null;
  const originalLabel = stage.getAttribute('aria-label');
  const originalRole = stage.getAttribute('role');
  const on = (element: EventTarget, type: string, handler: EventListener) => element.addEventListener(type, handler, { signal: events.signal });

  function render() {
    const lesson = LESSONS[index];
    const frame = tutorialFrame(lesson.focus, progress, separated, reduced.matches);
    if (active) scene?.setTutorial(frame);
    slider.value = String(Math.round(progress * 1000));
    slider.setAttribute('aria-valuetext', `${Math.round(progress * 100)} percent: ${frame.state.phase}`);
    find('output').textContent = `${Math.round(progress * 100)}%`;
    const playLabel = playing ? 'Pause animation' : progress >= 1 ? 'Replay animation' : 'Play animation';
    if (play.getAttribute('aria-label') !== playLabel) {
      play.innerHTML = `${playing ? 'Ⅱ' : '▶'} <span>${playing ? 'Pause' : progress >= 1 ? 'Replay' : 'Play'}</span>`;
      play.setAttribute('aria-label', playLabel);
    }
    const partsSeparated = separated || (index === 0 && progress > .12);
    separate.textContent = partsSeparated ? 'Reassemble' : 'Separate assemblies';
    separate.setAttribute('aria-pressed', String(partsSeparated));
    const caption = frame.explosion > .05 ? 'Parts separated for clarity · Reassemble to follow the contact' : frame.state.phase;
    if (phase.textContent !== caption) phase.textContent = caption;
    find('.tutorial-diagram-mode').textContent = frame.explosion > .05 ? 'EXPLODED DIAGRAM' : 'SLOW MOTION / CUTAWAY';
    previous.disabled = index === 0;
    next.textContent = index === LESSONS.length - 1 ? 'Return to writing →' : 'Next chapter →';
  }

  function choose(chapter: number) {
    index = Math.max(0, Math.min(LESSONS.length - 1, chapter));
    progress = reduced.matches ? 1 : 0;
    separated = false;
    playing = !reduced.matches;
    const lesson = LESSONS[index];
    find('.tutorial-step-number').textContent = `CHAPTER ${String(index + 1).padStart(2, '0')} / ${String(LESSONS.length).padStart(2, '0')}`;
    find('h2').textContent = lesson.title;
    find('.tutorial-body').textContent = lesson.body;
    find('.tutorial-detail').textContent = lesson.detail;
    for (const button of dialog.querySelectorAll<HTMLButtonElement>('[data-lesson]')) {
      if (Number(button.dataset.lesson) === index) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    }
    render();
  }

  function togglePlay() {
    if (playing) playing = false;
    else { if (progress >= 1) progress = 0; separated = false; playing = true; }
    render();
  }

  function close() {
    if (!active) return;
    active = false; playing = false;
    scene?.setTutorial(null);
    marker?.replaceWith(stage); marker = undefined;
    if (originalLabel !== null) stage.setAttribute('aria-label', originalLabel);
    if (originalRole !== null) stage.setAttribute('role', originalRole);
    for (const nested of dialog.querySelectorAll<HTMLDialogElement>('dialog[open]')) nested.close();
    dialog.close();
    document.body.classList.remove('tutorial-open');
    hooks.onClose();
    previousFocus?.focus({ preventScroll: true });
  }

  on(find('.tutorial-close'), 'click', close);
  on(dialog, 'cancel', event => { event.preventDefault(); close(); });
  on(dialog, 'close', () => { if (active) close(); });
  on(play, 'click', togglePlay);
  on(slider, 'input', () => { progress = Number(slider.value) / 1000; playing = false; separated = false; render(); });
  on(separate, 'click', () => { separated = !(separated || (index === 0 && progress > .12)); playing = false; if (!separated && index === 0) progress = 0; render(); });
  on(find('.tutorial-reset'), 'click', () => scene?.resetCamera());
  on(previous, 'click', () => choose(index - 1));
  on(next, 'click', () => { if (index === LESSONS.length - 1) close(); else choose(index + 1); });
  on(find('.tutorial-sources'), 'click', () => { playing = false; render(); hooks.onSources(); });
  for (const button of dialog.querySelectorAll<HTMLButtonElement>('[data-lesson]')) on(button, 'click', () => choose(Number(button.dataset.lesson)));
  on(dialog, 'keydown', event => {
    const key = event as KeyboardEvent;
    if (key.target instanceof HTMLInputElement || key.ctrlKey || key.metaKey || key.altKey) return;
    if (key.key === 'ArrowRight') { key.preventDefault(); choose(index + 1); }
    if (key.key === 'ArrowLeft') { key.preventDefault(); choose(index - 1); }
    if (key.key === ' ' && !(key.target instanceof HTMLElement && key.target.closest('button,a'))) { key.preventDefault(); togglePlay(); }
  });
  on(reduced, 'change', () => { if (reduced.matches) playing = false; if (active) render(); });

  return {
    get active() { return active; },
    open() {
      if (active) return;
      previousFocus = document.activeElement as HTMLElement | null;
      hooks.onOpen();
      marker = document.createComment('writing-stage'); stage.before(marker); host.append(stage);
      stage.setAttribute('role', 'region');
      stage.setAttribute('aria-label', '3D tutorial diagram. Drag to orbit; writing is paused.');
      active = true;
      find('.tutorial-no-webgl').hidden = !!scene;
      document.body.classList.add('tutorial-open');
      dialog.showModal();
      choose(0);
      find<HTMLButtonElement>('.tutorial-close').focus();
    },
    update(dt: number) {
      if (!active) return;
      if (playing && !document.hidden) { progress = Math.min(1, progress + Math.max(0, Math.min(dt, .05)) / LESSONS[index].duration); if (progress >= 1) playing = false; }
      render();
    },
    close,
    dispose() { close(); events.abort(); dialog.remove(); },
  };
}
