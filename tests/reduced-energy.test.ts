import test from 'node:test';
import assert from 'node:assert/strict';
import { ReducedEnergy, type EnergyContribution } from '../src/mechanism/reduced-energy';

const near = (actual: number, expected: number, epsilon = 1e-8) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);

test('moving pendulum on a carriage retains cross inertia and its Christoffel terms', () => {
  // x = carriage + L sin(theta), y = -L cos(theta): exact Cartesian energy.
  const m = .03, length = .07, carriage = 1.35, gravity = 9.80665;
  const energy = new ReducedEnergy([
    { id: 'carriage', coordinates: [0], mass: () => [[carriage]], potential: ([x]) => -4.8 * x + 2 * x * x },
    { id: 'pendulum', coordinates: [1, 0], mass: ([theta]) => [[m * length ** 2, m * length * Math.cos(theta)], [m * length * Math.cos(theta), m]], potential: ([theta]) => -m * gravity * length * Math.cos(theta) },
  ], { scales: [.01, 1] });
  const q = [.012, .43], v = [.08, 1.2], matrix = energy.mass(q), derivatives = energy.massDerivatives(q);
  near(matrix[0][0], carriage + m); near(matrix[1][1], m * length ** 2); near(matrix[0][1], m * length * Math.cos(q[1]));
  const cartesian = .5 * carriage * v[0] ** 2 + .5 * m * ((v[0] + length * Math.cos(q[1]) * v[1]) ** 2 + (length * Math.sin(q[1]) * v[1]) ** 2);
  near(.5 * v.reduce((sum, vi, i) => sum + vi * matrix[i].reduce((s, mij, j) => s + mij * v[j], 0), 0), cartesian, 1e-14);
  near(derivatives[1][0][1], -m * length * Math.sin(q[1]), 1e-10);
  const inertial = q.map((_, i) => v.reduce((sum, vj, j) => sum + v.reduce((s, vk, k) => s + (derivatives[k][i][j] - .5 * derivatives[i][j][k]) * vj * vk, 0), 0));
  near(inertial[0], -m * length * Math.sin(q[1]) * v[1] ** 2, 1e-10); near(inertial[1], 0, 1e-12);
  near(energy.potentialGradient(q)[0], -4.8 + 4 * q[0]); near(energy.potentialGradient(q)[1], m * gravity * length * Math.sin(q[1]), 1e-10);
});

test('idle dependent bodies remain in the metric and exact local caching avoids unrelated reevaluation', () => {
  let visits = 0;
  const energy = new ReducedEnergy([{ id: 'idle bank', coordinates: [2], mass: ([u]) => { visits++; return [[.01 + u * u]]; }, potential: ([u]) => .3 * u }], { scales: [1, 1, 1], cacheEntries: 2 });
  const a = energy.mass([0, 0, .2]); assert.equal(visits, 3); near(a[2][2], .05);
  a[2][2] = 900; // Returned storage must not corrupt cached physical values.
  near(energy.mass([7, 8, .2])[2][2], .05); assert.equal(visits, 3);
  near(energy.mass([7, 8, .3])[2][2], .1); assert.equal(visits, 6);
  energy.mass([0, 0, .4]); energy.mass([0, 0, .2]); assert.equal(visits, 12);
});

test('analytic contributions scatter into seven coordinates with no index or derivative transposition', () => {
  const term: EnergyContribution = { id: 'coupled', coordinates: [6, 2], mass: ([a, b]) => [[2 + a, b], [b, 4]], potential: ([a, b]) => a * b,
    massDerivatives: () => [[[1, 0], [0, 0]], [[0, 1], [1, 0]]], potentialGradient: ([a, b]) => [b, a] };
  const energy = new ReducedEnergy([term], { scales: Array(7).fill(1) }), q = [0, 0, .3, 0, 0, 0, .2];
  near(energy.mass(q)[6][2], .3); near(energy.massDerivatives(q)[2][6][2], 1); near(energy.massDerivatives(q)[6][6][6], 1);
  near(energy.massDerivatives(q)[6][2][6], 0); near(energy.potentialGradient(q)[6], .3); near(energy.potentialGradient(q)[2], .2);
});

test('rejects duplicate bodies, asymmetric blocks and nonfinite derivatives', () => {
  const base: EnergyContribution = { id: 'x', coordinates: [0, 1], mass: () => [[1, 0], [0, 1]], potential: () => 0 };
  assert.throws(() => new ReducedEnergy([base, base], { scales: [1, 1] }), /unique/);
  assert.throws(() => new ReducedEnergy([{ ...base, mass: () => [[1, 2], [0, 1]] }], { scales: [1, 1] }).mass([0, 0]), /Asymmetric/);
  assert.throws(() => new ReducedEnergy([{ ...base, potentialGradient: () => [NaN, 0] }], { scales: [1, 1] }).mass([0, 0]), /derivatives/);
});
