// One keystroke, examined as a physical event: order of cause and effect, rigid connections, energy, and
// what happens when a part is taken out of the chain.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Typewriter } from '../src/sim/machine';
import { CHAR_PITCH, GLYPH_PITCH, MARGIN, R_SEG, TRAVEL, trainPose } from '../src/sim/layout';
import { SPEC } from '../src/sim/mechanism';
import { TRAIN } from '../src/sim/typeaction';
import { col, count, first, line } from './helpers';

const strike = (tw: Typewriter, code = 'KeyH', force = 3.2, seconds = 0.3) => {
  tw.keyDown(code, { force });
  tw.advance(seconds);
};

test('at rest nothing moves and no solver work is done', () => {
  const tw = new Typewriter();
  tw.advance(0.1);
  assert.ok(tw.idle, 'machine comes to rest');
  const before = tw.sys.bodies.map((b) => b.q);
  tw.advance(1);
  assert.deepEqual(tw.sys.bodies.map((b) => b.q), before);
  assert.equal(tw.events.length, 0);
  assert.ok(Math.abs(tw.column - MARGIN.left) < 1e-9);
});

test('a keystroke happens in causal order and prints one letter one space wide', () => {
  const tw = new Typewriter();
  tw.advance(0.05);
  strike(tw);
  const order = ['fingerDown', 'pickup', 'trip', 'impact', 'step', 'barRest'].map((t) => first(tw, t));
  order.forEach((e, i) => assert.ok(e, `event ${i} occurred`));
  for (let i = 1; i < order.length; i++) assert.ok(order[i]!.t > order[i - 1]!.t, `${order[i]!.type} follows ${order[i - 1]!.type}`);
  assert.equal(count(tw, 'impact'), 1);
  assert.equal(count(tw, 'trip'), 1);
  assert.equal(count(tw, 'step'), 1);
  const m = tw.marks[0];
  assert.equal(m.ch, 'h');
  assert.ok(Math.abs(col(m) - MARGIN.left) < 0.02 && Math.abs(line(m)) < 0.01, 'printed at the first column of the first line');
  assert.ok(m.ink > 0.9 && m.cover === 1, 'fully inked through the lifted ribbon');
  assert.ok(m.speed > 2.5 && m.speed < 6, `type arrives at a few m/s (${m.speed.toFixed(2)})`);
  assert.ok(m.force > 40 && m.force < 200, `impact peaks at tens of newtons (${m.force.toFixed(0)})`);
  // The carriage is held still while the type prints, and moves exactly one tooth afterwards.
  assert.ok(Math.abs(tw.column - (MARGIN.left + 1)) < 1e-3, `one letter space (${tw.column})`);
  assert.ok(tw.idle, 'everything returns to rest');
  const flight = order[3]!.t - order[0]!.t;
  assert.ok(flight > 0.03 && flight < 0.09, `key to paper in tens of milliseconds (${(flight * 1e3).toFixed(1)} ms)`);
});

test('the wire links stay rigid and the visible linkage matches independent kinematics', () => {
  const tw = new Typewriter();
  const t = tw.byCode.get('KeyG')!;
  tw.keyDown('KeyG');
  let worst = 0, worstPose = 0;
  for (let i = 0; i < 6000; i++) {
    tw.step();
    worst = Math.max(worst, Math.abs(t.link1.value), Math.abs(t.link2.value));
    if (i % 50 === 0 && t.lever.q > 0.002) {
      // Closed-form loop closure from the lever angle alone must give the same sub-lever and typebar angles.
      const pose = trainPose(t.geom, t.lever.q);
      worstPose = Math.max(worstPose, Math.abs(pose.sub - t.sub.q), Math.abs(pose.bar - t.bar.q));
    }
  }
  assert.ok(worst < 1e-5, `link length error stays under 10 µm (worst ${(worst * 1e6).toFixed(2)} µm)`);
  assert.ok(worstPose < 2e-3, `simulated pose agrees with loop closure (worst ${worstPose.toExponential(2)} rad)`);
});

test('the print needs momentum: a slow press brings the type to the paper without inking it', () => {
  const tw = new Typewriter();
  const t = tw.byCode.get('KeyH')!;
  tw.keyDown('KeyH', { servo: true });
  for (let i = 0; i <= 400; i++) { tw.servoDepth.set('KeyH', Math.min(0.016, i * 0.00005)); tw.advance(0.005); }
  assert.ok(t.bar.q > TRAVEL - 0.03, `typebar is pressed up to the platen (${((t.bar.q * 180) / Math.PI).toFixed(1)}°)`);
  assert.ok(tw.core.state.fixedIn && !tw.core.state.looseIn, 'the escapement is tripped and waiting');
  assert.ok(Math.abs(tw.column - MARGIN.left) < 0.05, 'carriage has not stepped while the key is held');
  tw.keyUp('KeyH');
  tw.advance(0.4);
  assert.ok(Math.abs(tw.column - (MARGIN.left + 1)) < 1e-3, 'it steps when the key is let go');
  const inked = tw.marks.filter((m) => m.ink > 0.3);
  assert.equal(inked.length, 0, 'no dark impression without a blow');
});

test('a harder touch prints darker; a feeble one barely marks', () => {
  const result = (force: number) => { const tw = new Typewriter(); strike(tw, 'KeyH', force, 0.5); return tw.marks[0]; };
  const soft = result(0.9), medium = result(2.0), hard = result(4.5);
  assert.ok(soft && medium && hard);
  assert.ok(soft.speed < medium.speed && medium.speed < hard.speed, 'speed rises with touch');
  assert.ok(soft.force < medium.force && medium.force < hard.force, 'impact force rises with touch');
  assert.ok(soft.ink < medium.ink && medium.ink <= hard.ink, `ink ${soft.ink.toFixed(2)} < ${medium.ink.toFixed(2)} <= ${hard.ink.toFixed(2)}`);
  assert.ok(soft.ink < 0.75 && hard.ink > 0.97);
});

test('energy: the finger powers the typebar, the mainspring powers the carriage', () => {
  const tw = new Typewriter();
  tw.advance(0.05);
  const spring0 = tw.springEnergy;
  strike(tw);
  const m = tw.marks[0];
  const barKinetic = 0.5 * TRAIN.barInertia * (m.speed / R_SEG) ** 2;
  assert.ok(tw.fingerWork > barKinetic, `finger work ${(tw.fingerWork * 1e3).toFixed(1)} mJ exceeds typebar energy ${(barKinetic * 1e3).toFixed(1)} mJ`);
  assert.ok(tw.fingerWork < 0.08, 'and is a few tens of millijoules');
  const released = spring0 - tw.springEnergy;
  const expected = (SPEC.bandTension - SPEC.bandRate * tw.core.carriage.q) * CHAR_PITCH;
  assert.ok(Math.abs(released - expected) < 0.03 * expected, `one letter space releases ${(released * 1e3).toFixed(1)} mJ of spring energy`);
});

test('counterfactuals: each part of the chain is necessary for its effect', () => {
  // 1. No draw link to the typebar: the key goes down, nothing else happens.
  let tw = new Typewriter();
  let t = tw.byCode.get('KeyH')!;
  tw.keyDown('KeyH');
  t.link2.enabled = false;
  tw.advance(0.3);
  assert.equal(tw.marks.length, 0, 'no link, no print');
  assert.ok(Math.abs(tw.column - MARGIN.left) < 1e-6, 'no link, no letter space');

  // 2. Typebar cannot reach the universal bar: it prints but the carriage stays, so letters pile up.
  tw = new Typewriter();
  t = tw.byCode.get('KeyH')!;
  tw.keyDown('KeyH');
  t.ubar.enabled = false;
  tw.advance(0.3);
  assert.equal(tw.marks.length, 1);
  assert.equal(tw.marks[0].cover, 0, 'the ribbon was never lifted, so the blow leaves no ink');
  assert.ok(Math.abs(tw.column - MARGIN.left) < 1e-6, 'and the escapement never tripped');

  // 3. Ribbon vibrator unhooked: full blow, escapement works, but no ink reaches the paper.
  tw = new Typewriter();
  tw.core.ribbonLink2.enabled = false;
  strike(tw);
  assert.equal(tw.marks.length, 1);
  assert.equal(tw.marks[0].ink, 0);
  assert.ok(Math.abs(tw.column - (MARGIN.left + 1)) < 1e-3);

  // 4. Mainspring let down: the escapement trips, the letter prints, and the carriage does not move.
  tw = new Typewriter();
  tw.core.mainspring.enabled = false;
  strike(tw);
  assert.ok(tw.marks[0].ink > 0.9);
  assert.equal(count(tw, 'trip'), 1);
  assert.ok(tw.column < MARGIN.left + 0.02, 'no spring, no letter space');

  // 5. Platen dropped out of reach is not modelled by removal; instead check Shift really moves the target:
  tw = new Typewriter();
  tw.keyDown('ShiftLeft', { hold: true, force: 5.5 });
  tw.advance(0.15);
  assert.ok(Math.abs(tw.core.cradle.q - GLYPH_PITCH) < 5e-5, 'shift lifts the platen by one glyph pitch');
  strike(tw);
  assert.equal(tw.marks[0].ch, 'H');
  assert.ok(Math.abs(line(tw.marks[0])) < 0.02, 'the capital lands on the same writing line');
});

test('results converge as the timestep is refined', () => {
  const run = (h: number) => {
    const tw = new Typewriter();
    tw.sys.h = h;
    tw.keyDown('KeyH', { force: 3.2 });
    tw.advance(0.3);
    const impact = first(tw, 'impact')!;
    return { t: impact.t, speed: impact.mark!.speed, force: impact.mark!.force, col: tw.column };
  };
  const a = run(25e-6), b = run(12.5e-6), c = run(6.25e-6);
  assert.ok(Math.abs(a.t - c.t) < 0.012 * c.t, `impact time ${a.t} vs ${c.t}`);
  assert.ok(Math.abs(a.speed - c.speed) < 0.03 * c.speed, `impact speed ${a.speed} vs ${c.speed}`);
  assert.ok(Math.abs(b.t - c.t) <= Math.abs(a.t - c.t) + 1e-5, 'finer steps move toward the limit');
  assert.ok(Math.abs(a.force - c.force) < 0.08 * c.force, `peak force ${a.force} vs ${c.force}`);
  assert.equal(Math.round(a.col), Math.round(c.col));
});

test('a snapshot restores the exact state: the future replays bit for bit', () => {
  const tw = new Typewriter();
  tw.keyDown('KeyR');
  tw.advance(0.04);
  const snap = tw.snapshot();
  tw.advance(0.4);
  const end1 = { q: tw.sys.bodies.map((b) => b.q), marks: JSON.stringify(tw.marks), col: tw.column };
  tw.restore(snap);
  assert.equal(tw.marks.length, 0);
  tw.advance(0.4);
  assert.deepEqual(tw.sys.bodies.map((b) => b.q), end1.q);
  assert.equal(JSON.stringify(tw.marks), end1.marks);
});
