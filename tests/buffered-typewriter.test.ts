import assert from 'node:assert/strict';
import test from 'node:test';
import { BufferedTypewriter } from '../src/buffered-typewriter';
import { COLUMNS, type Impression } from '../src/contracts';

function rig() {
  const machine = new BufferedTypewriter();
  const impressions: Impression[] = [];
  machine.onEvent = event => { if (event.type === 'impression') impressions.push(event.impression); };
  const tap = (key: string) => { machine.press(key); machine.release(key); };
  const advance = (seconds: number, hz = 120) => {
    for (let i = 0; i < Math.ceil(seconds * hz); i++) machine.step(1 / hz);
  };
  const drain = (dt = 1 / 120) => {
    for (let i = 0; i < 30000 && (machine.pendingCount || machine.busy); i++) machine.step(dt);
    assert.equal(machine.pendingCount, 0, 'every queued key must be consumed');
    assert.equal(machine.busy, false, 'mechanism must return to rest');
  };
  return { machine, impressions, tap, advance, drain };
}

test('zero-delay bursts and repeated letters print exactly once without jams', () => {
  const { machine, impressions, tap, drain } = rig();
  const input = 'Fast typing keeps every letter, even aaaa and ssss!';
  for (const key of input) tap(key);
  assert.ok(machine.pendingCount > 0);
  assert.equal(impressions.length, 0, 'input is retained before physical contact');
  drain();
  assert.equal(impressions.map(i => i.char).join(''), input.replaceAll(' ', ''));
  assert.deepEqual(impressions.map(i => i.column), [...input].flatMap((char, index) => char === ' ' ? [] : [index]));
  assert.equal(machine.state.column, input.length);
  assert.equal(machine.state.jammed, false);
});

test('overlapping held keys are retained but operating-system repeat is not duplicated', () => {
  const { machine, impressions, advance, drain } = rig();
  machine.press('a'); machine.press('s'); machine.press('a'); machine.press('s');
  advance(.01);
  machine.release('a'); machine.release('s');
  machine.press('a'); machine.release('a');
  drain();
  assert.equal(impressions.map(i => i.char).join(''), 'asa');
});

test('spaces, returns, backspaces and reverse feeds retain their order during bursts', () => {
  const { machine, impressions, tap, drain } = rig();
  for (const key of ['a', 'b', 'Backspace', 'X', ' ', 'c', 'Enter', 'D', 'ArrowUp', 'Backspace', 'Z']) tap(key);
  drain();
  assert.deepEqual(impressions.map(i => [i.char, i.column, i.line]), [
    ['a', 0, 0], ['b', 1, 0], ['X', 1, 0], ['c', 3, 0], ['D', 0, 1], ['Z', 0, 0],
  ]);
  assert.equal(machine.state.column, 1);
  assert.ok(Object.isFrozen(impressions[0]), 'overtyping retains immutable earlier impressions');
});

test('queued strokes capture case, punctuation, ribbon and force before later settings change', () => {
  const { machine, impressions, tap, drain } = rig();
  tap('x');
  machine.setShift(true);
  machine.options.ribbon = 'red';
  machine.options.force = .55;
  tap('a'); tap('1');
  machine.setShift(false);
  machine.options.ribbon = 'black';
  machine.options.force = 1.4;
  tap('a');
  drain();
  assert.equal(impressions.map(i => i.char).join(''), 'xA!a');
  assert.deepEqual(impressions.map(i => i.ribbon), ['black', 'red', 'red', 'black']);
  assert.ok(impressions[3].energy > impressions[1].energy);
  assert.equal(machine.options.ribbon, 'black');
  assert.equal(machine.options.force, 1.4);
});

test('typing during a full carriage return is retained on the next line', () => {
  const { machine, impressions, tap, drain } = rig();
  machine.restorePosition(COLUMNS, 3);
  machine.options.lineSpacing = 2;
  tap('Enter');
  machine.options.lineSpacing = 1;
  for (const key of 'After return') tap(key);
  drain();
  assert.equal(impressions.map(i => i.char).join(''), 'Afterreturn');
  assert.ok(impressions.every(i => i.line === 5));
});

test('a margin holds overflow until manual return without dropping or automatically wrapping', () => {
  const { machine, impressions, tap, advance, drain } = rig();
  machine.restorePosition(COLUMNS - 2, 0);
  for (const key of 'abcd') tap(key);
  advance(1);
  assert.equal(impressions.map(i => i.char).join(''), 'ab');
  assert.equal(machine.pendingCount, 2);
  assert.equal(machine.waitingAtMargin, true);
  assert.equal(machine.state.line, 0);
  tap('Enter');
  tap('e');
  drain();
  assert.deepEqual(impressions.map(i => [i.char, i.column, i.line]), [
    ['a', 64, 0], ['b', 65, 0], ['c', 0, 1], ['d', 1, 1], ['e', 2, 1],
  ]);
});

test('an Enter already behind overflow in a burst can unblock the queue', () => {
  const { machine, impressions, tap, drain } = rig();
  machine.restorePosition(COLUMNS - 1, 0);
  for (const key of ['a', 'b', 'c', 'Enter', 'd']) tap(key);
  drain();
  assert.equal(impressions.map(i => i.char).join(''), 'abcd');
  assert.deepEqual(impressions.map(i => i.line), [0, 1, 1, 1]);
});

test('backspace at a blocked margin permits overstriking without removing existing ink', () => {
  const { machine, impressions, tap, advance, drain } = rig();
  machine.restorePosition(COLUMNS - 1, 0);
  tap('a'); tap('b'); advance(.5); tap('Backspace'); drain();
  assert.deepEqual(impressions.map(i => [i.char, i.column]), [['a', 65], ['b', 65]]);
});

test('loading a fresh sheet at the margin retains still-unprinted keys', () => {
  const { machine, impressions, tap, advance, drain } = rig();
  machine.restorePosition(COLUMNS - 1, 0);
  tap('a'); tap('b'); tap('c'); advance(.5);
  assert.equal(machine.waitingAtMargin, true);
  machine.newSheet(); drain();
  assert.deepEqual(impressions.map(i => [i.char, i.column, i.line]), [['a', 65, 0], ['b', 0, 0], ['c', 1, 0]]);
});

test('quarter-speed and uneven rendering retain the same complete ordered impressions', () => {
  const normal = rig(), slow = rig();
  for (const rig of [normal, slow]) for (const key of ['a', 'a', ' ', 'B', 'Enter', 'c', 'Tab', 'd']) rig.tap(key);
  normal.drain(1 / 60);
  slow.drain(.25 / 144);
  assert.deepEqual(slow.impressions, normal.impressions);
  assert.equal(slow.machine.state.column, 9);
  assert.equal(slow.machine.state.line, 1);
});

test('releasing keys, Escape and unsupported characters do not erase queued input', () => {
  const { machine, impressions, tap, drain } = rig();
  for (const key of 'kept') tap(key);
  tap('Escape'); tap('é'); tap('Delete'); machine.setShift(false);
  assert.equal(machine.hasPendingInput, true);
  drain();
  assert.equal(impressions.map(i => i.char).join(''), 'kept');
  assert.equal(machine.hasPendingInput, false);
});
