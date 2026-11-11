// The guided tour: what to look at, what to notice, and which real simulation to run for each step.

import type { App } from '../app';
import { CHAR_PITCH, ESC, GLYPH_PITCH, MARGIN, R_SEG } from '../sim/layout';
import { SPEC } from '../sim/mechanism';
import type { StepView, TourCtl, TourStep } from './tour';
import type { Shot } from './camera';

const KEY = 'KeyH';
// Side elevation: the machine sliced just to the right of the H key's train and seen square-on, like a
// drawing in a repair manual. Front of the machine is on the left.
const CUT = 0.03;
const side = (z: number, y: number, dist: number): Shot => ({ pos: [dist, y, z], target: [0, y, z] });
const DEG = 180 / Math.PI;
const train = (app: App) => app.tw.byCode.get(KEY)!;
const trainParts = [`lever:${KEY}`, `link1:${KEY}`, `sub:${KEY}`, `link2:${KEY}`, `bar:${KEY}`];

const keyDepth = (app: App): number => { const t = train(app); return (t.geom.top[1] - t.lever.world(t.geom.top)[1]) * 1000; };
const R = {
  depth: ['Key pressed', (a: App) => `${keyDepth(a).toFixed(1)} mm of 14`] as [string, (a: App) => string],
  bar: ['Typebar swung', (a: App) => `${(train(a).bar.q * DEG).toFixed(0)}° of 100°`] as [string, (a: App) => string],
  speed: ['Type face speed', (a: App) => `${(Math.abs(train(a).bar.v) * R_SEG).toFixed(2)} m/s`] as [string, (a: App) => string],
  finger: ['Fingertip speed', (a: App) => { const t = train(a); return `${(Math.abs(t.lever.v) * Math.hypot(t.geom.top[1] - t.geom.fulcrum[1], t.geom.top[2] - t.geom.fulcrum[2])).toFixed(2)} m/s`; }] as [string, (a: App) => string],
  link: ['Pull in the draw link', (a: App) => `${Math.max(0, train(a).link2.tension).toFixed(1)} N`] as [string, (a: App) => string],
  ubar: ['Universal bar pushed', (a: App) => `${(a.tw.core.ubar.q * 1000).toFixed(1)} mm`] as [string, (a: App) => string],
  ribbon: ['Ribbon lifted', (a: App) => `${(a.tw.core.vibrator.q * 1000).toFixed(1)} mm`] as [string, (a: App) => string],
  dogs: ['Holding the wheel', (a: App) => { const s = a.tw.core.state; return s.looseIn && s.fixedIn ? 'both dogs' : s.fixedIn ? 'fixed dog' : 'loose dog'; }] as [string, (a: App) => string],
  column: ['Carriage position', (a: App) => `${(a.tw.column - MARGIN.left).toFixed(2)} spaces`] as [string, (a: App) => string],
  force: ['Force on the paper', (a: App) => `${Math.max(train(a).hit[0].force, train(a).hit[1].force).toFixed(0)} N`] as [string, (a: App) => string],
  fingerWork: ['Work done by the finger', (a: App) => `${(a.tw.fingerWork * 1000).toFixed(1)} mJ`] as [string, (a: App) => string],
  spring: ['Energy left in the mainspring', (a: App) => `${(a.tw.springEnergy * 1000).toFixed(0)} mJ`] as [string, (a: App) => string],
  hand: ['Work done by the hand', (a: App) => `${(a.tw.handWork * 1000).toFixed(0)} mJ`] as [string, (a: App) => string],
  shift: ['Platen lifted', (a: App) => `${(a.tw.core.cradle.q * 1000).toFixed(1)} mm of ${(GLYPH_PITCH * 1000).toFixed(1)}`] as [string, (a: App) => string],
  line: ['Paper fed', (a: App) => `${a.tw.line.toFixed(2)} lines`] as [string, (a: App) => string],
};

// The moments of one keystroke, in order. Each tour step plays from one to the next.
const MOMENTS: Array<(c: TourCtl) => boolean> = [
  () => true,
  (c) => train(c.app).lever.q > 0.2 * train(c.app).geom.keyAngle,
  (c) => train(c.app).bar.q > 50 / DEG,
  (c) => c.app.tw.core.ubar.q > 0.0012,
  (c) => !c.app.tw.core.state.looseIn,
  // the instant of greatest pressure: the type face is on the paper and the bar has just stopped
  (c) => { const t = train(c.app); return (t.hit[0].active || t.hit[1].active) && t.bar.v <= 0; },
  (c) => c.seen('step'),
  (c) => c.app.tw.idle,
];
const stroke = (from: number, to: number, force = 3.2) => async (c: TourCtl): Promise<void> => {
  c.app.tw.keyDown(KEY, { force });
  if (from > 0) c.skipTo(() => MOMENTS[from](c));
  await c.playTo(() => MOMENTS[to](c), 1);
};

const type = (c: TourCtl, text: string): void => {
  for (const ch of text) {
    if (ch === ' ') c.app.typist.enqueue({ kind: 'space' });
    else if (ch === '\n') c.app.typist.enqueue({ kind: 'return' });
    else { const k = c.app.tw.keys.find((q) => q.lower === ch || q.upper === ch); if (k) c.app.typist.enqueue({ kind: 'char', code: k.code, shift: k.upper === ch }); }
  }
};
const quiet = (c: TourCtl) => c.app.typist.pending === 0 && c.app.tw.idle;

// The line lock is shown from three places: under the carriage, where its lug meets the comb's post; from behind
// and above, looking down between the key levers at the comb; and from the typist's side, at the key being tried.
const TRIP_VIEW: StepView = { shot: 'tripLock', shell: 'hidden', focus: ['escapement', 'carriage'], highlight: ['rocker'] };
const LOCK_VIEW: StepView = { shot: 'lockPost', shell: 'hidden', focus: ['bell', 'keys', 'carriage'], highlight: ['lockComb'] };

export const TOUR: TourStep[] = [
  {
    chapter: 'Overview', title: 'A printing press you play like a piano',
    body: `<p>A manual typewriter has no motor. Everything it does is powered by <b>your fingers</b> and by <b>one spring you wind with your left hand</b>.</p>
      <p>It has four jobs: strike a letter, move one space, switch between two sets of characters, and start a new line. This tour shows the parts that do each job, running a real physical simulation in slow motion.</p>
      <p>Watch it type a few words first.</p>`,
    view: { shot: 'hero', shell: 'solid', focus: null, explode: 0 }, speed: 1,
    run: async (c) => { type(c, 'How it works'); await c.playTo(() => quiet(c), 6); },
  },
  {
    chapter: 'Overview', title: 'Inside: five small machines',
    body: `<p>With the shell off and the parts coloured by job:</p>
      <ul class="legend">
        <li><i style="background:#e8b84a"></i><b>Keyboard</b>: 44 key levers</li>
        <li><i style="background:#e8793a"></i><b>Type action</b>: links and typebars that throw the type at the paper</li>
        <li><i style="background:#3aa6e8"></i><b>Escapement</b>: lets the carriage move exactly one space</li>
        <li><i style="background:#4fc47f"></i><b>Carriage and mainspring</b>: carries the paper, pulled by a spring</li>
        <li><i style="background:#d8433f"></i><b>Ribbon</b>, <i style="background:#a06be0"></i><b>shift</b>, <i style="background:#2fc7c0"></i><b>line feed</b> and <i style="background:#e86aa8"></i><b>bell</b></li>
      </ul>
      <p>Drag to look around. Click any part to read what it does.</p>`,
    view: { shot: 'hero', shell: 'hidden', focus: null, color: true, explode: 0 },
  },
  {
    chapter: 'Overview', title: 'Pulled apart',
    body: `<p>The same machine exploded. Notice how the wire links (stretched out here) still join each key lever to its sub-lever and each sub-lever to its typebar: that chain is what we follow next.</p>
      <p>The carriage on top is not connected to the keys at all, except through one small part, the <b>universal bar</b>.</p>`,
    view: { shot: 'exploded', shell: 'glass', focus: null, color: true, explode: 1 },
  },
  {
    chapter: 'One keystroke', title: '1 · The finger moves a lever',
    body: `<p>We press <b>H</b>, slowed 40 times, with the other 43 keys hidden.</p>
      <p>The key lever is a long steel bar pivoting at the <b>very back</b> of the machine. Your finger pushes its front end down. The lever itself only turns about 3°.</p>
      <p>Hanging from the middle of the lever is a short wire, the <b>key link</b>. It is the first thing the lever pulls.</p>
      <p>The arrows are forces the simulation is computing right now: blue for the finger, orange for the pull in each link.</p>`,
    view: { shot: side(0.03, 0.08, 0.74), slice: CUT, forces: true, shell: 'hidden', focus: ['keys', 'typeaction'], solo: KEY, highlight: [`lever:${KEY}`, `link1:${KEY}`] },
    speed: 0.025, run: stroke(0, 1), readouts: [R.depth, R.finger, R.bar],
  },
  {
    chapter: 'One keystroke', title: '2 · Two links multiply the motion',
    body: `<p>The key link pulls the short arm of the <b>sub-lever</b> (a bell crank). Its long arm swings forward much further, and pulls the <b>draw link</b>.</p>
      <p>The draw link is hooked to the typebar's <b>heel</b>, only 10 mm from the pivot, so a small pull swings the long bar a long way. Each stage trades force for distance.</p>
      <p>Compare the two speeds below: the type face is already moving about <b>eight times faster</b> than your fingertip.</p>`,
    view: { shot: side(0.035, 0.09, 0.46), slice: CUT, forces: true, shell: 'hidden', focus: ['keys', 'typeaction'], solo: KEY, highlight: [`sub:${KEY}`, `link2:${KEY}`, `bar:${KEY}`] },
    speed: 0.025, run: stroke(1, 2), readouts: [R.depth, R.bar, R.finger, R.speed, R.link],
  },
  {
    chapter: 'One keystroke', title: '3 · The typebar meets the universal bar',
    body: `<p>Four fifths of the way up, the typebar's shank touches a light arc lying across its path: the <b>universal bar</b>. Every typebar hits this same bar, which is why it is called universal.</p>
      <p>From here to the paper the typebar pushes it back about 4.6 mm. That one small motion starts two things at once.</p>
      <p>First, a little crank multiplies it to <b>lift the ink ribbon</b> up in front of the paper.</p>`,
    view: { shot: side(-0.004, 0.128, 0.3), slice: CUT, sliceBack: -CUT, shell: 'hidden', focus: ['typeaction', 'escapement', 'ribbon', 'feed', 'paper'], solo: KEY, highlight: ['ubar', 'ribbonLever', 'vibrator', 'ribbonLink1', 'ribbonLink2'] },
    speed: 0.012, run: stroke(2, 3), readouts: [R.bar, R.ubar, R.ribbon, R.speed],
  },
  {
    chapter: 'One keystroke', title: '4 · The escapement is tripped, before the letter prints',
    body: `<p>Second, the universal bar's push rod rocks the <b>dog rocker</b> under the escape wheel.</p>
      <p>The wheel wants to turn: the carriage's spring is pulling on it. The <b>loose dog</b> has been holding one tooth. Now the rocker slides the <b>fixed dog</b> into the wheel and the loose dog out. For an instant both are in, so the wheel can never run away.</p>
      <p>The wheel has not turned. The carriage must stand still while the letter prints. But the freed loose dog <b>springs back a third of a tooth</b>, ready to drop in behind the next one.</p>`,
    view: { shot: { pos: [-0.078, 0.118, -0.172], target: [0, 0.107, -0.095] }, shell: 'hidden', focus: ['escapement'], solo: KEY, highlight: ['looseDog'] },
    speed: 0.006, run: stroke(3, 4), readouts: [R.ubar, R.dogs, R.column],
  },
  {
    chapter: 'One keystroke', title: '5 · Impact',
    body: `<p>Slowed 400 times, and frozen at the instant of greatest pressure. The type slug has passed through the guide and hit the ribbon, paper and rubber platen at about <b>4 metres per second</b>.</p>
      <p>The contact lasts about a third of a millisecond and peaks at about <b>85 newtons</b>, more than twenty-five times what your finger pressed with. This is why the stroke must be a quick tap: the linkage does not <em>press</em> the type on the paper, it <em>throws</em> it. Momentum makes the mark.</p>
      <p>Next, the rubber throws the bar back.</p>`,
    view: { shot: side(-0.016, 0.166, 0.1), slice: 0.0125, sliceBack: -0.0125, forces: true, shell: 'hidden', focus: ['typeaction', 'ribbon', 'feed', 'paper'], solo: KEY, highlight: [`bar:${KEY}`] },
    speed: 0.0025, run: stroke(4, 5), readouts: [R.speed, R.force, R.ribbon, R.fingerWork],
  },
  {
    chapter: 'One keystroke', title: '6 · One tooth, one space',
    body: `<p>The typebar falls away and the universal bar follows it home, so the rocker rocks back.</p>
      <p>The loose dog slides into the wheel again, now <b>behind the next tooth</b>. Then the fixed dog slides out. Nothing holds the wheel, so the mainspring pulls the carriage and the wheel turns until that next tooth lands on the loose dog and pushes it back onto its stop.</p>
      <p>One tooth is exactly <b>one tenth of an inch</b> of carriage travel: one letter space. Your finger did not move the carriage; the spring did.</p>`,
    view: { shot: { pos: [0.035, 0.118, -0.25], target: [0, 0.112, -0.096] }, forces: true, shell: 'hidden', focus: ['escapement', 'carriage'], solo: KEY, highlight: ['looseDog'] },
    speed: 0.02, run: stroke(5, 6), readouts: [R.dogs, R.column, R.spring],
  },
  {
    chapter: 'One keystroke', title: '7 · Everything falls back to rest',
    body: `<p>The typebar drops onto its felt rest, the key spring lifts the lever, and the machine is ready again, about a sixth of a second after it started.</p>
      <p><b>The energy account for this one letter:</b> your finger put in the work shown below. Nearly half of it arrived at the paper as the typebar's motion; the rest went into lifting the bar, stretching the key spring, flicking the universal bar and ribbon, and friction.</p>
      <p>The step of the carriage cost your finger nothing. It took about 23 mJ out of the mainspring.</p>`,
    view: { shot: side(0.03, 0.08, 0.74), slice: CUT, shell: 'hidden', focus: ['keys', 'typeaction'], solo: KEY, highlight: trainParts },
    speed: 0.05, run: stroke(6, 7), readouts: [R.fingerWork, R.spring, R.column],
  },
  {
    chapter: 'Spacing', title: 'The spring that moves the paper',
    body: `<p>At the back left is a drum with a <b>clock spring</b> coiled inside. A band from the drum runs under the carriage to its far end and pulls it to the left with about 9 N, all the time.</p>
      <p>The rack under the carriage turns a small pinion on the escape wheel's shaft, so the escapement is all that stops the carriage sliding away. Each keystroke lets it go one tooth.</p>
      <p>Here it types a few letters at quarter speed. Watch the drum wind the band in, and the stored energy fall.</p>`,
    view: { shot: 'drum', forces: true, shell: 'hidden', focus: ['carriage', 'escapement'], highlight: ['drum', 'drawBand', 'escapeWheel', 'pinion'] },
    speed: 0.25, run: async (c) => { type(c, 'spring'); await c.playTo(() => quiet(c), 4); }, readouts: [R.column, R.spring],
  },
  {
    chapter: 'Spacing', title: 'The space bar: the escapement on its own',
    body: `<p>The space bar is a lever that pivots in the middle of the machine. Push the front down and its back end <b>lifts an arm of the dog rocker</b> directly.</p>
      <p>The dogs swap exactly as before and the carriage steps one tooth, but no typebar moves, so nothing prints. Notice that the carriage steps when you <em>let go</em>, not when you press.</p>`,
    view: { shot: 'escapementSide', shell: 'hidden', focus: ['escapement'], highlight: ['spaceBar', 'rocker', 'looseDog'] },
    speed: 0.04, run: async (c) => { c.app.tw.keyDown('Space', { force: 2.2 }); await c.playToEvent('step', 1); }, readouts: [R.dogs, R.column],
  },
  {
    chapter: 'Shift', title: 'Capitals: move the paper, not the type',
    body: `<p>Every slug carries <b>two characters</b>, the capital above the small letter. To print the upper one, the machine does not change the typebar's swing at all. It <b>lifts the platen</b> 6.8 mm so the upper character is the one that meets the paper squarely.</p>
      <p>The Shift keys are joined by a frame that pivots in the middle: front down, back rail up, and the rail lifts the cradle that holds the platen. The cradle weighs a kilogram, which is why Shift is the heaviest key; springs carry most of it.</p>
      <p>Here Shift goes down, then H is struck. The picture stops as the capital prints, with the platen still raised.</p>`,
    view: { shot: side(0.02, 0.105, 0.78), slice: 0.135, shell: 'hidden', focus: ['shift', 'feed', 'paper', 'typeaction', 'keys'], solo: KEY, highlight: ['shiftFrame'] },
    speed: 0.1, run: async (c) => { type(c, 'H'); await c.playTo(() => c.seen('impact'), 3); }, readouts: [R.shift, R.bar, ['Printed', (a) => a.tw.marks.map((m) => m.ch).join('') || '—']],
  },
  {
    chapter: 'New line', title: 'One lever, two jobs',
    body: `<p>After a few words the left hand pushes the long <b>return lever</b>.</p>
      <p><b>First</b> the lever swings on the carriage: a pawl turns the platen's ratchet one tooth, and a spring detent clicks it into place. The platen is exactly 4 inches round with 24 teeth, so one tooth is 1/6 inch of paper: one line.</p>
      <p><b>Then</b> the lever reaches its stop and the same push shoves the whole carriage back to the right. The pinion's ratchet clicks over tooth by tooth, the zip of a carriage return, and the draw band is pulled off the drum: <b>this is what winds the mainspring</b> for the next line.</p>`,
    view: { shot: 'lever', shell: 'hidden', focus: ['feed', 'carriage', 'escapement', 'paper', 'shift'], highlight: ['lineLever', 'platen', 'drum'] },
    speed: 0.3,
    run: async (c) => {
      c.speed(1); type(c, 'a new line');
      c.skipTo(() => quiet(c), 4);
      c.speed(0.3); type(c, '\n');
      await c.playTo(() => c.seen('returnDone') && quiet(c), 4);
    },
    readouts: [R.line, R.column, R.hand, R.spring],
  },
  {
    chapter: 'New line', title: 'The bell: eight spaces to go',
    body: `<p>You cannot see the end of the line while watching your copy, so the machine tells you. A cam on the carriage pushes a small sprung <b>hammer</b> aside as it passes, then lets go. The hammer flies back and strikes the bell once.</p>
      <p>Eight spaces later the carriage reaches the right margin stop and the keys lock: that is the next step.</p>`,
    view: { shot: 'bell', shell: 'hidden', focus: ['bell', 'carriage', 'escapement'], highlight: ['hammer', 'bell'] },
    speed: 0.2,
    run: async (c) => {
      c.app.tw.placeCarriage(MARGIN.right - MARGIN.bellBefore - 2);
      c.skipTo(() => c.app.tw.idle, 0.3);
      type(c, 'ding');
      await c.playTo(() => c.seen('bell') && quiet(c), 4);
    },
    readouts: [['Spaces left on the line', (a) => `${(MARGIN.right - a.tw.column).toFixed(0)}`]],
  },
  {
    chapter: 'New line', title: 'The end of the line: the keys lock',
    body: `<p>Under the key levers, near their pivot, lies a dark slotted strip: the <b>lock comb</b>. Normally every lever drops into one of its slots and the comb does nothing.</p>
      <p>A post on the comb reaches up to the carriage. As the carriage takes the last step of the line, a lug on it meets the small spring on the post and pushes the comb 2 mm sideways. Now its <b>teeth stand under the levers</b>: a key goes down a couple of millimetres, meets a tooth and stops, so you cannot type over the last letter.</p>
      <p>Three views: the lug coming up to the orange post as two letters are typed; the comb sliding under the levers on the last letter of the line; then one more key, tried and stopped. Nothing you type is lost: it waits until you return the carriage, which lets the comb spring back.</p>`,
    view: LOCK_VIEW,
    speed: 0.2,
    run: async (c) => {
      c.app.tw.placeCarriage(MARGIN.right - 3);
      c.skipTo(() => c.app.tw.idle, 0.3);
      type(c, 'fu');
      await c.playTo(() => quiet(c), 3);
      c.view({ ...LOCK_VIEW, shot: 'lockTeeth', highlight: [] }, 1.6);
      await c.wait(2.2);
      type(c, 'l');
      await c.playTo(() => c.app.tw.lineLockIn && quiet(c), 3);
      await c.wait(1.2);
      c.view({ shot: 'lockKey', shell: 'solid', focus: null }, 1.6);
      await c.wait(2.2);
      type(c, 'l');
      await c.playTo(() => c.seen('locked') && c.app.tw.idle, 3);
    },
    readouts: [
      ['Spaces left on the line', (a) => `${(MARGIN.right - a.tw.column).toFixed(0)}`],
      ['Lock comb pushed', (a) => `${(a.tw.core.lockBar.q * 1000).toFixed(1)} mm`],
      ['Keys', (a) => (a.tw.lineLockIn ? 'locked' : 'free')],
    ],
  },
  {
    chapter: 'New line', title: 'A second guard, on the escapement',
    body: `<p>The comb can only slide under a lever that is <em>up</em>. A key already on its way down when the carriage arrives stays in its slot and holds the comb off.</p>
      <p>If that key went on to strike, it would trip the escapement with the carriage against the margin stop. The wheel could not turn, the dog would come back a tooth ahead, and your next line would start one space in. So the escapement has a guard of its own, the <b>trip lock</b>. As the carriage leaves the last column, a <b>tab</b> under it moves in behind a <b>finger</b> on the dog rocker's shaft, and the rocker can no longer swing far enough to trip.</p>
      <p>Here K is being held part of the way down while the last letter of the line is typed: watch the dark tab arrive behind the top of the orange finger. Then, from the side, K is pushed home. Its typebar comes up, meets the universal bar, and stops short of the paper.</p>`,
    view: TRIP_VIEW,
    speed: 0.1,
    run: async (c) => {
      const tw = c.app.tw, k = tw.byCode.get('KeyK')!;
      tw.placeCarriage(MARGIN.right - 1);
      c.skipTo(() => tw.idle, 0.3);
      // Unseen: a guided finger lowers K gently until it rests half-way down in its slot.
      tw.keyDown('KeyK', { servo: true });
      let n = 0;
      c.skipTo(() => { tw.servoDepth.set('KeyK', Math.min(0.007, ++n * 1e-6)); return n > 8500; }, 1);
      type(c, 'l');
      await c.playTo(() => tw.tripLockIn && c.app.typist.pending === 0 && tw.movingTrains.length === 1 && Math.abs(tw.core.carriage.v) < 1e-3, 3);
      await c.wait(1.4);
      c.view({ shot: side(-0.04, 0.128, 0.4), slice: 0.046, shell: 'hidden', focus: ['keys', 'typeaction', 'escapement', 'carriage', 'feed', 'paper'], solo: 'KeyK', highlight: ['bar:KeyK', 'ubar', 'rocker'] }, 1.6);
      await c.wait(2.2);
      tw.servoDepth.set('KeyK', 0.0155);
      // Stop once the typebar has come to rest against the universal bar, with the rocker on the tab.
      await c.playTo(() => c.seen('locked') && tw.core.tripLock.active && Math.abs(tw.core.rocker.v) < 0.05 && Math.abs(k.bar.v) < 0.2, 1.2);
    },
    readouts: [
      ['Typebar K swung', (a) => `${((a.tw.byCode.get('KeyK')!.bar.q * 180) / Math.PI).toFixed(0)}° of 100°`],
      ['Dog rocker swung', (a) => `${(a.tw.core.rocker.q * 1000).toFixed(0)} of the ${((ESC.fixedIn / ESC.dogR) * 1000).toFixed(0)} mrad it takes to trip`],
      ['Letters printed', (a) => a.tw.marks.map((m) => m.ch).join('') || '—'],
    ],
  },
  {
    chapter: 'Your turn', title: 'Now type',
    body: `<p>The machine is yours. Just type; <kbd>Enter</kbd> returns the carriage.</p>
      <ul>
        <li><b>Slow motion</b> and <b>pause</b> are at the bottom. Paused, drag the replay bar to scrub back through the last few seconds.</li>
        <li><b>Body</b>, <b>Focus</b>, <b>Exploded</b> and <b>Slice</b> on the right let you see inside while it runs.</li>
        <li>Click a key lever and use <b>Press slowly</b> to feel the stroke by hand: a slow press brings the type to the paper but leaves no mark.</li>
        <li>Turn the <b>touch</b> down and watch the letters fade.</li>
      </ul>`,
    view: { shot: 'typist', shell: 'glass', focus: null, explode: 0, color: false, solo: null }, free: true,
  },
];

export const TOUR_FACTS = { perStep: SPEC.bandTension * CHAR_PITCH };
