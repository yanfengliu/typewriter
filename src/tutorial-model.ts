import { KEY_ROWS, type MechanicalState, type TutorialFocus, type TutorialFrame } from './contracts';

export const LESSONS: ReadonlyArray<{ focus: TutorialFocus; label: string; title: string; body: string; detail: string; duration: number }> = [
  { focus: 'overview', label: 'The whole machine', title: 'A small orchestra of parts.', body: 'Follow a single keystroke from your fingertip to the page. First, lift the assemblies apart and see where each belongs.', detail: 'The floating parts are an exploded diagram. In the working machine, every assembly is connected to the frame.', duration: 7 },
  { focus: 'keys', label: 'Key & linkage', title: 'Your finger supplies the energy.', body: 'A key is a lever. Pressing it pulls a linkage, turning a small downward movement into the swing of a typebar.', detail: 'The return spring brings the action back to rest. The key does not slide the paper directly.', duration: 6 },
  { focus: 'typebars', label: 'Typebar & impact', title: 'Many paths. One print point.', body: 'The fan of typebars converges on one guide. A metal character on the selected bar strikes the ribbon against paper backed by the rubber platen.', detail: 'Watch the selected A key: ink appears at contact, then the bar returns. Two arriving bars can collide on a real machine.', duration: 6 },
  { focus: 'ribbon', label: 'Ribbon & ink', title: 'A fresh patch of ink.', body: 'The ribbon vibrator lifts the inked fabric into the strike point. The spools advance the ribbon a little with each cycle, spreading wear along its length.', detail: 'The ribbon lowers again so you can see the line. Backspace moves the carriage; it cannot lift ink off the sheet.', duration: 6 },
  { focus: 'escapement', label: 'Escapement', title: 'A spring pulls. Two dogs meter.', body: 'The mainspring pulls the carriage. The escapement holds it and releases one character space at a time. In this full-drop design, the impression lands before the carriage advances.', detail: 'The toothed wheel and holding dogs meter the motion. Space releases a step without printing. The print point stays fixed as the paper moves left.', duration: 7 },
  { focus: 'shift', label: 'Shift & character faces', title: 'One bar, two characters.', body: 'Each type slug carries two character faces. In a basket-shift design, Shift lowers the whole typebar basket to bring the uppercase face to the print point.', detail: 'The platen stays at the same height. Other typewriters use carriage shift instead; this tour follows the basket-shift design.', duration: 7 },
  { focus: 'return', label: 'Carriage & line feed', title: 'Back to the start. Down a line.', body: 'The return lever pushes the carriage back to the right. Its line-space pawl turns the platen ratchet, rolling the paper upward for the next line.', detail: 'The margin stops locate the line ends. The bell warns that the right margin is close; a manual typewriter does not wrap automatically.', duration: 7 },
];

const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const ramp = (p: number, a: number, b: number) => { const t = clamp((p - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Scrubbable explanatory poses, independent of the live physics and permanent paper. */
export function tutorialFrame(focus: TutorialFocus, progress: number, separated = false, reducedMotion = false): TutorialFrame {
  const p = clamp(progress);
  const state: MechanicalState = {
    column: 32, carriage: 32, carriageVelocity: 0, line: 0, feed: 0,
    shift: 0, shifted: false, ribbonLift: 0, ribbonTravel: 0,
    bars: [...KEY_ROWS.join('')].map(key => ({ key, angle: 0, velocity: 0, pressed: false })),
    jammed: false, returning: false, bell: 0, strikeCount: 0, lastEnergy: 0, phase: 'At rest',
  };
  let ink: TutorialFrame['ink'] = '';
  if (focus === 'return') {
    state.carriage = 42 * (1 - ramp(p, .18, .84));
    state.column = p >= .84 ? 0 : 42;
    state.feed = ramp(p, .16, .52);
    state.line = p >= .52 ? 1 : 0;
    state.returning = p >= .16 && p < .84;
    state.phase = p < .16 ? 'At the line end' : p < .52 ? 'The platen rolls the paper' : p < .84 ? 'The carriage returns right' : 'Ready for a new line';
    ink = 'a';
  } else if (focus !== 'overview') {
    const shifted = focus === 'shift';
    const start = shifted ? .38 : .12, contact = shifted ? .66 : .46, end = shifted ? .94 : .80;
    state.shift = shifted ? ramp(p, .10, .32) : 0;
    state.shifted = shifted && p >= .10;
    const bar = state.bars.find(item => item.key === 'a')!;
    bar.angle = p <= contact ? ramp(p, start, contact) : 1 - ramp(p, contact + .025, end);
    bar.pressed = p >= start && p < contact + .025;
    state.ribbonLift = ramp(p, start + .03, contact - .08) * (1 - ramp(p, contact + .07, end));
    const advance = ramp(p, contact + .06, end);
    state.carriage += advance;
    state.column = p >= end ? 33 : 32;
    state.ribbonTravel = advance * .0015;
    state.strikeCount = p >= contact ? 1 : 0;
    state.lastEnergy = p >= contact ? 1 : 0;
    if (p >= contact) ink = shifted ? 'A' : 'a';
    state.phase = shifted && p < start ? 'The basket lowers for uppercase' : p < start ? 'At rest' : p < contact ? 'The typebar approaches' : p < contact + .06 ? 'Contact transfers the ink' : p < end ? 'One space, then reset' : 'Ready for the next key';
  }
  return { focus, progress: p, explosion: separated ? 1 : focus === 'overview' ? ramp(p, .12, .84) : 0, state, ink, reducedMotion };
}
