import test from 'node:test';
import assert from 'node:assert/strict';
import { ReducedEnergy, type EnergyContribution } from '../src/mechanism/reduced-energy';

test('exact-state reuse preserves all energy outputs across copied, mutated and reordered coordinates', () => {
  const term: EnergyContribution = { id: 'coupled', coordinates: [2, 0], mass: ([a, b]) => [[2 + a * a, .2], [.2, 3 + b * b]],
    massDerivatives: ([a, b]) => [[[2 * a, 0], [0, 0]], [[0, 0], [0, 2 * b]]],
    potential: ([a, b]) => a * b + a * a, potentialGradient: ([a, b]) => [b + 2 * a, a] };
  const cached = new ReducedEnergy([term], { scales: [1, 1, 1] }), fresh = new ReducedEnergy([term], { scales: [1, 1, 1], cacheEntries: 0 });
  const q = [.2, 0, .3], v = [.4, 0, -.7];
  for (const values of [[.2, 0, .3], [.2, 1, .3], [.21, 1, -.4], [.2, 0, .3]]) {
    q.splice(0, q.length, ...values);
    assert.deepEqual(cached.mass(q), fresh.mass(q));
    assert.deepEqual(cached.potentialGradient([...q]), fresh.potentialGradient(q));
    assert.deepEqual(cached.inertialForce(q, v), fresh.inertialForce(q, v));
    assert.deepEqual(cached.massDerivatives([...q]), fresh.massDerivatives(q));
    assert.equal(cached.potential(q), fresh.potential(q));
    cached.mass(q)[0][0] = 999; cached.potentialGradient(q)[0] = 999;
    assert.deepEqual(cached.mass(q), fresh.mass(q)); assert.deepEqual(cached.potentialGradient(q), fresh.potentialGradient(q));
  }
});

test('cache clearing, disabled caches and failed contributions cannot retain a partial state', () => {
  let parameter = 2, calls = 0;
  const term: EnergyContribution = { id: 'spring', coordinates: [0], mass: () => { calls++; return [[1]]; }, massDerivatives: () => [[[0]]],
    potential: ([q]) => { if (q < 0) throw new Error('outside spring domain'); return parameter * q * q / 2; }, potentialGradient: ([q]) => [parameter * q] };
  const cached = new ReducedEnergy([term], { scales: [1] });
  assert.equal(cached.potential([1]), 1);
  for (let i = 0; i < 2; i++) {
    assert.throws(() => cached.mass([-1]), /outside spring domain/);
    assert.equal(cached.potential([1]), 1); assert.deepEqual(cached.potentialGradient([1]), [2]);
  }
  parameter = 3; cached.clearCache(); assert.equal(cached.potential([1]), 1.5); assert.deepEqual(cached.potentialGradient([1]), [3]);
  const uncached = new ReducedEnergy([term], { scales: [1], cacheEntries: 0 });
  const before = calls; uncached.mass([1]); uncached.potential([1]); assert.equal(calls - before, 2);
  const snapshot = calls; assert.throws(() => cached.mass([NaN]), /Invalid energy coordinates/); assert.equal(calls, snapshot);
});

test('missing coordinates and velocities reject consistently before any cache lookup or callback', () => {
  let calls = 0;
  const term: EnergyContribution = { id: 'dense-state', coordinates: [0, 1], mass: () => { calls++; return [[2, .1], [.1, 6]]; },
    massDerivatives: () => [[[0, 0], [0, 0]], [[0, 0], [0, 0]]], potential: ([a, b]) => a * a + b * b, potentialGradient: ([a, b]) => [2 * a, 2 * b] };
  for (const capacity of [0, 32]) for (const warmed of [false, true]) for (const missing of [0, 1]) {
    const energy = new ReducedEnergy([term], { scales: [1, 1], cacheEntries: capacity });
    if (warmed) energy.mass([1, 2]);
    const q = [1, 2]; delete q[missing]; const before = calls;
    for (const query of [() => energy.mass(q), () => energy.massDerivatives(q), () => energy.potential(q), () => energy.potentialGradient(q), () => energy.inertialForce(q, [0, 0])]) assert.throws(query, /Invalid energy coordinates/);
    const v = [0, 0]; delete v[missing]; assert.throws(() => energy.inertialForce([1, 2], v), /Invalid energy velocity/);
    assert.equal(calls, before);
    assert.deepEqual(energy.mass([1, 2]), [[2, .1], [.1, 6]]);
  }
});

test('sparse provider matrices, derivative tensors and gradients reject without poisoning the last valid state', () => {
  const faults = ['mass row', 'mass value', 'derivative matrix', 'derivative row', 'derivative value', 'gradient value'] as const;
  for (const fault of faults) for (const capacity of [0, 1, 32]) for (const warmed of [false, true]) {
    const term: EnergyContribution = {
      id: 'provider-validation', coordinates: [0, 1],
      mass: ([q]) => {
        const m = [[2, .1], [.1, 3]];
        if (q < 0 && fault === 'mass row') delete m[0];
        if (q < 0 && fault === 'mass value') delete m[0][1];
        return m;
      },
      massDerivatives: ([q]) => {
        const d = [[[0, 0], [0, 0]], [[0, 0], [0, 0]]];
        if (q < 0 && fault === 'derivative matrix') delete d[0];
        if (q < 0 && fault === 'derivative row') delete d[1][0];
        if (q < 0 && fault === 'derivative value') delete d[1][0][1];
        return d;
      },
      potential: ([a, b]) => a * a + b * b,
      potentialGradient: ([a, b]) => { const g = [2 * a, 2 * b]; if (a < 0 && fault === 'gradient value') delete g[0]; return g; },
    };
    const energy = new ReducedEnergy([term], { scales: [1, 1], cacheEntries: capacity });
    if (warmed) energy.mass([1, 2]);
    const queries = [() => energy.mass([-1, 2]), () => energy.massDerivatives([-1, 2]), () => energy.potential([-1, 2]),
      () => energy.potentialGradient([-1, 2]), () => energy.inertialForce([-1, 2], [1, 1])];
    for (const query of queries) {
      assert.throws(query, /Invalid (mass block|energy derivatives)/, `${fault}, capacity=${capacity}, warmed=${warmed}`);
      assert.deepEqual(energy.mass([1, 2]), [[2, .1], [.1, 3]]);
      assert.deepEqual(energy.potentialGradient([1, 2]), [2, 4]);
    }
  }
});
