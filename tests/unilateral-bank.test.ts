import test from 'node:test';
import assert from 'node:assert/strict';
import { UnilateralSystem, type NormalContact, type UnilateralDefinition } from '../src/mechanism/unilateral';
import { monotoneQP } from '../src/mechanism/monotone-qp';
const zero = (n: number) => Array(n).fill(0);
const near = (a: number, b: number, tolerance = 1e-12) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const dot = (a: readonly number[], b: readonly number[]) => a.reduce((s, x, i) => s + x * b[i], 0);

test('51-coordinate simultaneous recapture conserves free momentum and supports 44 keys without attraction', () => {
  const n = 51, mass = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 + i * .03 : 0));
  for (const i of [0, ...Array.from({ length: 44 }, (_, j) => j + 7)]) mass[1][i] = mass[i][1] = -.002 * (i + 1);
  mass[1][1] = 10;
  const incoming = Array.from({ length: n }, (_, i) => i >= 7 ? -(i - 6) * 1e-5 : 0);
  // The free 0/1 block receives momentum from the stopping idle coordinates.
  // These two scalar equations are independent of the contact QP algorithm.
  const bar = mass[1].slice(7).reduce((s, b, i) => s + b * incoming[i + 7], 0) / (mass[1][1] - mass[0][1] ** 2 / mass[0][0]);
  const expected = zero(n); expected[1] = bar; expected[0] = -mass[0][1] / mass[0][0] * bar;
  const normals = Array.from({ length: 44 }, (_, i) => Array.from({ length: n }, (_, j) => j === i + 7 ? .1 : 0));
  for (const duplicate of [false, true]) {
    const rows = duplicate ? [...normals, ...normals.slice(0, 10)] : normals;
    const contacts: NormalContact[] = rows.map((j, i) => ({ id: `rest-${String(i).padStart(2, '0')}`, gap: q => dot(j, q), gradient: () => j, timeDerivative: () => 0, accelerationBias: () => 0 }));
    const system = new UnilateralSystem({ mass: () => mass, inertialForce: () => zero(n), potential: q => q.slice(7).reduce((s, x) => s + x, 0),
      potentialGradient: () => Array.from({ length: n }, (_, i) => i >= 7 ? 1 : 0), contacts }, { q: zero(n), v: incoming }, { maxStep: 1e-7 });
    const step = system.advanceTo(1e-7, zero(n), []);
    assert.equal(step.events.length, 1);
    step.events[0].after.forEach((v, i) => near(v, expected[i], 1e-15));
    const impulses = step.events[0].contacts;
    assert.ok(impulses.every(c => c.impulse >= 0));
    const momentum = mass.map(row => dot(row, step.events[0].after.map((v, i) => v - incoming[i])));
    momentum.forEach((p, i) => near(p, rows.reduce((s, row, j) => s + row[i] * impulses[j].impulse, 0), 1e-15));
    assert.ok(step.contacts.every(c => c.reaction >= 0));
    system.v.slice(7).forEach(v => near(v, 0, 1e-15));
    near(system.account.residual, 0, 1e-16);
  }
});

test('dependent opposing normals produce a certificate instead of a regularized fictitious response', () => {
  const result = monotoneQP([[1, -1], [-1, 1]], [-1, -1], 1);
  assert.equal(result.status, 'infeasible');
  if (result.status === 'infeasible') {
    assert.ok(result.certificate.every(x => x >= 0));
    near(result.certificate[0] - result.certificate[1], 0);
    assert.ok(result.descent < 0);
  }
});

test('analytic sparse inertia works inside protected domains and invalid providers fail without accepting state', () => {
  let calls = 0;
  const model: UnilateralDefinition = { mass: () => [[1]], inertialForce: q => { assert.ok(q[0] > 0); calls++; return [0]; },
    potential: () => 0, potentialGradient: () => [0], contacts: [] };
  const guards = [{ id: 'retire', value: (q: readonly number[]) => q[0] - 1e-6, smoothDomain: (q: readonly number[]) => q[0] > 0 }];
  const system = new UnilateralSystem(model, { q: [1], v: [-1] }, { maxStep: .2 });
  const result = system.advanceTo(1, (_q, _v, t) => { assert.ok(t <= 1); return [0]; }, guards);
  assert.ok(calls > 0); assert.deepEqual(result.boundary?.ids, ['retire']); near(system.time, .999999, 1e-13);
  for (const value of [[], [NaN], [Infinity], [0, 0]]) {
    const bad = new UnilateralSystem({ ...model, inertialForce: () => value }, { q: [1], v: [-1] });
    const before = JSON.stringify({ q: bad.q, v: bad.v, time: bad.time, account: bad.account });
    assert.throws(() => bad.advanceTo(1, [0], guards), /inertial force/);
    assert.equal(JSON.stringify({ q: bad.q, v: bad.v, time: bad.time, account: bad.account }), before);
  }
});
