import './mechanism-diagram.css';
import type { TutorialFrame } from './contracts';

const NS = 'http://www.w3.org/2000/svg';
let diagramSequence = 0;
const bounded = (n: number) => Math.max(0, Math.min(1, n));
const point = (cx: number, cy: number, radius: number, angle: number) => [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
const line = (a: number[], b: number[]) => `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`;

/** Large explanatory close-ups. These share the lesson's poses, never the live paper. */
export function createMechanismDiagram(host: HTMLElement) {
  const id = `mechanism-${++diagramSequence}`;
  const wrap = document.createElement('div');
  wrap.className = 'mechanism-diagram';
  wrap.innerHTML = `<svg xmlns="${NS}" viewBox="0 0 640 440" role="img" aria-labelledby="${id}-title ${id}-desc"><title id="${id}-title">How one keystroke works</title><desc id="${id}-desc">Gold arrows show applied force; teal arrows show the resulting movement. Black marks remain on the paper.</desc><defs><marker id="${id}-gold" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L8 4L0 8Z" fill="#b57b27"/></marker><marker id="${id}-teal" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L9 4.5L0 9Z" fill="#267b78"/></marker></defs></svg><div class="mechanism-legend" aria-hidden="true"><span><i></i>Force</span><span><i></i>Movement</span><span><i></i>Ink stays</span></div>`;
  host.append(wrap);
  const svg = wrap.querySelector('svg')!;
  const title = svg.querySelector('title')!;
  const description = svg.querySelector('desc')!;
  const nodes = new Map<string, SVGElement>();
  type Label = { element: SVGTextElement; wide: [number, number, string]; narrow: [number, number, string]; };
  const labels: Label[] = [];
  const geometries: SVGGElement[] = [];

  function add<K extends keyof SVGElementTagNameMap>(parent: SVGElement, tag: K, attrs: Record<string, string | number> = {}, text = '', key?: string): SVGElementTagNameMap[K] {
    const element = document.createElementNS(NS, tag);
    for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, String(value));
    if (text) element.textContent = text;
    parent.append(element);
    if (key) nodes.set(key, element);
    return element;
  }
  function panel(name: string) {
    const group = add(svg, 'g', { 'data-panel': name, display: 'none' });
    const geometry = add(group, 'g');
    geometries.push(geometry);
    return { group, geometry };
  }
  function label(parent: SVGElement, wide: Label['wide'], narrow: Label['narrow'], small = false) {
    const element = add(parent, 'text', { class: small ? 'md-small' : 'md-label', 'text-anchor': 'middle' });
    labels.push({ element, wide, narrow });
  }
  function arrow(parent: SVGElement, d: string, force = false, key?: string) {
    return add(parent, 'path', { d, class: force ? 'md-force' : 'md-motion', 'marker-end': `url(#${id}-${force ? 'gold' : 'teal'})` }, '', key);
  }
  function pivot(parent: SVGElement, cx: number, cy: number, radius = 6) { add(parent, 'circle', { cx, cy, r: radius, class: 'md-pivot' }); }
  function wheel(parent: SVGElement, cx: number, cy: number, radius: number, key: string, teeth = 12) {
    const group = add(parent, 'g', {}, '', key);
    for (let n = 0; n < teeth; n++) add(group, 'rect', { x: cx + radius - 7, y: cy - 8, width: 15, height: 16, rx: 2, class: 'md-metal', transform: `rotate(${15 + 360 * n / teeth} ${cx} ${cy})` });
    add(group, 'circle', { cx, cy, r: radius - 5, class: 'md-metal' });
    for (let n = 0; n < 3; n++) add(group, 'path', { d: `M${cx - radius + 12} ${cy}H${cx + radius - 12}`, stroke: '#a49b89', 'stroke-width': 4, transform: `rotate(${n * 60} ${cx} ${cy})` });
    pivot(group, cx, cy, 9);
    return group;
  }
  function attr(key: string, values: Record<string, string | number>) {
    const element = nodes.get(key)!;
    for (const [name, value] of Object.entries(values)) element.setAttribute(name, String(value));
  }
  function show(key: string, visible: boolean) { attr(key, { opacity: visible ? 1 : 0 }); }

  // A rigid four-bar action: the key lever and typebar rotate about fixed pivots,
  // and the coupler keeps its length. The bent heel provides angular amplification.
  const action = panel('action');
  const ag = action.geometry;
  add(ag, 'circle', { cx: 510, cy: 86, r: 59, fill: '#45443f', stroke: '#252521', 'stroke-width': 3 });
  add(ag, 'path', { d: 'M449 24V151', stroke: '#c8bfae', 'stroke-width': 5 });
  add(ag, 'rect', { x: 441, y: 65, width: 7, height: 43, class: 'md-band' }, '', 'action-ribbon');
  add(ag, 'circle', { cx: 446, cy: 86, r: 15, class: 'md-hit', opacity: 0 }, '', 'action-hit');
  add(ag, 'path', { d: 'M485 310Q550 205 464 108', class: 'md-guide' });
  arrow(ag, 'M506 240Q527 175 480 120');
  add(ag, 'path', { class: 'md-lever' }, '', 'key-lever');
  add(ag, 'path', { class: 'md-link' }, '', 'key-link');
  add(ag, 'path', { class: 'md-lever' }, '', 'action-bar');
  add(ag, 'rect', { x: -15, y: -7, width: 30, height: 14, rx: 3, class: 'md-metal' }, '', 'action-slug');
  add(ag, 'rect', { x: 45, y: 290, width: 70, height: 30, rx: 9, class: 'md-metal' }, '', 'action-key');
  add(ag, 'text', { x: 80, y: 313, 'text-anchor': 'middle', fill: '#302d28', 'font-size': 26, 'font-family': 'Georgia,serif' }, 'A', 'action-key-letter');
  pivot(ag, 180, 310, 9); pivot(ag, 280, 230, 8);
  add(ag, 'circle', { r: 5, class: 'md-pivot' }, '', 'action-joint-a');
  add(ag, 'circle', { r: 5, class: 'md-pivot' }, '', 'action-joint-b');
  arrow(ag, 'M80 160V267', true, 'finger-force');
  add(ag, 'path', { d: 'M170 326L180 310L190 326Z', fill: '#a49b89' });
  add(ag, 'path', { d: 'M268 244L280 230L292 244Z', fill: '#a49b89' });
  add(ag, 'path', { d: 'M280 146V209', class: 'md-guide' });
  const actionPaper = add(ag, 'g', {}, '', 'action-paper');
  add(actionPaper, 'rect', { x: 380, y: 355, width: 210, height: 52, class: 'md-paper' });
  add(actionPaper, 'text', { x: 480, y: 394, class: 'md-glyph', 'text-anchor': 'middle' }, 'a', 'action-ink');
  add(ag, 'path', { d: 'M480 345V353', stroke: '#267b78', 'stroke-width': 3 });
  arrow(ag, 'M560 335H505', false, 'action-advance');
  label(action.group, [82, 110, 'Finger pushes'], [68, 78, 'Press ↓']);
  label(action.group, [399, 27, 'Fixed print point'], [260, 25, 'Fixed print point']);
  label(action.group, [269, 135, 'Linkage'], [159, 108, 'Link']);
  label(action.group, [376, 269, 'Typebar'], [235, 185, 'Typebar']);
  label(action.group, [530, 178, 'Platen'], [337, 131, 'Platen']);
  label(action.group, [115, 412, 'Key lever'], [84, 273, 'Key lever']);
  label(action.group, [480, 434, 'Paper moves left'], [299, 292, 'Paper moves ←'], true);

  // The print sandwich is enlarged to make the contact and ink deposit visible.
  const impact = panel('impact');
  const ig = impact.geometry;
  add(ig, 'circle', { cx: 480, cy: 218, r: 93, fill: '#45443f', stroke: '#252521', 'stroke-width': 4 });
  pivot(ig, 480, 218, 11);
  add(ig, 'path', { d: 'M383 90V340', stroke: '#bbb09b', 'stroke-width': 7 });
  add(ig, 'path', { d: 'M379 90V340', stroke: '#fffdf5', 'stroke-width': 5 });
  add(ig, 'rect', { x: 372, y: 173, width: 7, height: 90, class: 'md-band' }, '', 'impact-ribbon');
  const slug = add(ig, 'g', {}, '', 'impact-slug');
  add(slug, 'path', { d: 'M-90 218H0', class: 'md-lever' });
  add(slug, 'rect', { x: 0, y: 188, width: 52, height: 62, rx: 4, class: 'md-metal' });
  add(slug, 'text', { x: 25, y: 234, class: 'md-glyph', 'text-anchor': 'middle' }, 'a');
  add(ig, 'rect', { x: 377, y: 208, width: 3, height: 23, fill: '#22201c', opacity: 0 }, '', 'impact-deposit');
  add(ig, 'circle', { cx: 375, cy: 218, r: 21, class: 'md-hit', opacity: 0 }, '', 'impact-hit');
  arrow(ig, 'M115 161H230', true, 'impact-force');
  arrow(ig, 'M343 319V275', false, 'ribbon-rise');
  add(ig, 'path', { d: 'M372 118V159M397 83L382 98M520 86L521 122', class: 'md-guide' });
  const front = add(ig, 'g', {}, '', 'impact-front-paper');
  add(front, 'rect', { x: 150, y: 355, width: 180, height: 64, class: 'md-paper' });
  add(front, 'text', { x: 240, y: 401, class: 'md-glyph', 'text-anchor': 'middle' }, 'a', 'impact-ink');
  const fabric = add(svg.querySelector('defs')!, 'pattern', { id: `${id}-fabric`, width: 12, height: 18, patternUnits: 'userSpaceOnUse' }, '', 'ribbon-fabric');
  add(fabric, 'rect', { width: 12, height: 18, fill: '#674950' });
  add(fabric, 'path', { d: 'M0 0L12 18M-6 0L6 18', stroke: '#a8828a', 'stroke-width': 1 });
  add(ig, 'rect', { x: 405, y: 345, width: 130, height: 18, fill: `url(#${id}-fabric)`, stroke: '#302d28', 'stroke-width': 2 });
  add(ig, 'rect', { x: 437, y: 346, width: 5, height: 16, fill: '#302d28', opacity: 0 }, '', 'ribbon-used-patch');
  add(ig, 'path', { d: 'M440 335V342', stroke: '#267b78', 'stroke-width': 3 });
  arrow(ig, 'M405 373H493', false, 'ribbon-feed');
  add(ig, 'path', { d: 'M383 340L330 355', class: 'md-guide' });
  label(impact.group, [160, 105, 'Metal face'], [89, 83, 'Metal face']);
  label(impact.group, [324, 70, 'Ribbon'], [205, 45, 'Ribbon']);
  label(impact.group, [425, 43, 'Paper'], [255, 71, 'Paper']);
  label(impact.group, [531, 72, 'Rubber'], [334, 76, 'Rubber']);
  label(impact.group, [533, 104, 'platen'], [334, 101, 'platen']);
  label(impact.group, [240, 442, 'Ink on the front'], [150, 296, 'Ink on paper'], true);
  label(impact.group, [469, 411, 'Ribbon feeds →'], [303, 272, 'Fresh ribbon →'], true);

  // A wheel-and-dog schematic isolates the metering action from the gear train.
  const spacing = panel('spacing');
  const eg = spacing.geometry;
  add(eg, 'path', { d: 'M61 121C13 65 9 162 53 151C87 141 53 93 34 118C24 139 61 143 53 123', class: 'md-force' });
  add(eg, 'path', { d: 'M60 132H104', class: 'md-force' }, '', 'spring-drawband');
  arrow(eg, 'M159 43H78', true);
  add(eg, 'path', { d: 'M80 190H558', stroke: '#a49b89', 'stroke-width': 4 });
  const carriage = add(eg, 'g', {}, '', 'spacing-paper');
  add(carriage, 'rect', { x: 115, y: 72, width: 432, height: 103, class: 'md-paper' });
  for (let n = 0; n < 7; n++) add(carriage, 'path', { d: `M${160 + n * 60} 147V164`, stroke: '#b7ad96', 'stroke-width': 2 });
  add(carriage, 'text', { x: 280, y: 136, class: 'md-glyph', 'text-anchor': 'middle' }, 'a', 'spacing-ink');
  add(carriage, 'text', { x: 340, y: 138, fill: '#9b927f', 'font-size': 27, 'text-anchor': 'middle' }, '·');
  add(eg, 'path', { d: 'M280 62V161', class: 'md-guide' });
  add(eg, 'path', { d: 'M271 56L280 66L289 56', class: 'md-motion' });
  add(eg, 'path', { d: 'M280 184V207', class: 'md-lever' });
  wheel(eg, 280, 276, 62, 'escape-wheel');
  const dogA = add(eg, 'g', {}, '', 'dog-a');
  add(dogA, 'path', { d: 'M151 363L231 325L238 321', class: 'md-lever' }, '', 'dog-a-arm');
  const dogB = add(eg, 'g', {}, '', 'dog-b');
  add(dogB, 'path', { d: 'M409 363L329 325L322 321', class: 'md-lever' }, '', 'dog-b-arm');
  pivot(eg, 151, 363, 9); pivot(eg, 409, 363, 9);
  arrow(eg, 'M365 315Q388 286 371 233', false, 'escape-turn');
  add(eg, 'path', { d: 'M280 376V348', class: 'md-guide' });
  label(spacing.group, [96, 27, 'Spring pulls'], [70, 23, 'Spring pulls']);
  label(spacing.group, [382, 27, 'Fixed print point'], [272, 23, 'Fixed print point']);
  label(spacing.group, [514, 228, 'One space ←'], [317, 161, 'One space ←']);
  label(spacing.group, [127, 302, 'Holding dog'], [77, 208, 'Hold']);
  label(spacing.group, [454, 303, 'Next dog'], [293, 208, 'Catch']);
  label(spacing.group, [280, 410, 'Escapement wheel'], [183, 286, 'Escapement wheel']);

  const shift = panel('shift');
  const sg = shift.geometry;
  add(sg, 'path', { d: 'M110 230H592', class: 'md-guide' });
  const basket = add(sg, 'g', {}, '', 'shift-basket');
  add(basket, 'path', { d: 'M183 288H329', stroke: '#267b78', 'stroke-width': 14 });
  add(basket, 'path', { d: 'M257 276V247', class: 'md-lever' });
  add(basket, 'rect', { x: 211, y: 100, width: 92, height: 161, rx: 8, class: 'md-metal' });
  add(basket, 'text', { x: 257, y: 150, class: 'md-glyph', 'text-anchor': 'middle' }, 'A', 'shift-upper');
  add(basket, 'text', { x: 257, y: 230, class: 'md-glyph', 'text-anchor': 'middle' }, 'a', 'shift-lower');
  add(sg, 'rect', { x: 216, y: 192, width: 82, height: 50, fill: 'none', stroke: '#267b78', 'stroke-width': 3, rx: 4 });
  arrow(sg, 'M146 122V204', true, 'shift-force');
  add(sg, 'rect', { x: 430, y: 115, width: 154, height: 215, class: 'md-paper' });
  add(sg, 'text', { x: 507, y: 230, class: 'md-glyph', 'text-anchor': 'middle' }, 'A', 'shift-ink');
  arrow(sg, 'M324 213H399', false, 'shift-strike');
  add(sg, 'path', { d: 'M368 60V211', class: 'md-guide' });
  label(shift.group, [240, 51, 'One slug, two faces'], [150, 29, 'One slug, two faces']);
  label(shift.group, [478, 45, 'Fixed print line'], [296, 70, 'Fixed print line']);
  label(shift.group, [91, 341, 'Basket ↓'], [70, 240, 'Basket ↓']);
  label(shift.group, [508, 372, 'Printed character'], [314, 266, 'On paper']);
  label(shift.group, [259, 420, 'Shift lowers the whole basket'], [202, 315, 'Shift selects the upper face'], true);

  const returning = panel('return');
  const rg = returning.geometry;
  add(rg, 'path', { d: 'M48 183H590', stroke: '#a49b89', 'stroke-width': 5 });
  const returnPaper = add(rg, 'g', {}, '', 'return-carriage');
  add(returnPaper, 'rect', { x: 72, y: 68, width: 268, height: 103, class: 'md-paper' });
  add(returnPaper, 'rect', { x: 68, y: 173, width: 276, height: 17, rx: 8, fill: '#45443f' });
  add(returnPaper, 'text', { x: 102, y: 134, class: 'md-glyph', 'font-size': 31 }, 'a a a a', 'return-line');
  add(rg, 'path', { d: 'M260 57V156', class: 'md-guide' });
  arrow(rg, 'M193 218H398', true, 'carriage-return-arrow');
  add(rg, 'circle', { cx: 487, cy: 326, r: 64, fill: '#45443f', stroke: '#252521', 'stroke-width': 3 });
  wheel(rg, 487, 326, 48, 'return-ratchet', 10);
  add(rg, 'path', { d: 'M410 255V400', stroke: '#b7ad96', 'stroke-width': 8 });
  add(rg, 'path', { d: 'M405 255V400', stroke: '#fffdf5', 'stroke-width': 5 });
  add(rg, 'path', { d: 'M403 328H412M403 367H412', stroke: '#302d28', 'stroke-width': 4 }, '', 'feed-marks');
  arrow(rg, 'M378 348V276', false, 'feed-arrow');
  const feedPawl = add(rg, 'g', {}, '', 'feed-pawl');
  add(feedPawl, 'path', { d: 'M334 398L449 355L451 350', class: 'md-link' });
  pivot(rg, 334, 398, 7);
  arrow(rg, 'M561 301Q581 346 545 375', false, 'platen-turn');
  label(returning.group, [310, 33, 'Carriage returns right'], [205, 27, 'Carriage →']);
  label(returning.group, [119, 256, 'Return lever'], [83, 172, 'Push lever']);
  label(returning.group, [315, 304, 'Paper ↑'], [204, 213, 'Paper ↑']);
  label(returning.group, [488, 424, 'Platen turns'], [312, 295, 'Platen turns']);
  label(returning.group, [170, 399, 'Pawl steps the ratchet'], [116, 315, 'Pawl → ratchet'], true);

  let narrow = false;
  function layout() {
    narrow = host.clientWidth > 0 && host.clientWidth < 540;
    wrap.dataset.narrow = String(narrow);
    svg.setAttribute('viewBox', narrow ? '0 0 400 340' : '0 0 640 455');
    for (const geometry of geometries) geometry.setAttribute('transform', narrow ? 'translate(8 15) scale(.6)' : '');
    for (const item of labels) {
      const [x, y, text] = narrow ? item.narrow : item.wide;
      item.element.setAttribute('x', String(x)); item.element.setAttribute('y', String(y)); item.element.textContent = text;
    }
  }
  const observer = new ResizeObserver(layout);
  observer.observe(host); layout();

  function update(frame: TutorialFrame) {
    const { state, focus, progress: p, ink } = frame;
    const bar = state.bars.find(candidate => candidate.key === 'a')!;
    const a = bounded(bar?.angle ?? 0);
    const advance = bounded(state.carriage - 32);
    const contact = focus === 'shift' ? .66 : .46;
    const striking = ink !== '' && p < contact + .06;
    // The opening follows the action into two close-ups: contact, then metering.
    // An overview must show the cause of spacing, not just a moving paper inset.
    const selected = focus === 'overview' ? p < .12 ? spacing : p < .46 || p >= .8 ? action : p < .52 ? impact : spacing : focus === 'keys' ? action : focus === 'typebars' || focus === 'ribbon' ? impact : focus === 'escapement' ? spacing : focus === 'shift' ? shift : returning;
    for (const item of [action, impact, spacing, shift, returning]) item.group.setAttribute('display', item === selected ? '' : 'none');
    title.textContent = selected === action ? 'A key lever pulls a link, swinging one typebar into the print point' : selected === impact ? 'The metal face presses inked ribbon against paper backed by the platen' : selected === spacing ? 'A spring pulls the carriage left; the escapement releases exactly one space' : selected === shift ? 'Lowering the basket aligns the upper character face with the fixed print line' : 'The return lever moves the carriage right and turns the platen to feed paper upward';
    description.textContent = `${state.phase}. Gold: force. Teal: movement. Black: permanent ink. Connections and clearances are simplified for teaching.`;

    if (selected === action) {
      const theta = -.35 * a;
      const keyEnd = point(180, 310, 80, theta);
      const keyFront = point(180, 310, -100, theta);
      const d = Math.hypot(280 - keyEnd[0], 230 - keyEnd[1]);
      const length = 72.0461092898748;
      const u = (length * length - 400 + d * d) / (2 * d);
      const h = Math.sqrt(Math.max(0, length * length - u * u));
      const ex = (280 - keyEnd[0]) / d, ey = (230 - keyEnd[1]) / d;
      const heel = [keyEnd[0] + u * ex - h * ey, keyEnd[1] + u * ey + h * ex];
      const heelAngle = Math.atan2(heel[1] - 230, heel[0] - 280);
      const typeAngle = heelAngle - .5;
      const tip = point(280, 230, 220, typeAngle);
      attr('key-lever', { d: line(keyFront, keyEnd) });
      attr('key-link', { d: line(keyEnd, heel) });
      attr('action-bar', { d: `${line(heel, [280, 230])}L${tip[0]} ${tip[1]}` });
      attr('action-slug', { transform: `translate(${tip[0]} ${tip[1]}) rotate(${typeAngle * 180 / Math.PI})` });
      attr('action-key', { x: keyFront[0] - 35, y: keyFront[1] - 20 });
      attr('action-key-letter', { x: keyFront[0], y: keyFront[1] + 3 });
      attr('action-joint-a', { cx: keyEnd[0], cy: keyEnd[1] });
      attr('action-joint-b', { cx: heel[0], cy: heel[1] });
      attr('finger-force', { d: `M${keyFront[0]} ${keyFront[1] - 145}V${keyFront[1] - 38}`, opacity: bar.pressed ? 1 : .3 });
      attr('action-ribbon', { transform: `translate(0 ${45 * (1 - state.ribbonLift)})` });
      attr('action-paper', { transform: `translate(${-45 * advance} 0)` });
      show('action-hit', striking); show('action-ink', ink !== ''); show('action-advance', advance > 0);
    } else if (selected === impact) {
      attr('impact-slug', { transform: `translate(${180 + 140 * a} 0)` });
      attr('impact-ribbon', { transform: `translate(0 ${90 * (1 - state.ribbonLift)})` });
      attr('impact-front-paper', { transform: `translate(${-45 * advance} 0)` });
      attr('impact-force', { opacity: bar.pressed ? 1 : .25 });
      attr('ribbon-rise', { opacity: state.ribbonLift > 0 && !ink ? 1 : .25 });
      attr('ribbon-feed', { opacity: advance > 0 ? 1 : .18, 'stroke-dasharray': '10 6', 'stroke-dashoffset': -advance * 40 });
      attr('ribbon-fabric', { patternTransform: `translate(${advance * 36} 0)` });
      attr('ribbon-used-patch', { x: 437 + advance * 36, opacity: ink !== '' ? 1 : 0 });
      show('impact-hit', striking); show('impact-deposit', ink !== ''); show('impact-ink', ink !== '');
    } else if (selected === spacing) {
      attr('spacing-paper', { transform: `translate(${-advance * 60} 0)` });
      attr('spring-drawband', { d: `M60 132H${115 - advance * 60}` });
      attr('escape-wheel', { transform: `rotate(${-advance * 30} 280 276)` });
      attr('dog-a', { transform: `rotate(${advance > 0 ? 24 : 0} 151 363)` });
      attr('dog-b', { transform: `rotate(${-20 * (1 - bounded((advance - .8) / .2))} 409 363)` });
      attr('dog-a-arm', { class: advance === 0 ? 'md-lever md-active-dog' : 'md-lever' });
      attr('dog-b-arm', { class: advance >= 1 ? 'md-lever md-active-dog' : 'md-lever' });
      show('spacing-ink', ink !== ''); show('escape-turn', advance > 0 && advance < 1);
    } else if (selected === shift) {
      attr('shift-basket', { transform: `translate(0 ${state.shift * 80})` });
      attr('shift-upper', { opacity: state.shift > .8 ? 1 : .35 });
      attr('shift-lower', { opacity: state.shift < .2 ? 1 : .35 });
      attr('shift-force', { opacity: state.shift > 0 && state.shift < 1 ? 1 : .3 });
      show('shift-ink', ink !== ''); show('shift-strike', a > .5);
    } else {
      const returned = bounded(1 - state.carriage / 42);
      // The first character's x=102 reaches the fixed print line at x=260.
      attr('return-carriage', { transform: `translate(${returned * 158} 0)` });
      attr('return-line', { transform: `translate(0 ${-state.feed * 36})` });
      attr('return-ratchet', { transform: `rotate(${state.feed * 36} 487 326)` });
      attr('feed-marks', { transform: `translate(0 ${-state.feed * 36})` });
      attr('feed-pawl', { transform: `rotate(${-Math.sin(Math.PI * state.feed) * 12} 334 398)` });
      attr('feed-arrow', { opacity: state.feed > 0 && state.feed < 1 ? 1 : .3 });
      attr('platen-turn', { opacity: state.feed > 0 && state.feed < 1 ? 1 : .3 });
      attr('carriage-return-arrow', { opacity: returned > 0 && returned < 1 ? 1 : .3 });
    }
  }
  return { update, dispose() { observer.disconnect(); wrap.remove(); } };
}
