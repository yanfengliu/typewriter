import test from 'node:test';
import assert from 'node:assert/strict';
import { scalarCrossing } from '../src/mechanism/scalar-crossing';

test('continuous crossing retains the integrated upper sample and original bisection resolution', () => {
  for (const scale of [1e-12, 1e-7, 1, 1e6]) for (const fraction of [.000001, .13, .5, .983, .999999]) {
    const root = scale * fraction;
    for (const f of [(t: number) => root - t, (t: number) => (root - t) ** 3,
      (t: number) => Math.expm1((root - t) / scale), (t: number) => t < root ? (root - t) / scale : t < root + scale * .01 ? 0 : -.01]) {
      const result = scalarCrossing(0, scale, f(0), f(scale), { time: scale }, time => {
        assert.ok(time > 0 && time < scale); return { value: { time }, scalar: f(time) };
      });
      assert.ok(result.lower <= root && result.upper >= root);
      assert.ok(f(result.lower) > 0 && f(result.upper) <= 0);
      assert.equal(result.value.time, result.upper);
      const mid = result.lower + (result.upper - result.lower) / 2;
      assert.ok(result.upper - result.lower <= result.resolution || mid === result.lower || mid === result.upper);
    }
  }
});

test('crossing propagates oracle errors and never substitutes an invalid sample', () => {
  assert.throws(() => scalarCrossing(0, 1, 1, -1, 1, () => { throw new Error('Callback must propagate'); }), /Callback must propagate/);
  assert.throws(() => scalarCrossing(0, 1, 1, -1, 1, () => ({ value: 0, scalar: NaN })), /Nonfinite/);
  assert.throws(() => scalarCrossing(0, 1, 0, -1, 1, () => { throw new Error('must not call'); }), /Invalid continuous crossing bracket/);
});
