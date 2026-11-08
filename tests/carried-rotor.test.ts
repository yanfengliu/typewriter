import test from 'node:test';
import assert from 'node:assert/strict';
import { carriedRotorEnergy } from '../src/mechanism/carried-rotor';
import { ReducedEnergy } from '../src/mechanism/reduced-energy';
const near = (a: number, b: number, tolerance: number) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const m = .004, height = .023, depth = .003, h = [0, .018, -.002] as const, c = [0, -.012, .001] as const;
const body = carriedRotorEnergy({ id: 'carried-test-solid', coordinates: [0, 1], axis: [1, 0, 0], hingeOffset: h, centerOfMass: c,
  mass: m, comInertia: m * (height ** 2 + depth ** 2) / 12 });
// Two-point Gaussian quadrature in each box direction integrates its actual
// uniform solid inertia. Independent complex-plane positions supply velocities.
const nodes = [-1, 1].flatMap(y => [-1, 1].map(z => [c[1] + y * height / (2 * Math.sqrt(3)), c[2] + z * depth / (2 * Math.sqrt(3))]));
const position = (q: number[], point: number[]) => {
  const turn = (p: number[], angle: number) => [Math.cos(angle) * p[0] - Math.sin(angle) * p[1], Math.sin(angle) * p[0] + Math.cos(angle) * p[1]];
  const parent = turn([h[1], h[2]], -q[0]), child = turn(point, q[1] - q[0]);
  return parent.map((v, i) => v + child[i]);
};

test('carried-body mass includes hinge translation and matches independent solid quadrature', () => {
  for (let i = 0; i < 31; i++) {
    const q = [.6 * Math.sin(i + .1), .4 * Math.cos(i * 1.7)], velocity = [2 * Math.cos(i + .3), 3 * Math.sin(i * .7)];
    const dt = 1e-6;
    const kinetic = nodes.reduce((sum, point) => {
      const before = position(q.map((x, j) => x - dt * velocity[j]), point), after = position(q.map((x, j) => x + dt * velocity[j]), point);
      return sum + m / 8 * after.reduce((v, x, j) => v + ((x - before[j]) / (2 * dt)) ** 2, 0);
    }, 0);
    const mass = body.mass(q), assembled = velocity.reduce((sum, vi, j) => sum + .5 * vi * velocity.reduce((s, vk, k) => s + mass[j][k] * vk, 0), 0);
    near(assembled, kinetic, 1e-14);
    const potential = nodes.reduce((s, p) => s + m / 4 * 9.80665 * (position(q, p)[0] - position([0, 0], p)[0]), 0);
    near(body.potential(q), potential, 1e-17);
    assert.ok(mass[0][0] * mass[1][1] - mass[0][1] ** 2 > 0);
  }
});

test('carried-body derivative and kinetic-power identities retain relative-coordinate cross terms', () => {
  const energy = new ReducedEnergy([body], { scales: [.4, .2] }), q = [.31, -.12], velocity = [1.7, -.6];
  const dm = body.massDerivatives!(q), grad = body.potentialGradient!(q), step = 1e-6;
  for (let i = 0; i < 2; i++) {
    const low = q.map((x, j) => x - (i === j ? step : 0)), high = q.map((x, j) => x + (i === j ? step : 0));
    near(grad[i], (body.potential(high) - body.potential(low)) / (2 * step), 1e-13);
    const lo = body.mass(low), hi = body.mass(high);
    for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) near(dm[i][j][k], (hi[j][k] - lo[j][k]) / (2 * step), 1e-15);
  }
  const inertial = energy.inertialForce(q, velocity), power = velocity.reduce((s, v, i) => s + v * inertial[i], 0);
  const expected = .5 * velocity.reduce((s, vk, k) => s + vk * velocity.reduce((t, vi, i) => t + vi * velocity.reduce((u, vj, j) => u + dm[k][i][j] * vj, 0), 0), 0);
  near(power, expected, 1e-20);
  assert.notEqual(body.mass(q)[0][1], 0);
  assert.deepEqual(dm[0], [[0, 0], [0, 0]]);
});
