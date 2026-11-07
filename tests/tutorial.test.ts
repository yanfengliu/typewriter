import assert from 'node:assert/strict';
import test from 'node:test';
import { LESSONS, tutorialFrame } from '../src/tutorial-model.ts';

test('every strike lesson transfers ink at contact before the escapement moves', () => {
  for (const focus of ['keys', 'typebars', 'ribbon', 'escapement', 'shift'] as const) {
    const contact = focus === 'shift' ? .66 : .46;
    const before = tutorialFrame(focus, contact - .001);
    assert.equal(before.ink, '');
    assert.equal(before.state.carriage, 32);
    const hit = tutorialFrame(focus, contact);
    assert.equal(hit.state.bars.find(bar => bar.key === 'a')!.angle, 1);
    assert.equal(hit.state.ribbonLift, 1);
    assert.equal(hit.ink, focus === 'shift' ? 'A' : 'a');
    assert.equal(hit.state.carriage, 32);
    const settled = tutorialFrame(focus, 1);
    assert.equal(settled.state.carriage, 33);
    assert.equal(settled.state.ribbonLift, 0);
    assert.equal(settled.state.bars.find(bar => bar.key === 'a')!.angle, 0);
    assert.equal(settled.ink, hit.ink);
  }
});

test('basket shift happens before its uppercase strike and return advances one line', () => {
  const shifted = tutorialFrame('shift', .35);
  assert.equal(shifted.state.shift, 1);
  assert.equal(shifted.ink, '');
  const start = tutorialFrame('return', 0);
  const end = tutorialFrame('return', 1);
  assert.equal(start.state.carriage, 42);
  assert.equal(end.state.carriage, 0);
  assert.equal(end.state.feed, 1);
  assert.equal(end.state.line, 1);
  assert.equal(end.ink, start.ink);
});

test('scrubbing is deterministic, bounded, and cannot share mutable poses', () => {
  for (const { focus } of LESSONS) {
    assert.deepEqual(tutorialFrame(focus, -5), tutorialFrame(focus, 0));
    assert.deepEqual(tutorialFrame(focus, 8), tutorialFrame(focus, 1));
    assert.deepEqual(tutorialFrame(focus, NaN), tutorialFrame(focus, 0));
    const first = tutorialFrame(focus, .5);
    const expected = tutorialFrame(focus, .5);
    first.state.bars[0].angle = 999;
    first.state.carriage = 999;
    assert.deepEqual(tutorialFrame(focus, .5), expected);
    assert.equal(tutorialFrame(focus, .5, true).explosion, 1);
  }
  assert.equal(tutorialFrame('overview', 0).explosion, 0);
  assert.equal(tutorialFrame('overview', 1).explosion, 1);
  assert.equal(tutorialFrame('overview', 1).ink, '');
});
