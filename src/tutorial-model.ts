import { KEY_ROWS, type MechanicalState, type TutorialFocus, type TutorialFrame } from './contracts';

export interface LessonBeat { at: number; pose: number; label: string; cause: string; effect: string; }
interface Lesson {
  focus: TutorialFocus; label: string; title: string; body: string; detail: string; duration: number;
  beats: readonly LessonBeat[];
  question: { prompt: string; choices: readonly string[]; answer: number; explanation: string };
}

const stroke: readonly LessonBeat[] = [
  { at: 0, pose: 0, label: 'Ready', cause: 'The mainspring is wound, but a holding dog locks the carriage.', effect: 'The paper waits at a fixed print point. There is no ink yet.' },
  { at: .12, pose: .32, label: 'Press', cause: 'Your finger pushes a key lever. Its links rotate the selected typebar.', effect: 'The metal letter swings toward the paper; the ribbon lifts into its path.' },
  { at: .46, pose: .46, label: 'Print', cause: 'The raised letter strikes inked ribbon against paper backed by the platen.', effect: 'Pressure leaves the shape of the letter in ink. The paper is still stationary.' },
  { at: .52, pose: .67, label: 'Space', cause: 'The key action trips the escapement. Its dogs meter the spring-driven carriage.', effect: 'The paper moves left by one character width; the next blank spot reaches the print point.' },
  { at: .8, pose: 1, label: 'Reset', cause: 'Return springs restore the action; a dog catches the next tooth.', effect: 'The bar is down, the ribbon is out of the way, and the ink stays on the sheet.' },
];

export const LESSONS: readonly Lesson[] = [
  {
    focus: 'overview', label: 'One keystroke', title: 'Press. Print. Move. Reset.',
    body: 'Follow one letter from your finger to the page. Two energy sources do different jobs: your finger makes the impression; a wound spring moves the paper.',
    detail: 'Watch once, then use the numbered moments to explain each connection in your own words.', duration: 16, beats: stroke,
    question: { prompt: 'What supplies the energy for the letter and for the space?', choices: ['The finger prints; the mainspring moves the carriage.', 'The mainspring does both.', 'The key pushes the paper sideways.'], answer: 0, explanation: 'The key linkage drives the typebar. The escapement only releases and stops motion supplied by the wound mainspring.' },
  },
  {
    focus: 'keys', label: 'Finger → typebar', title: 'A downward push becomes a swing.',
    body: 'A key is the end of a lever. Pressing it pulls a linkage attached to the heel of a typebar. That bar pivots up toward the paper.',
    detail: 'Circles mark fixed pivots. This close-up reduces the real bell-crank linkage to one connecting link, so you can trace the motion.', duration: 14,
    beats: [stroke[0], { ...stroke[1], cause: 'The key lever rotates around its fixed pivot and pulls the connecting linkage.', effect: 'The linkage pulls the typebar heel. The long end swings up: your finger’s work becomes motion.' }, stroke[2], stroke[3], { ...stroke[4], cause: 'Releasing the key lets the return springs pull the linkage back.', effect: 'The typebar comes to rest ready to strike again. The springs were stretched by your press.' }],
    question: { prompt: 'Why does the typebar swing when the key moves down?', choices: ['A motor senses the key.', 'Connected levers and links turn about their pivots.', 'The carriage spring launches it.'], answer: 1, explanation: 'This is a manual mechanism: a connected chain of levers transfers your finger’s motion and energy to one selected typebar.' },
  },
  {
    focus: 'typebars', label: 'Impact → a letter', title: 'A tiny printing press.',
    body: 'The typebar carries a metal slug with a raised character. At the print point it squeezes ribbon against paper, with the rubber platen supporting the paper from behind.',
    detail: 'The enlarged side view separates the thin layers so you can see the contact. They touch at impact; real clearances are much smaller.', duration: 14,
    beats: [stroke[0], { ...stroke[1], cause: 'The selected typebar rotates toward the common print point.', effect: 'Its raised character approaches the ribbon. All the other typebars aim at this same point.' }, { ...stroke[2], cause: 'The slug presses ribbon → paper → rubber platen.', effect: 'Only the raised character presses hard enough to transfer its ink pattern. The platen provides the backing force.' }, stroke[3], stroke[4]],
    question: { prompt: 'What would be missing if the paper had no platen behind it?', choices: ['A source of ink.', 'A way to select uppercase.', 'Firm backing to take the impact.'], answer: 2, explanation: 'The ribbon supplies ink; the metal face supplies the shape; the platen supports the sheet while the face presses the layers together.' },
  },
  {
    focus: 'ribbon', label: 'Ribbon → permanent ink', title: 'The ribbon carries the ink.',
    body: 'A shared linkage lifts the inked fabric just before impact. After the stroke it drops so you can read the line. The feed also winds a little ribbon onto a spool.',
    detail: 'The slug is a shaped stamp, not an ink cartridge. Moving the ribbon spreads wear and brings a fresh patch into use.', duration: 14,
    beats: [stroke[0], { ...stroke[1], cause: 'The key action moves a common bar linked to the ribbon carrier.', effect: 'The carrier lifts the inked cloth between the typeface and paper before contact.' }, { ...stroke[2], cause: 'Impact squeezes ink out of the fabric at the raised letter.', effect: 'Ink becomes a mark on the paper. It no longer depends on where the ribbon is.' }, { ...stroke[3], cause: 'The ribbon-feed mechanism winds a small length onto the take-up spool.', effect: 'A different patch will be available on a later stroke, instead of wearing one spot out.' }, { ...stroke[4], cause: 'The ribbon carrier drops away from the line.', effect: 'The letter remains. Backspace can reposition the paper, but cannot pull this ink back into the ribbon.' }],
    question: { prompt: 'Why can’t Backspace erase this letter?', choices: ['It only moves the carriage; the ink is already on the paper.', 'The ribbon has to be lifted first.', 'The key has run out of spring energy.'], answer: 0, explanation: 'Backspace moves the paper one position right. Typing again there makes an overstrike on the existing ink.' },
  },
  {
    focus: 'escapement', label: 'Spring → one space', title: 'Release a spring. Catch a tooth.',
    body: 'A wound mainspring pulls the carriage to the left through a strap. A rack and pinion couple that travel to an escapement wheel. Two catches, called dogs, control its teeth.',
    detail: 'The close-up isolates the wheel and dogs from their connecting gears. This full-drop design prints before advancing. Space trips the spacing action without sending a typebar.', duration: 18,
    beats: [{ ...stroke[0], cause: 'The mainspring pulls continuously, even when no key is pressed.', effect: 'A dog holds a wheel tooth, so the rack, carriage and paper cannot move.' }, { ...stroke[1], cause: 'The key action prepares the dogs to exchange the hold.', effect: 'The carriage remains at its printing position while the typebar approaches.' }, { ...stroke[2], cause: 'The typeface lands before the full-drop escapement releases travel.', effect: 'The letter prints at a stable position, without the sheet sliding under the face.' }, { ...stroke[3], cause: 'The dogs exchange the hold and let the wheel advance to its next stop.', effect: 'The mainspring pulls the paper left. One tooth interval corresponds to one character space.' }, { ...stroke[4], cause: 'A dog catches the next tooth and stops the wheel.', effect: 'The print point did not move. The next blank place on the paper is now lined up with it.' }],
    question: { prompt: 'Why doesn’t the carriage slide all the way to the margin?', choices: ['The key pushes it only a little.', 'A dog catches the next escapement tooth.', 'The ink glues it to the typebar.'], answer: 1, explanation: 'The spring supplies the pull; the escapement meters it. Its next stop limits each release to one character width.' },
  },
  {
    focus: 'shift', label: 'Shift → a second face', title: 'Two letters on one metal slug.',
    body: 'Each slug carries two character faces. On this basket-shift machine, holding Shift lowers the whole typebar basket so the uppercase face reaches the same print point.',
    detail: 'Watch the horizontal print line: it stays fixed. Some machines move the carriage instead; this one moves the basket.', duration: 16,
    beats: [
      { at: 0, pose: 0, label: 'Two faces', cause: 'The slug has lowercase and uppercase faces, one above the other.', effect: 'At normal basket height, the lowercase face lines up with the print point.' },
      { at: .10, pose: .35, label: 'Lower basket', cause: 'Holding Shift pulls the basket and all its typebars downward.', effect: 'The upper face is now aligned with the unchanged print point and platen.' },
      { at: .38, pose: .54, label: 'Strike', cause: 'While holding Shift, press the same letter key.', effect: 'The same linkage swings the same bar; it now presents the uppercase face.' },
      { at: .66, pose: .66, label: 'Print A', cause: 'The uppercase face squeezes ribbon against paper and platen.', effect: 'An A appears. No extra typebar or different ribbon is needed.' },
      { at: .72, pose: 1, label: 'Space', cause: 'The escapement releases one space, just as for a lowercase letter.', effect: 'The ink stays uppercase. Releasing Shift afterward restores the basket’s normal height.' },
    ],
    question: { prompt: 'What changes when you hold Shift here?', choices: ['A different uppercase typebar is selected.', 'The platen moves to a new line.', 'The basket lowers to align the other face.'], answer: 2, explanation: 'The same bar carries both faces. Basket movement chooses which face meets the fixed print point.' },
  },
  {
    focus: 'return', label: 'Return → the next line', title: 'Two motions start a new line.',
    body: 'The return lever does two jobs: it turns the platen to feed the paper, and lets your hand push the whole carriage back to the right-hand starting position.',
    detail: 'Returning the carriage also winds the mainspring for the next line. The bell is a warning; a manual typewriter does not wrap automatically.', duration: 16,
    beats: [
      { at: 0, pose: 0, label: 'Line end', cause: 'Successive spaces have moved the carriage toward the left.', effect: 'The paper’s next printing position is near the right-hand margin of the page.' },
      { at: .16, pose: .34, label: 'Feed paper', cause: 'The return lever drives a pawl against the platen’s ratchet.', effect: 'The rubber roller turns and grips the paper, feeding it upward for the next line.' },
      { at: .52, pose: .65, label: 'Push right', cause: 'Your hand continues pushing the carriage right against the mainspring.', effect: 'The line’s starting margin approaches the fixed print point; the spring stores energy again.' },
      { at: .84, pose: 1, label: 'Stop', cause: 'The margin stop locates the carriage; the platen detent holds the feed position.', effect: 'The next line is aligned, below the previous one on the paper. Existing ink remains.' },
    ],
    question: { prompt: 'Which two motions are needed for a new line?', choices: ['Carriage right; paper upward around the platen.', 'Carriage left; paper downward.', 'Move the typebars right; erase the previous line.'], answer: 0, explanation: 'Returning right resets the horizontal position. Rotating the platen feeds paper up, bringing a fresh line to the fixed print point.' },
  },
];

export function lessonBeat(lesson: Lesson, progress: number): LessonBeat {
  for (let i = lesson.beats.length - 1; i >= 0; i--) if (progress >= lesson.beats[i].at) return lesson.beats[i];
  return lesson.beats[0];
}

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
  } else {
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
  return { focus, progress: p, explosion: separated ? 1 : 0, state, ink, reducedMotion };
}
