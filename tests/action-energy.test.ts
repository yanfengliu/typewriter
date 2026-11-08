import assert from 'node:assert/strict';
import test from 'node:test';
import { ConstrainedAction, KineticMetric } from '../src/mechanism/dynamics';
import { closeLink, distance, hingePoint, rotate, type Vec3 } from '../src/mechanism/math';

test('a rod closure preserves length and reports an unreachable assembly instead of stretching it', () => {
  const pivot: Vec3 = [0, .04, -.03], axis: Vec3 = [1, 0, 0], arm: Vec3 = [0, .012, .008];
  const point: Vec3 = [0, -.01, .02];
  const length = distance(point, hingePoint(pivot, axis, arm, .6));
  const result = closeLink(point, { pivot, axis }, arm, length, .5);
  assert.ok(result.reachable);
  assert.ok(Math.abs(result.angle - .6) < 1e-12);
  assert.ok(result.error < 1e-12);
  assert.equal(closeLink([0, 1, 0], { pivot, axis }, arm, length, .5).reachable, false);
});

test('hinge rotation retains every rigid pairwise distance in a canted action plane', () => {
  const axis: Vec3 = [Math.cos(.7), 0, Math.sin(.7)];
  const a: Vec3 = [.01, .03, .05], b: Vec3 = [-.02, .07, .01];
  for (let angle = -2.7; angle <= .1; angle += .007) {
    assert.ok(Math.abs(distance(rotate(a, axis, angle), rotate(b, axis, angle)) - distance(a, b)) < 1e-13);
  }
});

test('passive oscillator energy is conserved, and trajectory error converges toward the analytic solution', () => {
  const mass = .002, stiffness = 2, q0 = .02, duration = .04;
  function run(dt: number) {
    const metric = new KineticMetric({ mass: () => mass, potential: q => .5 * stiffness * q * q, fingerTravel: q => .08 * Math.sin(q) }, -.1, .1);
    const action = new ConstrainedAction(metric, 0, q0);
    for (let i = 0; i < Math.round(duration / dt); i++) action.step(dt, 0);
    assert.ok(Math.abs(action.account.residual) < 1e-11, JSON.stringify(action.account));
    return Math.abs(action.q - q0 * Math.cos(Math.sqrt(stiffness / mass) * duration));
  }
  const coarse = run(1 / 250), medium = run(1 / 500), fine = run(1 / 1000);
  assert.ok(coarse / medium > 3.5);
  assert.ok(medium / fine > 3.5);
  assert.ok(fine < .000003);
});

test('variable effective inertia respects external finger work, gravity and dissipative return', () => {
  const metric = new KineticMetric({
    mass: q => .001 * (1 + 3 * Math.sin(4 * q) ** 2),
    potential: q => .8 * q * q + .002 * Math.sin(q),
    fingerTravel: q => .08 * Math.sin(q),
  }, 0, .15);
  const action = new ConstrainedAction(metric, 12);
  for (let i = 0; i < 30; i++) action.step(1 / 2400, 4);
  assert.ok(action.q > .01, 'work at the key must move the connected inertia');
  const releasedEnergy = action.totalEnergy;
  for (let i = 0; i < 720; i++) {
    action.step(1 / 2400, 0);
    assert.ok(action.totalEnergy <= releasedEnergy + 1e-9, 'passive mechanism gained energy');
    assert.ok(Math.abs(action.account.residual) < 1e-8, JSON.stringify(action.account));
  }
  assert.equal(action.q, 0);
  assert.equal(action.kinetic, 0);
  assert.ok(action.account.inputWork > 0);
  assert.ok(action.account.dampingLoss > 0);
  assert.ok(action.account.impactLoss > 0);
});

test('blocking a linkage changes its travel and dissipates the impact without work beyond the stop', () => {
  const metric = new KineticMetric({ mass: () => .001, potential: q => q * q, fingerTravel: q => .08 * q }, 0, .15);
  const action = new ConstrainedAction(metric, 0);
  let contact = false;
  for (let i = 0; i < 240 && !contact; i++) {
    const result = action.step(1 / 2400, 5, .04, .1);
    assert.ok(action.q <= .04 + 1e-12);
    contact = result.stopped;
  }
  assert.ok(contact);
  assert.ok(Math.abs(action.account.inputWork - 5 * .08 * .04) < 1e-10);
  assert.ok(action.account.impactLoss > .01);
  assert.ok(Math.abs(action.account.residual) < 1e-10);
});

test('an unpowered resting action cannot launch itself', () => {
  const metric = new KineticMetric({ mass: () => .001, potential: q => q * q + .01 * q, fingerTravel: q => .08 * q }, 0, .15);
  const action = new ConstrainedAction(metric);
  for (let i = 0; i < 240; i++) action.step(1 / 240, 0);
  assert.equal(action.q, 0);
  assert.equal(action.kinetic, 0);
  assert.equal(action.account.inputWork, 0);
  assert.ok(Math.abs(action.account.residual) < 1e-10);
});

test('a sustained passive force into a contact is balanced by a support reaction', () => {
  const metric = new KineticMetric({ mass: () => .001, potential: q => (q - .08) ** 2, fingerTravel: q => .08 * q }, 0, .15);
  const action = new ConstrainedAction(metric, 0, .04);
  for (let i = 0; i < 240; i++) action.step(1 / 240, 0, .04, 0);
  assert.equal(action.q, .04);
  assert.equal(action.kinetic, 0);
  assert.equal(action.account.residual, 0);
});

test('a swept stop is detected even if the free path turns back inside it before step end', () => {
  const metric = new KineticMetric({ mass: () => .001, potential: q => .064 * q, fingerTravel: q => .08 * q }, 0, .15);
  const action = new ConstrainedAction(metric, 0, .03995);
  action.setVelocity(.12);
  const result = action.step(1 / 240, 0, .04, 0);
  assert.ok(result.stopped);
  // Independent constant-acceleration calculation: .5 M v² - F Δq.
  const expectedLoss = .5 * .001 * .12 ** 2 - .064 * (.04 - .03995);
  assert.ok(Math.abs(action.account.impactLoss - expectedLoss) < 1e-12);
  assert.ok(action.q < .04);
  assert.ok(Math.abs(action.account.residual) < 1e-10);
});

test('reported kinetic energy uses the physical inertia between metric sample nodes', () => {
  const mass = (q: number) => .001 * (1 + 3 * Math.sin(4 * q) ** 2);
  const metric = new KineticMetric({ mass, potential: q => q * q, fingerTravel: q => .08 * q }, 0, .15, 32);
  const action = new ConstrainedAction(metric, 0, .0171234);
  action.setVelocity(3.721);
  for (let i = 0; i < 24; i++) {
    action.step(1 / 2400, 0);
    assert.ok(Math.abs(action.kinetic - .5 * mass(action.q) * action.velocity ** 2) < 1e-14);
    assert.ok(Math.abs(metric.coordinate(metric.distance(action.q)) - action.q) < 1e-11);
  }
});

test('free variable-mass motion follows its independent analytic solution', () => {
  for (const dt of [.01, .001, .0001]) {
    const mass = (q: number) => (1 + q) ** 2;
    const metric = new KineticMetric({ mass, potential: () => 0, fingerTravel: q => q }, 0, 1);
    const action = new ConstrainedAction(metric, 0, .001);
    action.setVelocity(1);
    for (let i = 0; i < Math.round(.1 / dt); i++) action.step(dt, 0);
    const exact = Math.sqrt(1.001 ** 2 + 2 * 1.001 * .1) - 1;
    assert.ok(Math.abs(action.q - exact) < 1e-11);
    assert.ok(Math.abs(.5 * mass(action.q) * action.velocity ** 2 - .5 * 1.001 ** 2) < 1e-11);
    assert.ok(Math.abs(action.account.residual) < 1e-11);
  }
});

test('a coaxial rod distinguishes a singular all-angle assembly from an impossible one', () => {
  const follower = { pivot: [0, 0, 0] as const, axis: [0, 0, 1] as const }, arm = [1, 0, 0] as const;
  const valid = closeLink([0, 0, 1], follower, arm, Math.SQRT2, .7);
  assert.equal(valid.reachable, true);
  assert.equal(valid.singular, true);
  assert.equal(valid.angle, .7);
  assert.equal(closeLink([0, 0, 1], follower, arm, 1, .7).reachable, false);
});

test('an incoming impact exactly at a step endpoint is resolved in that same step', () => {
  const metric = new KineticMetric({ mass: () => 1, potential: () => 0, fingerTravel: q => q }, 0, 1);
  const action = new ConstrainedAction(metric, 0);
  action.setVelocity(1);
  const result = action.step(1 / 240, 0, 1 / 240, 0);
  assert.equal(result.stopped, true);
  assert.equal(action.q, 1 / 240);
  assert.equal(action.velocity, 0);
  assert.ok(Math.abs(result.impactEnergy - .5) < 1e-12);
  const lower = new ConstrainedAction(metric, 0, 1 / 240);
  lower.setVelocity(-1);
  const lowerResult = lower.step(1 / 240, 0);
  assert.equal(lowerResult.stopped, true);
  assert.equal(lower.q, 0);
  assert.equal(lower.velocity, 0);
  assert.ok(Math.abs(lowerResult.impactEnergy - .5) < 1e-12);
});
