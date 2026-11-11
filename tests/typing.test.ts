// Typing as a user experiences it: nothing typed is lost, characters land where a typewriter puts them,
// and the carriage, bell, margins and line feed behave like the real mechanism.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAR_PITCH, MARGIN } from '../src/sim/layout';
import { SPEC } from '../src/sim/mechanism';
import { col, count, line, page, queueText, rig, settle } from './helpers';

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

test('the bell rings once near the end of the line, then the keys lock; a return frees them', () => {
  const r = rig();
  const width = MARGIN.right - MARGIN.left;
  queueText(r, 'x'.repeat(width + 12));
  settle(r);
  assert.equal(count(r.tw, 'bell'), 1, 'one ding');
  const bell = r.tw.events.find((e) => e.type === 'bell')!;
  const atBell = r.tw.marks.filter((m) => m.t < bell.t).length;
  assert.ok(Math.abs(atBell - (width - MARGIN.bellBefore)) <= 1, `rings ${MARGIN.bellBefore} columns before the margin (after ${atBell} letters)`);
  assert.equal(r.tw.marks.length, width, 'the line holds exactly its width');
  assert.equal(r.typist.pending, 12, 'the overflow waits, it is not thrown away');
  assert.ok(r.typist.lineLocked);
  assert.equal(r.tw.keyDown('KeyX'), null, 'the line lock refuses the key itself');
  queueText(r, '\n');
  settle(r);
  assert.equal(r.typist.pending, 0);
  const rows = page(r.tw.marks);
  assert.equal(rows[0].trim().length, width);
  assert.equal(rows[1].trim(), 'x'.repeat(12), 'the waiting letters print on the next line');
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
