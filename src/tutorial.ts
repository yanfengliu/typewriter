import './tutorial.css';
import { LESSONS, lessonBeat, tutorialFrame } from './tutorial-model';
import { createMechanismDiagram } from './mechanism-diagram';
import type { SceneAPI } from './contracts';

export function createTutorial(stage: HTMLElement, scene: SceneAPI | undefined, hooks: { onOpen(): void; onClose(): void; onSources(): void }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'tutorial-dialog';
  dialog.id = 'tutorial-dialog';
  dialog.setAttribute('aria-labelledby', 'tutorial-heading');
  dialog.innerHTML = `
    <header class="tutorial-header"><div><span class="eyebrow">ATELIER / HOW IT WORKS</span><span class="tutorial-header-title">From a finger to a printed letter</span></div><button type="button" class="tutorial-close" aria-label="Close tutorial">Back to writing <span aria-hidden="true">×</span></button></header>
    <aside class="tutorial-sidebar">
      <nav class="tutorial-chapters" aria-label="Tutorial chapters">${LESSONS.map((lesson, index) => `<button type="button" data-lesson="${index}" aria-label="Chapter ${index + 1}: ${lesson.label}"><span>${String(index + 1).padStart(2, '0')}</span><span>${lesson.label}</span></button>`).join('')}</nav>
      <section class="tutorial-check" aria-labelledby="tutorial-check-heading"><span class="eyebrow">EXPLAIN IT BACK</span><h3 id="tutorial-check-heading"></h3><div class="tutorial-answers"></div><p class="tutorial-feedback" role="status"></p></section>
      <details class="tutorial-recap"><summary>Your 30-second explanation</summary><p>“My finger moves a lever and linkage, swinging a metal letter into an inked ribbon. The ribbon is squeezed against paper backed by a rubber roller, leaving ink. Then the escapement lets a wound spring pull the carriage one space and catches it again. The bar and ribbon return, ready for the next key.”</p><p>Shift aligns a second character on the same slug. Carriage return moves the carriage right and rolls the paper up for a new line.</p></details>
      <button type="button" class="tutorial-sources">Mechanics & sources ↗</button>
    </aside>
    <main class="tutorial-workshop">
      <div class="tutorial-copy"><span class="tutorial-step-number eyebrow"></span><h2 id="tutorial-heading"></h2><p class="tutorial-body"></p></div>
      <div class="tutorial-view-switch" role="group" aria-label="Diagram view"><button type="button" class="tutorial-schematic" aria-pressed="true">Follow the mechanism</button><button type="button" class="tutorial-three" aria-pressed="false">Locate it in 3D</button><span>Gold: force · Teal: motion · Black: ink</span></div>
      <section class="tutorial-visual" aria-label="Animated mechanism diagram"><div class="tutorial-mechanism-host"></div><div class="tutorial-scene-host" hidden></div><div class="tutorial-diagram-note" hidden><span>Cutaway · Drag to orbit · Scroll or pinch to zoom</span><button type="button" class="tutorial-explode" aria-pressed="false">Separate parts</button><button type="button" class="tutorial-reset">Reset view</button></div></section>
      <div class="tutorial-beats" role="group" aria-label="Pause at a teaching moment"></div>
      <section class="tutorial-cause-effect" aria-live="polite" aria-atomic="true"><div><span class="eyebrow">WHAT CAUSES IT</span><p class="tutorial-cause"></p></div><div><span class="eyebrow">WHAT CHANGES</span><p class="tutorial-effect"></p></div></section>
      <p class="tutorial-detail"></p>
    </main>
    <footer class="tutorial-controls">
      <div class="tutorial-transport"><button type="button" class="tutorial-play" aria-label="Play animation">▶ <span>Play</span></button><label class="tutorial-timeline-label" for="tutorial-timeline">Animation</label><input id="tutorial-timeline" type="range" min="0" max="1000" step="1" value="0" aria-label="Animation progress"/><output class="tutorial-progress" for="tutorial-timeline">0%</output></div>
      <div class="tutorial-step-actions"><button type="button" class="tutorial-prev" aria-label="Previous chapter">← Previous</button><button type="button" class="tutorial-next">Next chapter →</button></div>
      <p class="tutorial-safe-note">Slowed teaching model · Click a numbered moment to hold it still. Your real sheet and queued typing are paused.</p>
    </footer>`;
  document.body.append(dialog);
  const find = <T extends HTMLElement = HTMLElement>(selector: string) => dialog.querySelector<T>(selector)!;
  const host = find('.tutorial-scene-host');
  const diagramHost = find('.tutorial-mechanism-host');
  const diagram = createMechanismDiagram(diagramHost);
  const slider = find<HTMLInputElement>('#tutorial-timeline');
  const play = find<HTMLButtonElement>('.tutorial-play');
  const separate = find<HTMLButtonElement>('.tutorial-explode');
  const previous = find<HTMLButtonElement>('.tutorial-prev');
  const next = find<HTMLButtonElement>('.tutorial-next');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const events = new AbortController();
  const answers = new Map<number, number>();
  let active = false, playing = false, index = 0, progress = 0, separated = false, three = false;
  let lastBeat: object | undefined;
  let marker: Comment | undefined;
  let previousFocus: HTMLElement | null = null;
  const originalLabel = stage.getAttribute('aria-label');
  const originalRole = stage.getAttribute('role');
  const on = (element: EventTarget, type: string, handler: EventListener) => element.addEventListener(type, handler, { signal: events.signal });

  function render() {
    const lesson = LESSONS[index];
    const frame = tutorialFrame(lesson.focus, progress, three && separated, reduced.matches);
    if (active) scene?.setTutorial(frame);
    diagram.update(frame);
    slider.value = String(Math.round(progress * 1000));
    const beat = lessonBeat(lesson, progress);
    slider.setAttribute('aria-valuetext', `${Math.round(progress * 100)} percent: ${beat.label}`);
    find('output').textContent = `${Math.round(progress * 100)}%`;
    const playLabel = playing ? 'Pause animation' : progress >= 1 ? 'Replay animation' : 'Play animation';
    if (play.getAttribute('aria-label') !== playLabel) {
      play.innerHTML = `${playing ? 'Ⅱ' : '▶'} <span>${playing ? 'Pause' : progress >= 1 ? 'Replay' : 'Play'}</span>`;
      play.setAttribute('aria-label', playLabel);
    }
    if (beat !== lastBeat) {
      find('.tutorial-cause').textContent = beat.cause;
      find('.tutorial-effect').textContent = beat.effect;
      for (const button of dialog.querySelectorAll<HTMLButtonElement>('[data-beat]')) button.setAttribute('aria-pressed', String(lesson.beats[Number(button.dataset.beat)] === beat));
      lastBeat = beat;
    }
    separate.textContent = separated ? 'Reassemble' : 'Separate parts';
    separate.setAttribute('aria-pressed', String(separated));
    previous.disabled = index === 0;
    next.textContent = index === LESSONS.length - 1 ? 'Try the real machine →' : `Next: ${LESSONS[index + 1].label} →`;
  }

  function renderAnswer() {
    const question = LESSONS[index].question;
    const chosen = answers.get(index);
    const feedback = find('.tutorial-feedback');
    feedback.textContent = chosen === undefined ? 'Choose an answer, then explain why.' : `${chosen === question.answer ? 'Yes. ' : 'Look again. '}${question.explanation}`;
    feedback.dataset.correct = String(chosen === question.answer);
    for (const button of dialog.querySelectorAll<HTMLButtonElement>('[data-answer]')) button.setAttribute('aria-pressed', String(Number(button.dataset.answer) === chosen));
  }

  function choose(chapter: number) {
    index = Math.max(0, Math.min(LESSONS.length - 1, chapter));
    progress = 0; separated = false; playing = !reduced.matches; lastBeat = undefined;
    const lesson = LESSONS[index];
    find('.tutorial-step-number').textContent = `LESSON ${String(index + 1).padStart(2, '0')} / ${String(LESSONS.length).padStart(2, '0')}`;
    find('h2').textContent = lesson.title;
    find('.tutorial-body').textContent = lesson.body;
    find('.tutorial-detail').textContent = lesson.detail;
    find('#tutorial-check-heading').textContent = lesson.question.prompt;
    find('.tutorial-answers').innerHTML = lesson.question.choices.map((choice, i) => `<button type="button" data-answer="${i}" aria-pressed="false">${choice}</button>`).join('');
    find('.tutorial-beats').innerHTML = lesson.beats.map((beat, i) => `<button type="button" data-beat="${i}" aria-label="Moment ${i + 1}: ${beat.label}" aria-pressed="false"><span>${i + 1}</span>${beat.label}</button>`).join('');
    for (const button of dialog.querySelectorAll<HTMLButtonElement>('[data-lesson]')) {
      if (Number(button.dataset.lesson) === index) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    }
    renderAnswer(); render();
  }

  function togglePlay() {
    if (playing) playing = false;
    else { if (progress >= 1) progress = 0; separated = false; playing = true; }
    render();
  }

  function setThree(value: boolean) {
    three = value && !!scene;
    host.hidden = !three; diagramHost.hidden = three;
    find('.tutorial-diagram-note').hidden = !three;
    find('.tutorial-schematic').setAttribute('aria-pressed', String(!three));
    find('.tutorial-three').setAttribute('aria-pressed', String(three));
    separated = false; render();
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
  on(dialog, 'cancel', event => { if (event.target === dialog) { event.preventDefault(); close(); } });
  on(dialog, 'close', () => { if (active && !dialog.open) close(); });
  on(play, 'click', togglePlay);
  on(slider, 'input', () => { progress = Number(slider.value) / 1000; playing = false; separated = false; render(); });
  on(separate, 'click', () => { separated = !separated; playing = false; render(); });
  on(find('.tutorial-reset'), 'click', () => scene?.resetCamera());
  on(find('.tutorial-schematic'), 'click', () => setThree(false));
  on(find('.tutorial-three'), 'click', () => setThree(true));
  find<HTMLButtonElement>('.tutorial-three').disabled = !scene;
  on(previous, 'click', () => choose(index - 1));
  on(next, 'click', () => { if (index === LESSONS.length - 1) close(); else choose(index + 1); });
  on(find('.tutorial-sources'), 'click', () => { playing = false; render(); hooks.onSources(); });
  on(find('.tutorial-beats'), 'click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-beat]');
    if (!button) return;
    progress = LESSONS[index].beats[Number(button.dataset.beat)].pose; playing = false; separated = false; render();
  });
  on(find('.tutorial-answers'), 'click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-answer]');
    if (!button) return;
    answers.set(index, Number(button.dataset.answer)); playing = false; renderAnswer(); render();
  });
  for (const button of dialog.querySelectorAll<HTMLButtonElement>('[data-lesson]')) on(button, 'click', () => choose(Number(button.dataset.lesson)));
  on(dialog, 'keydown', event => {
    const key = event as KeyboardEvent;
    if (!(key.target instanceof Element) || key.target.closest('dialog') !== dialog) return;
    if (key.target instanceof HTMLInputElement || key.ctrlKey || key.metaKey || key.altKey) return;
    if (key.key === 'ArrowRight') { key.preventDefault(); choose(index + 1); }
    if (key.key === 'ArrowLeft') { key.preventDefault(); choose(index - 1); }
    if (key.key === ' ' && !(key.target instanceof HTMLElement && key.target.closest('button,a,summary'))) { key.preventDefault(); togglePlay(); }
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
      document.body.classList.add('tutorial-open');
      dialog.showModal(); choose(0); setThree(false);
      find<HTMLButtonElement>('.tutorial-close').focus();
      dialog.scrollTop = 0;
    },
    update(dt: number) {
      if (!active) return;
      if (playing && !document.hidden) {
        const focus = LESSONS[index].focus;
        const contact = focus === 'shift' ? .66 : .46;
        // Linger at contact so the viewer can see the layers and read the cause.
        const pace = focus !== 'return' && progress >= contact && progress < contact + .06 ? .25 : 1;
        progress = Math.min(1, progress + Math.max(0, Math.min(dt, .05)) / LESSONS[index].duration * pace);
        if (progress >= 1) playing = false;
      }
      render();
    },
    close,
    dispose() { close(); events.abort(); diagram.dispose(); dialog.remove(); },
  };
}
