// Typing as a user experiences it: nothing typed is lost, characters land where a typewriter puts them,
// and the carriage, bell, margins and line feed behave like the real mechanism.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAR_PITCH, LOCK_ANGLE, LOCK_ENGAGE, MARGIN, UBAR_PICKUP } from '../src/sim/layout';
import { SPEC } from '../src/sim/mechanism';
import { Rig, col, count, line, page, queueText, rig, settle } from './helpers';

/** A machine standing at rest with its carriage at the given column. */
function at(column: number): Rig {
  const r = rig();
  r.tw.placeCarriage(column);
  r.tw.advance(0.05);
  return r;
}

/** Run until the machine is at rest (at most `limit` seconds), calling `each` after every half millisecond. */
function rest(r: Rig, each: () => void = () => {}, limit = 2): void {
  const t0 = r.tw.time;
  do { r.tw.advance(0.0005); each(); } while (!r.tw.idle && r.tw.time - t0 < limit);
  assert.ok(r.tw.idle, 'the machine comes to rest');
}

test('a burst typed all at once is printed in order with no letter lost', () => {
  const r = rig();
  const text = 'the quick brown fox jumps over the lazy dog';
  queueText(r, text);
  const seconds = settle(r);
  assert.equal(r.typist.pending, 0);
  assert.equal(page(r.tw.marks)[0].trimStart(), text);
  const printed = r.tw.marks.map((m) => m.ch).join('');
  assert.equal(printed, text.replace(/ /g, ''), 'impacts happen in typing order');
  const rate = text.length / seconds;
  assert.ok(rate > 8 && rate < 20, `sustained rate is that of a fast typist (${rate.toFixed(1)} strokes/s)`);
  for (const m of r.tw.marks) {
    assert.ok(Math.abs(col(m) - Math.round(col(m))) < 0.03, `"${m.ch}" is registered on the column grid (${col(m).toFixed(3)})`);
    assert.ok(Math.abs(line(m)) < 0.02);
    assert.ok(m.ink > 0.9);
  }
});

test('the same key struck repeatedly prints every time', () => {
  const r = rig();
  queueText(r, 'aaaaaaaa');
  settle(r);
  assert.equal(page(r.tw.marks)[0].trim(), 'aaaaaaaa');
  assert.equal(count(r.tw, 'impact'), 8);
});

test('capitals and symbols use Shift, which is only moved between strikes', () => {
  const r = rig();
  queueText(r, 'Hello, World! 100% OK?');
  settle(r);
  assert.equal(page(r.tw.marks)[0].trimStart(), 'Hello, World! 100% OK?');
  assert.equal(r.tw.marks.length, 'Hello,World!100%OK?'.length, 'no ghost impressions from a half-shifted platen');
  for (const m of r.tw.marks) assert.ok(Math.abs(line(m)) < 0.03, `"${m.ch}" sits on the writing line (${line(m).toFixed(3)})`);
  assert.ok(r.tw.core.cradle.q < 1e-5, 'the platen is back down at the end');
});

test('space bar and backspace move the carriage one tooth each way without printing', () => {
  const r = rig();
  queueText(r, 'ab');
  settle(r);
  assert.ok(Math.abs(r.tw.column - 12) < 1e-3);
  queueText(r, '\b');
  settle(r);
  assert.ok(Math.abs(r.tw.column - 11) < 1e-3, `backspace steps back one column (${r.tw.column})`);
  queueText(r, '   ');
  settle(r);
  assert.ok(Math.abs(r.tw.column - 14) < 1e-3, `three spaces (${r.tw.column})`);
  queueText(r, '\b\bc');
  settle(r);
  assert.equal(r.tw.marks.length, 3);
  assert.ok(Math.abs(col(r.tw.marks[2]) - 12) < 0.03, 'the next letter lands where the carriage was backed to');
});

test('carriage return feeds exactly one line and comes home to the left margin', () => {
  const r = rig();
  queueText(r, 'first line\nsecond\n\nfourth');
  settle(r);
  assert.deepEqual(Array.from(page(r.tw.marks), (s) => (s ?? '').trimStart()), ['first line', 'second', '', 'fourth']);
  for (const m of r.tw.marks) {
    assert.ok(Math.abs(line(m) - Math.round(line(m))) < 0.04, `line registration (${line(m).toFixed(3)})`);
    assert.ok(Math.abs(col(m) - Math.round(col(m))) < 0.03);
  }
  const starts = [0, 9, 15].map((i) => Math.round(col(r.tw.marks[i])));
  assert.deepEqual(starts, [MARGIN.left, MARGIN.left, MARGIN.left], 'every line starts at the left margin');
  assert.equal(count(r.tw, 'returnDone'), 3);
});

test('returning the carriage is what winds the mainspring', () => {
  const r = rig();
  queueText(r, 'abcdefghijklmnopqrst');
  settle(r);
  const before = r.tw.springEnergy;
  assert.equal(r.tw.handWork, 0);
  queueText(r, '\n');
  settle(r);
  const stored = r.tw.springEnergy - before;
  const expected = SPEC.bandTension * 20 * CHAR_PITCH;
  assert.ok(Math.abs(stored - expected) < 0.06 * expected, `twenty columns wind in about ${(expected * 1e3).toFixed(0)} mJ (got ${(stored * 1e3).toFixed(0)})`);
  assert.ok(r.tw.handWork > stored, `the hand supplied it (${(r.tw.handWork * 1e3).toFixed(0)} mJ) plus losses`);
});

test('the bell rings once, eight columns before the end of the line; then the keys lock and a return frees them', () => {
  const r = rig();
  const width = MARGIN.right - MARGIN.left;
  queueText(r, 'x'.repeat(width + 12));
  settle(r);
  assert.equal(count(r.tw, 'bell'), 1, 'one ding');
  const bell = r.tw.events.find((e) => e.type === 'bell')!, release = r.tw.events.find((e) => e.type === 'bellRelease')!;
  assert.equal(r.tw.marks.filter((m) => m.t < bell.t).length, width - MARGIN.bellBefore, `it rings with exactly ${MARGIN.bellBefore} columns left`);
  assert.ok(release.t > r.tw.marks[width - MARGIN.bellBefore - 1].t && release.t < bell.t, 'the hammer is let go by the step that brings the carriage there');
  assert.equal(r.tw.marks.length, width, 'the line holds exactly its width');
  assert.ok(Math.abs(r.tw.column - MARGIN.right) < 1e-3);
  assert.equal(r.typist.pending, 12, 'the overflow waits, it is not thrown away');
  assert.ok(r.typist.lineLocked);
  assert.ok(r.tw.lineLockIn, 'the lock comb has slid under the key levers');
  assert.equal(count(r.tw, 'locked'), 12, 'each waiting key was pressed once and met the lock');
  queueText(r, '\n');
  settle(r);
  assert.equal(r.typist.pending, 0);
  assert.ok(!r.tw.lineLockIn && r.tw.core.lockBar.q < 1e-6, 'the comb springs back when the carriage leaves');
  const rows = page(r.tw.marks);
  assert.equal(rows[0].trim().length, width);
  assert.equal(rows[1].trim(), 'x'.repeat(12), 'the waiting letters print on the next line');
});

test('the machine comes to rest at every column of the line, including on the bell cam', () => {
  const r = at(MARGIN.right - MARGIN.bellBefore - 3);
  for (let i = 0; i < 6; i++) {
    queueText(r, 'm');
    const seconds = settle(r, 2);
    assert.ok(r.tw.idle, `at rest in column ${r.tw.column.toFixed(2)} (after ${seconds.toFixed(2)} s)`);
    assert.ok(seconds < 0.6, 'and promptly');
  }
  assert.equal(count(r.tw, 'bell'), 1);
  // Resting costs nothing there either: a long wait is skipped, not simulated.
  const steps = r.tw.sys.steps, t0 = performance.now();
  r.tw.advance(60);
  assert.equal(r.tw.sys.steps - steps, Math.round(60 / r.tw.sys.h));
  assert.ok(performance.now() - t0 < 50, 'a minute at rest takes no solver work');
});

test('the line lock is a stop in the machine, not a filter on the input: a locked key goes down a little and no further', () => {
  const r = at(MARGIN.right);
  const { tw } = r, c = tw.core, t = tw.byCode.get('KeyJ')!;
  assert.ok(tw.lineLockIn, 'with the carriage at the right margin the comb is in');
  let lever = 0, bar = 0;
  assert.ok(tw.keyDown('KeyJ', { force: 9 }), 'nothing refuses the finger');
  rest(r, () => { lever = Math.max(lever, t.lever.q); bar = Math.max(bar, t.bar.q); });
  assert.ok(lever > 0.95 * LOCK_ANGLE && lever < LOCK_ANGLE + 2e-4, `the lever stops on the tooth under it (${(lever / LOCK_ANGLE).toFixed(3)} of the lock angle)`);
  assert.ok(lever < 0.25 * t.geom.keyAngle, 'that is a small part of the key travel');
  assert.ok(bar < 0.3 * (Math.PI / 2 - UBAR_PICKUP), `the typebar barely leaves its rest (${((bar * 180) / Math.PI).toFixed(1)}°)`);
  assert.equal(tw.marks.length, 0, 'nothing is printed');
  assert.equal(count(tw, 'trip'), 0, 'the escapement is not touched');
  assert.ok(Math.abs(tw.column - MARGIN.right) < 1e-6);
  assert.deepEqual(tw.events.filter((e) => e.type === 'locked').map((e) => e.id), ['KeyJ']);

  // The space bar is stopped the same way, so the escapement cannot be let go with nowhere for the carriage to go.
  let space = 0;
  tw.keyDown('Space', { force: 6 });
  rest(r, () => { space = Math.max(space, c.space.q); });
  assert.ok(space < 0.13 * c.limits.spaceMax, `space bar travel ${((100 * space) / c.limits.spaceMax).toFixed(0)}%`);
  assert.equal(count(tw, 'trip'), 0);
  assert.equal(c.state.toothLoose - c.state.ratchet, MARGIN.right, 'the dog still holds the same tooth');

  // A guided finger asked to go all the way down pushes no harder than a finger can, and the lock holds.
  tw.keyDown('KeyJ', { servo: true });
  tw.servoDepth.set('KeyJ', 0.0155);
  tw.advance(0.4);
  const push = tw.fingers[0].padForce;
  assert.ok(push > 8 && push < 13, `once the key has met the lock, a slow finger leans on it with about 10 N (${push.toFixed(1)} N), not the hundreds its depth would imply`);
  assert.ok(t.lever.q < LOCK_ANGLE + 2e-4 && tw.marks.length === 0);
  tw.keyUp('KeyJ');
  rest(r);

  // Backspace is not locked: it takes the carriage off the margin, the comb lets go, and the key prints.
  queueText(r, '\bj');
  settle(r);
  assert.equal(tw.marks.length, 1);
  assert.ok(Math.abs(col(tw.marks[0]) - (MARGIN.right - 1)) < 0.03, 'the letter lands in the last column');
  assert.ok(tw.lineLockIn, 'and the line is locked again');
});

test('capitals waiting at a full line: Shift is let go, the machine rests, and they print after the return', () => {
  const r = at(MARGIN.right - 2);
  queueText(r, 'ABCD');
  const seconds = settle(r, 4);
  assert.ok(r.tw.idle && seconds < 2, `the machine comes to rest (${seconds.toFixed(2)} s) instead of sitting on Shift`);
  assert.equal(r.tw.fingers.length, 0);
  assert.ok(r.tw.core.cradle.q < 1e-5, 'the platen is back down');
  assert.equal(r.typist.pending, 2);
  assert.equal(count(r.tw, 'locked'), 2, 'C and D were each tried once');
  queueText(r, '\n');
  settle(r);
  assert.deepEqual(page(r.tw.marks).map((s) => s.trimStart()), ['AB', 'CD']);
  assert.ok(r.tw.idle && r.tw.core.cradle.q < 1e-5);
});

test('a key that is down in its slot holds the lock comb off until it comes up', () => {
  const r = at(MARGIN.right - 1);
  const { tw } = r, c = tw.core, held = tw.byCode.get('KeyJ')!;
  // One finger rests half-way down on J (not far enough to throw its typebar) while another types the last letter.
  // (Lowered gently: a key jabbed down this far would throw its typebar at the paper by momentum alone.)
  tw.keyDown('KeyJ', { servo: true });
  for (let i = 1; i <= 140; i++) { tw.servoDepth.set('KeyJ', i * 0.00005); tw.advance(0.005); }
  assert.ok(held.lever.q > 2 * LOCK_ANGLE && held.bar.q < 1, 'J is down past the lock height, its typebar still far from the paper');
  assert.equal(tw.marks.length, 0);
  tw.keyDown('KeyA');
  tw.advance(0.4);
  assert.equal(tw.marks.length, 1);
  assert.ok(Math.abs(tw.column - MARGIN.right) < 1e-3, 'the carriage still completes its step: the comb is pushed through a spring');
  assert.ok(c.lockBlock.active, 'the comb is standing against the side of the J lever');
  assert.ok(c.lockBar.q > 0.8 * LOCK_ENGAGE && !tw.lineLockIn, `it stopped short of sliding under (${(c.lockBar.q * 1e3).toFixed(2)} mm)`);
  tw.keyUp('KeyJ');
  rest(r);
  assert.ok(tw.lineLockIn, 'when J comes up the comb goes in');
  assert.ok(c.lockBar.q > LOCK_ENGAGE + 0.0012, 'far enough for its teeth to cover the full thickness of the levers');
  assert.equal(tw.marks.length, 1, 'J itself never printed');
});

test('backspace moves the carriage exactly one column wherever it stands and however firmly it is pressed', () => {
  for (const start of [MARGIN.left + 1, 40, MARGIN.right - 1, MARGIN.right]) {
    for (const force of [3.5, 4.5, 7, 10]) {
      for (const hold of [false, true]) {
        const r = at(start);
        r.tw.keyDown('Backspace', { force, hold });
        if (hold) { r.tw.advance(0.25); r.tw.keyUp('Backspace'); }
        rest(r);
        assert.ok(Math.abs(r.tw.column - (start - 1)) < 1e-3, `from column ${start} with ${force} N${hold ? ', held' : ''}: now at ${r.tw.column.toFixed(3)}`);
        assert.ok(r.tw.core.backspace.q < 1e-3, 'the key comes back up');
      }
    }
  }
  // Too feeble a press does not carry the carriage a whole tooth against the mainspring, and nothing moves for good.
  const r = at(40);
  r.tw.keyDown('Backspace', { force: 2 });
  rest(r);
  assert.ok(Math.abs(r.tw.column - 40) < 1e-3);
});

test('auto return starts a new line by itself when the line is full', () => {
  const r = rig();
  r.typist.autoReturn = true;
  const width = MARGIN.right - MARGIN.left;
  queueText(r, 'y'.repeat(width + 5));
  settle(r);
  const rows = page(r.tw.marks);
  assert.equal(rows[0].trim().length, width);
  assert.equal(rows[1].trim(), 'yyyyy');
});

test('striking a key and holding it down "follows through": the type rebounds, returns, and stays on the paper', () => {
  const r = rig();
  // A firm, sustained press (about 600 gram-force) instead of the staccato tap typists are taught.
  r.tw.keyDown('KeyK', { hold: true, force: 6 });
  r.tw.advance(0.7);
  const t = r.tw.byCode.get('KeyK')!;
  assert.ok(t.hit[0].active, 'the type face ends up pressed against the platen');
  assert.ok(r.tw.core.state.fixedIn, 'and the escapement is held tripped');
  const dark = r.tw.marks.filter((m) => m.ink > 0.5);
  assert.ok(dark.length >= 2, 'the rebound prints a shadow: the reason for a staccato touch');
  assert.ok(dark[1].t - dark[0].t > 0.02, 'the shadow is a separate, later blow');
  r.tw.keyUp('KeyK');
  r.tw.advance(0.5);
  assert.ok(r.tw.idle);
  assert.ok(Math.abs(r.tw.column - Math.round(r.tw.column)) < 1e-3 && r.tw.column > MARGIN.left + 0.5, 'the carriage comes to rest on a whole letter space');
});

test('placing the carriage gives the same state as spacing there', () => {
  const a = rig(), b = rig();
  queueText(a, '      ');
  settle(a);
  b.tw.placeCarriage(MARGIN.left + 6);
  b.tw.advance(0.1);
  assert.ok(Math.abs(a.tw.column - b.tw.column) < 1e-4, `${a.tw.column} vs ${b.tw.column}`);
  queueText(a, 'q\n');
  queueText(b, 'q\n');
  settle(a); settle(b);
  assert.ok(Math.abs(col(a.tw.marks[0]) - col(b.tw.marks[0])) < 1e-3, 'the next letter lands on the same column');
  assert.ok(Math.abs(a.tw.column - b.tw.column) < 1e-3 && Math.abs(b.tw.column - MARGIN.left) < 1e-3, 'and both return to the margin');
});

test('after the machine is restored mid-capital, a reset typist starts clean', () => {
  const r = rig();
  const fresh = r.tw.snapshot();
  queueText(r, 'H');
  // Run until Shift is physically held and the capital is on its way.
  while (r.tw.marks.length === 0 && r.tw.time < 2) r.tw.advance(0.001);
  assert.equal(r.tw.marks[0].ch, 'H');
  assert.ok(r.tw.core.cradle.q > 0.006, 'the platen is still raised: the typist is holding Shift');
  // The tour does exactly this when a step is run again: the held finger no longer exists afterwards.
  r.tw.restore(fresh);
  r.typist.reset();
  queueText(r, 'Hi');
  const seconds = settle(r, 5);
  assert.equal(page(r.tw.marks)[0].trimStart(), 'Hi', 'it presses Shift again instead of waiting for a finger that is gone');
  assert.ok(seconds < 1.5, `and does not stall (${seconds.toFixed(2)} s)`);
  assert.ok(r.tw.core.cradle.q < 1e-5 && r.tw.idle, 'Shift is released at the end');
});

test('touch is visible on the page: light, normal and heavy strikes give distinct darkness', () => {
  const inks = [1.3, 3.2, 5].map((force) => {
    const r = rig();
    r.typist.unevenness = 0;
    r.tw.touch = force;
    queueText(r, 'nnn');
    settle(r);
    assert.equal(r.tw.marks.length, 3);
    return r.tw.marks.reduce((s, m) => s + m.ink, 0) / 3;
  });
  assert.ok(inks[0] > 0.2 && inks[0] < 0.75, `a light touch prints grey (${inks[0].toFixed(2)})`);
  assert.ok(inks[1] > 0.93, `the normal touch prints black (${inks[1].toFixed(2)})`);
  assert.ok(inks[2] >= inks[1] && inks[1] - inks[0] > 0.25, 'and the difference between light and normal is plain to see');
});

test('a capital typed at any moment after another one is printed, including while Shift is lifting', () => {
  // Found by review: a capital enqueued in the ~14 ms while the Shift finger was lifting used to stall the queue.
  for (let ms = 96; ms <= 140; ms += 2) {
    const r = rig();
    queueText(r, 'A');
    r.tw.advance(ms / 1000);
    queueText(r, 'Bc');
    const seconds = settle(r, 3);
    assert.equal(r.typist.pending, 0, `second capital enqueued at ${ms} ms is taken (stalled after ${seconds.toFixed(2)} s)`);
    assert.equal(page(r.tw.marks)[0].trimStart(), 'ABc', `at ${ms} ms`);
  }
});

test('input arriving at random moments is never dropped, reordered or stalled', () => {
  const alphabet = 'aA bB.c,D eE\b';
  let seed = 20261111;
  const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
  for (let trial = 0; trial < 14; trial++) {
    const r = rig();
    let text = '';
    for (let i = 0; i < 9; i++) {
      let ch = alphabet[Math.floor(rnd() * alphabet.length)];
      // Keep the expected page simple: no backspace at the margin, no leading spaces, no double spaces.
      if (ch === '\b' && (text.length === 0 || text.endsWith('\b') || text.endsWith(' '))) ch = 'x';
      if (ch === ' ' && (text.length === 0 || text.endsWith(' ') || text.endsWith('\b'))) ch = 'y';
      text += ch;
      queueText(r, ch);
      // Gaps from "all at once" to slower than the machine, concentrated around its own time scales.
      r.tw.advance(rnd() < 0.3 ? 0 : rnd() * 0.16);
    }
    const seconds = settle(r, 6);
    assert.equal(r.typist.pending, 0, `trial ${trial} ${JSON.stringify(text)}: queue drained (after ${seconds.toFixed(2)} s)`);
    assert.ok(r.tw.idle, `trial ${trial}: machine at rest`);
    // What a typewriter leaves on the page: backspace steps back, and the next character overstrikes.
    const cells: string[] = [];
    let colNo = 0;
    for (const ch of text) {
      if (ch === '\b') colNo = Math.max(0, colNo - 1);
      else { if (ch !== ' ') cells[colNo] = ch; colNo++; }
    }
    const expected = Array.from(cells, (c) => c ?? ' ').join('');
    assert.equal(page(r.tw.marks)[0] === undefined ? '' : page(r.tw.marks)[0].slice(MARGIN.left), expected, `trial ${trial} ${JSON.stringify(text)}`);
  }
});
