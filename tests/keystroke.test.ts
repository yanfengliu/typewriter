// One keystroke, examined as a physical event: order of cause and effect, rigid connections, energy, and
// what happens when a part is taken out of the chain.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Typewriter } from '../src/sim/machine';
import { CHAR_PITCH, GLYPH_PITCH, MARGIN, R_SEG, TRAVEL, TRIP_LOCK, trainPose } from '../src/sim/layout';
import { SPEC } from '../src/sim/mechanism';
import { TRAIN } from '../src/sim/typeaction';
import type { Rod } from '../src/sim/elements';
import type { Vec3 } from '../src/sim/vec';
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
  // The error that matters is the one left after each substep's solve: it is what is drawn, and what the next
  // substep starts from. Measured as the distance between the two pins minus the length of the wire.
  const A: Vec3 = [0, 0, 0], B: Vec3 = [0, 0, 0];
  const off = (r: Rod): number => { r.ends(A, B); return Math.abs(Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]) - r.length); };
  let train = 0, ribbon = 0, worstPose = 0;
  for (const [code, force] of [['KeyG', 3.2], ['Digit1', 9], ['Slash', 6], ['Equal', 2]] as Array<[string, number]>) {
    const tw = new Typewriter();
    const t = tw.byCode.get(code)!;
    tw.keyDown(code, { force });
    for (let i = 0; i < 9000 && (i < 100 || t.awake); i++) {
      tw.step();
      train = Math.max(train, off(t.link1), off(t.link2));
      ribbon = Math.max(ribbon, off(tw.core.ribbonLink1), off(tw.core.ribbonLink2));
      if (i % 50 === 0 && t.lever.q > 0.002) {
        // Closed-form loop closure from the lever angle alone must give the same sub-lever and typebar angles.
        const pose = trainPose(t.geom, t.lever.q);
        worstPose = Math.max(worstPose, Math.abs(pose.sub - t.sub.q), Math.abs(pose.bar - t.bar.q));
      }
    }
    assert.equal(tw.marks.length, 1);
  }
  assert.ok(train < 6e-6, `key-train links stay within 6 µm of their length (worst ${(train * 1e6).toFixed(2)} µm)`);
  assert.ok(ribbon < 2e-5, `the ribbon lift's two short links within 20 µm (worst ${(ribbon * 1e6).toFixed(2)} µm)`);
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
  const run = (wound: boolean) => {
    const tw = new Typewriter();
    if (!wound) tw.core.mainspring.enabled = false;
    const spring0 = tw.springEnergy, travel0 = tw.core.carriage.q;
    strike(tw);
    return { tw, mark: tw.marks[0], work: tw.fingerWork, released: spring0 - tw.springEnergy, travel0 };
  };
  const a = run(true);
  const barKinetic = 0.5 * TRAIN.barInertia * (a.mark.speed / R_SEG) ** 2;
  assert.ok(a.work > barKinetic, `finger work ${(a.work * 1e3).toFixed(1)} mJ exceeds typebar energy ${(barKinetic * 1e3).toFixed(1)} mJ`);
  assert.ok(a.work < 0.08, 'and is a few tens of millijoules');
  // The spring's energy over one letter space is its mean pull times the distance.
  const expected = (SPEC.bandTension - SPEC.bandRate * (a.travel0 + CHAR_PITCH / 2)) * CHAR_PITCH;
  assert.ok(Math.abs(a.released - expected) < 1e-3 * expected, `one letter space releases ${(a.released * 1e3).toFixed(2)} mJ of spring energy (${(expected * 1e3).toFixed(2)} expected)`);
  // And none of that comes from the finger: with the mainspring let down the same stroke costs the finger the
  // same work and lands the same blow, while the carriage stays where it is.
  const b = run(false);
  assert.ok(Math.abs(b.work - a.work) < 0.01 * a.work, `finger work with the spring ${(a.work * 1e3).toFixed(2)} mJ, without ${(b.work * 1e3).toFixed(2)} mJ`);
  assert.ok(Math.abs(b.mark.speed - a.mark.speed) < 0.005 * a.mark.speed && Math.abs(b.mark.force - a.mark.force) < 0.01 * a.mark.force, 'same blow');
  assert.ok(Math.abs(a.tw.column - (MARGIN.left + 1)) < 1e-3 && b.tw.column < MARGIN.left + 0.02, 'only the wound machine spaces');
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

/** Everything observable about the machine, exactly: used to compare two runs bit for bit. */
const fingerprint = (tw: Typewriter): string => JSON.stringify({
  t: tw.sys.time, steps: tw.sys.steps,
  q: tw.sys.bodies.map((b) => b.q), v: tw.sys.bodies.map((b) => b.v),
  state: tw.core.state, awake: Object.values(tw.core.groups).map((g) => g.awake), moving: tw.movingTrains.map((t) => t.geom.code),
  fingers: tw.fingers.map((f) => [f.id, f.phase, f.work]), marks: tw.marks, events: tw.events,
  work: [tw.fingerWork, tw.handWork],
});

/**
 * Take a snapshot at the moment `reach` leaves the machine in, play `future` and record where it ends. Then drive
 * the machine somewhere quite different (and on from there, if `away` is given), restore, play the same future
 * again: it must end in exactly the same place.
 */
function replays(reach: (tw: Typewriter) => void, future: (tw: Typewriter) => void, away: (tw: Typewriter) => void = () => {}): void {
  const tw = new Typewriter();
  reach(tw);
  const snap = tw.snapshot(), marks = tw.marks.length;
  tw.events = [];
  future(tw);
  const first = fingerprint(tw);
  // Elsewhere: another letter, a capital held on Shift, a carriage return half done.
  for (const f of tw.fingers) f.release();
  tw.advance(0.3);
  tw.keyDown('KeyZ'); tw.advance(0.25);
  tw.keyDown('ShiftLeft', { hold: true, force: 5.5 }); tw.advance(0.2);
  tw.keyDown('KeyQ'); tw.advance(0.02);
  tw.returnCarriage(); tw.advance(0.12);
  away(tw);
  tw.restore(snap);
  assert.equal(tw.marks.length, marks, 'marks made after the snapshot are gone');
  tw.events = [];
  future(tw);
  const second = fingerprint(tw);
  assert.ok(second === first, 'the same future from the restored state ends in exactly the same state');
}

const until = (tw: Typewriter, cond: () => boolean, limit = 1): void => { const t0 = tw.time; while (!cond() && tw.time - t0 < limit) tw.step(); assert.ok(cond(), 'the moment was reached'); };

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

test('snapshots are complete at awkward moments: mid-impact, asleep, mid-return, on the bell cam, against the line lock and the trip lock', () => {
  const h = (tw: Typewriter) => tw.byCode.get('KeyH')!;
  // The type face is on the paper and the force is already falling: the peak that will become the ink mark is past.
  replays((tw) => {
    tw.keyDown('KeyH');
    let peak = 0;
    until(tw, () => { const f = h(tw).hit[0].force; if (f > peak) peak = f; return peak > 20 && f < 0.8 * peak && h(tw).hit[0].active; });
  }, (tw) => { tw.advance(0.3); assert.equal(tw.marks.length, 1); assert.ok(tw.marks[0].ink > 0.9, 'the mark keeps its full darkness'); });
  // The very substep in which a key first meets the line lock: the finger has not yet felt it stop.
  replays((tw) => {
    tw.placeCarriage(MARGIN.right); tw.advance(0.05);
    tw.keyDown('KeyH');
    until(tw, () => h(tw).lock.active);
    assert.equal(tw.fingers[0].phase, 'press');
  }, (tw) => { tw.advance(0.3); assert.equal(tw.marks.length, 0); assert.ok(tw.idle); });
  // One substep earlier: the 'locked' event must still be reported, once, when the future is replayed.
  replays((tw) => {
    tw.placeCarriage(MARGIN.right); tw.advance(0.05);
    tw.keyDown('KeyH');
    for (let i = 0; i < 4000; i++) {
      const before = tw.snapshot();
      tw.step();
      if (h(tw).lock.active) { tw.restore(before); break; }
    }
    assert.ok(!h(tw).lock.active && tw.fingers.length === 1);
  }, (tw) => { tw.advance(0.3); assert.equal(count(tw, 'locked'), 1); });
  // A key being lowered slowly by a guided finger, part of the way down.
  replays((tw) => {
    tw.keyDown('KeyH', { servo: true });
    for (let i = 1; i <= 60; i++) { tw.servoDepth.set('KeyH', i * 0.0001); tw.advance(0.004); }
  }, (tw) => {
    tw.advance(0.05);
    for (let i = 61; i <= 150; i++) { tw.servoDepth.set('KeyH', i * 0.0001); tw.advance(0.004); }
    tw.keyUp('KeyH'); tw.advance(0.4);
    assert.ok(Math.abs(tw.column - (MARGIN.left + 1)) < 1e-3);
  });
  // Everything at rest (and asleep) after a line and a return; then more typing.
  replays((tw) => {
    for (const code of ['KeyA', 'KeyB', 'KeyC']) { tw.keyDown(code); tw.advance(0.25); }
    tw.returnCarriage();
    until(tw, () => tw.idle, 3);
  }, (tw) => { tw.advance(0.1); tw.keyDown('KeyD'); tw.advance(0.3); tw.keyDown('Space'); tw.advance(0.3); assert.equal(tw.marks.length, 4); });
  // Half-way through a carriage return, with the hand pushing and the ratchet clicking.
  replays((tw) => {
    tw.placeCarriage(40); tw.advance(0.05);
    tw.returnCarriage();
    until(tw, () => tw.column < 25, 2);
  }, (tw) => { tw.advance(0.8); assert.ok(Math.abs(tw.column - MARGIN.left) < 1e-3 && Math.abs(tw.line - 1) < 0.02); });
  // A key held down with the escapement tripped and Shift half-way up.
  replays((tw) => {
    tw.keyDown('KeyK', { hold: true, force: 6 }); tw.advance(0.2);
    tw.keyDown('ShiftRight', { hold: true, force: 5.5 }); tw.advance(0.03);
  }, (tw) => { tw.advance(0.2); tw.keyUp('KeyK'); tw.advance(0.3); tw.keyUp('ShiftRight'); tw.advance(0.4); assert.ok(tw.idle); });
  // The carriage standing on the bell cam with the hammer part-cocked, asleep; the next letter rings the bell.
  replays((tw) => {
    tw.placeCarriage(MARGIN.right - MARGIN.bellBefore - 1); tw.advance(0.05);
    until(tw, () => tw.idle, 1);
  }, (tw) => { tw.keyDown('KeyE'); tw.advance(0.4); assert.equal(count(tw, 'bell'), 1); });
  // A finger pressing a key against the line lock, and one resting on the space bar.
  replays((tw) => {
    tw.placeCarriage(MARGIN.right); tw.advance(0.05);
    tw.keyDown('KeyJ', { hold: true, force: 5 }); tw.keyDown('Space', { hold: true, force: 3 });
    tw.advance(0.15);
    assert.ok(h(tw) && tw.byCode.get('KeyJ')!.lock.active, 'J is standing on the lock');
  }, (tw) => { tw.advance(0.1); tw.keyUp('KeyJ'); tw.keyUp('Space'); tw.advance(0.3); tw.keyDown('Backspace', { force: 4.5 }); tw.advance(0.4); tw.keyDown('KeyJ'); tw.advance(0.4); assert.equal(tw.marks.length, 1); });
  // The trip lock. A key that slipped past the comb during the last step is pressing the universal bar against the
  // locked rocker: the knock has been reported, and must not be reported again when the future is replayed.
  replays((tw) => {
    tw.placeCarriage(MARGIN.right - 1); tw.advance(0.05);
    tw.keyDown('KeyA'); tw.advance(0.06);
    tw.keyDown('KeyB', { hold: true, force: 5 });
    until(tw, () => tw.core.tripLock.active && count(tw, 'locked') === 1);
    tw.advance(0.3); // the typebar bounces off the universal bar a few times before the finger holds it there
    assert.ok(tw.tripLockIn && tw.core.tripLock.active && tw.marks.length === 1, 'B holds the rocker against the tab');
  }, (tw) => { tw.advance(0.1); assert.equal(count(tw, 'locked'), 0, 'one knock, reported once'); tw.keyUp('KeyB'); tw.advance(0.4); assert.ok(tw.lineLockIn && tw.idle); });
  // Its other stop, in the substep the two parts meet: the space bar has been let up only part of the way, the rocker
  // hovers short of home, and the carriage has just run against the rocker's finger.
  replays((tw) => {
    const c = tw.core;
    tw.placeCarriage(MARGIN.right - 1); tw.advance(0.05);
    tw.keyDown('Space', { servo: true });
    for (let i = 1; i <= 130; i++) { tw.servoDepth.set('Space', i * 0.0001); tw.advance(0.004); }
    for (let depth = 0.013; depth > 0.004 && (c.state.fixedIn || c.rocker.q > 0.068);) { depth -= 0.00005; tw.servoDepth.set('Space', depth); tw.advance(0.004); }
    until(tw, () => c.tripBlock.active, 0.5);
    assert.ok(!tw.tripLockIn && c.rocker.q > TRIP_LOCK.angle);
  }, (tw) => { tw.advance(0.05); tw.keyUp('Space'); tw.advance(0.5); assert.ok(tw.tripLockIn && Math.abs(tw.column - MARGIN.right) < 1e-3 && tw.idle); });
  // The same stop, with the carriage caught in its last few micrometres: a second, harder key swings the rocker out
  // just before the tab would have arrived, and the finger stops the carriage where it stands. That place is
  // remembered, not worked out again, so the machine is first driven on to where an ordinary keystroke leaves a
  // different one behind.
  replays((tw) => {
    const c = tw.core, ct = c.limits.cTrip, ang = TRIP_LOCK.angle;
    tw.placeCarriage(MARGIN.right - 1); tw.advance(0.05);
    const still = tw.snapshot();
    // How many substeps a 14 N blow takes to bring the rocker to the tab's angle, and the last letter to bring the tab.
    tw.keyDown('KeyB', { force: 14 });
    let flight = 0;
    for (let r0 = 0; flight < 4000;) { r0 = c.rocker.q; tw.step(); flight++; if (r0 <= ang && c.rocker.q > ang) break; }
    tw.restore(still);
    tw.keyDown('KeyA');
    const pressed = tw.snapshot();
    let cross = 0;
    while (c.carriage.q <= ct && cross < 6000) { tw.step(); cross++; }
    tw.restore(pressed);
    for (let i = 0; i < cross - flight - 10; i++) tw.step();
    tw.keyDown('KeyB', { force: 14 });
    until(tw, () => c.tripBlock.active, 0.1);
    assert.ok(c.tripBlock.bound > ct - 1.5e-5 && c.tripBlock.bound < ct, `caught ${((ct - c.tripBlock.bound) * 1e6).toFixed(1)} µm short of the trip point`);
  }, (tw) => { tw.advance(0.4); assert.ok(tw.tripLockIn && Math.abs(tw.column - MARGIN.right) < 1e-3 && tw.marks.length === 2); },
  (tw) => { tw.advance(1); tw.keyUp('ShiftLeft'); tw.advance(0.3); tw.keyDown('KeyZ'); tw.advance(0.3); assert.ok(Math.abs(tw.column - (MARGIN.left + 1)) < 1e-3, 'a letter was typed on the next line'); });
});

test('restoring from the middle of an impact leaves no stale contact behind', () => {
  const tw = new Typewriter();
  const rest = tw.snapshot();
  const t = tw.byCode.get('KeyH')!;
  tw.keyDown('KeyH');
  let guard = 0;
  while (!t.hit[0].active && guard++ < 8000) tw.step();
  assert.ok(t.hit[0].active, 'paused with the type face on the paper');
  tw.restore(rest);
  assert.equal(tw.marks.length, 0);
  // A fresh strike must run its whole course: the finger must not think the type has already landed.
  tw.keyDown('KeyH');
  tw.advance(0.3);
  assert.equal(tw.marks.length, 1);
  assert.ok(tw.marks[0].ink > 0.9);
  assert.ok(Math.abs(tw.column - (MARGIN.left + 1)) < 1e-3);
});
