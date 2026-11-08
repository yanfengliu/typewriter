import test from 'node:test';
import assert from 'node:assert/strict';
import { UnilateralSystem, type NormalContact, type UnilateralDefinition } from '../src/mechanism/unilateral';
const near = (a: number, b: number, e = 1e-11) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
const floor = (height: number): NormalContact => ({ id: 'floor', gap: q => q[0] - height, gradient: () => [1], timeDerivative: () => 0, accelerationBias: () => 0 });
const definition = (contacts: NormalContact[] = []): UnilateralDefinition => ({ mass: () => [[2]], massDerivatives: () => [[[0]]], potential: () => 0, potentialGradient: () => [0], contacts });

test('feature boundaries stop before later impacts and continuation retains state and energy history', () => {
  const system = new UnilateralSystem(definition([floor(0)]), { q: [1], v: [-1] }, { maxStep: .4 });
  const first = system.advanceUntil(1.2, [0], [{ id: 'feature', value: q => q[0] - .5 }]);
  near(first.elapsed, .5); near(first.remaining, .7); near(system.q[0], .5); near(system.v[0], -1);
  assert.equal(first.events.length, 0); assert.deepEqual(first.boundary!.ids, ['feature']);
  const saved = { q: system.q, v: system.v, t: system.time, account: { ...system.account } };
  assert.equal(system.replaceContacts([floor(0)]), null);
  assert.deepEqual({ q: system.q, v: system.v, t: system.time, account: { ...system.account } }, saved);
  const later = system.step(first.remaining); assert.equal(later.events.length, 1); near(later.events[0].time, 1); near(system.time, 1.2);
  near(system.account.initial, 1); near(system.account.impactLoss, 1); near(system.account.residual, 0);
  assert.throws(() => system.replaceContacts([]), /explicit feature boundary/);
});

test('earlier collision and release events survive a later guard; duplicate-time guards are complete', () => {
  const system = new UnilateralSystem(definition([floor(0)]), { q: [.5], v: [-1] }, { maxStep: 1 });
  const result = system.advanceUntil(1, [0], [{ id: 'b', value: (_q, t) => .75 - t }, { id: 'a', value: (_q, t) => .75 - t }]);
  near(result.elapsed, .75); near(result.remaining, .25); assert.equal(result.events.length, 1); near(result.events[0].time, .5);
  assert.deepEqual(result.boundary!.ids, ['a', 'b']); near(system.v[0], 0); near(system.account.impactLoss, 1);
  const released = new UnilateralSystem(definition([floor(0)]), { q: [0], v: [0] }, { maxStep: .1 });
  const releaseStep = released.advanceUntil(.1, (_q, _v, t) => [2 * (t - .05)], [{ id: 'after-release', value: (_q, t) => .075 - t }]);
  assert.equal(releaseStep.releases.length, 1); near(releaseStep.releases[0].time, .05, 2e-8); near(releaseStep.elapsed, .075);
  assert.ok(released.q[0] > 0); assert.ok(released.v[0] > 0);
});

test('contact replacement accounts a newly closing face and rejects interpenetration atomically', () => {
  const system = new UnilateralSystem(definition(), { q: [1], v: [-3] }, { maxStep: .1 });
  const boundary = system.advanceUntil(.3, [0], [{ id: 'axial-entry', value: q => q[0] - .4 }]);
  near(boundary.elapsed, .2); near(system.v[0], -3); near(system.account.impactLoss, 0);
  const before = { q: system.q, v: system.v, t: system.time, account: { ...system.account } };
  assert.throws(() => system.replaceContacts([floor(.5)]), /penetrates/);
  assert.deepEqual({ q: system.q, v: system.v, t: system.time, account: { ...system.account } }, before);
  const hit = system.replaceContacts([floor(.4)])!;
  near(hit.time, .2); near(hit.elapsed, 0); near(hit.contacts[0].impulse, 6); near(hit.loss, 9); near(system.v[0], 0);
  near(system.account.initial, 9); near(system.account.impactLoss, 9); near(system.account.residual, 0);
  near(system.q[0], before.q[0]); near(system.time, before.t);
});

test('a non-force guard detects an interior excursion without applying a contact impulse', () => {
  const system = new UnilateralSystem(definition(), { q: [0], v: [2] }, { maxStep: 1 });
  const result = system.advanceUntil(1, [0], [{ id: 'finite-feature', value: (_q, t) => (t - .3) * (t - .6) }]);
  near(result.elapsed, .3); near(result.remaining, .7); near(system.q[0], .6); near(system.v[0], 2);
  assert.equal(result.events.length, 0); near(system.account.impactLoss, 0); near(system.account.residual, 0);
});

test('a guard expiring at collision time hands the unchanged incoming state to the new feature', () => {
  const system = new UnilateralSystem(definition([floor(0)]), { q: [0], v: [-1] });
  const before = { q: system.q, v: system.v, t: system.time, account: { ...system.account } };
  const result = system.advanceUntil(.1, [0], [{ id: 'old-face-exit', value: () => 0 }]);
  near(result.elapsed, 0); assert.equal(result.events.length, 0);
  assert.deepEqual({ q: system.q, v: system.v, t: system.time, account: { ...system.account } }, before);
  assert.equal(system.replaceContacts([]), null); near(system.v[0], -1);
  const simultaneous = new UnilateralSystem(definition([floor(0)]), { q: [1], v: [-1] }, { maxStep: .2 });
  const arrived = simultaneous.advanceUntil(1.1, [0], [{ id: 'old-face-exit', value: q => q[0] }]);
  near(arrived.elapsed, 1); near(simultaneous.v[0], -1); assert.equal(arrived.events.length, 0);
  const hit = simultaneous.replaceContacts([floor(0)])!; near(hit.contacts[0].impulse, 2); near(simultaneous.v[0], 0);
  for (const speed of [1, 2, .1]) for (const id of ['aaa-boundary', 'zzz-boundary']) {
    const atEnd = new UnilateralSystem(definition([floor(0)]), { q: [1], v: [-speed] }, { maxStep: .2 });
    const endpoint = atEnd.advanceUntil(1 / speed, [0], [{ id, value: q => q[0] }]);
    assert.ok(endpoint.boundary, `${id}, speed ${speed}: missed endpoint guard at q=${atEnd.q[0]}`);
    near(endpoint.elapsed, 1 / speed); near(atEnd.v[0], -speed); assert.equal(endpoint.events.length, 0);
    assert.equal(atEnd.replaceContacts([]), null);
  }
});

test('a positive tiny gap is not captured or sustained before its coincident feature boundary', () => {
  for (const accelerated of [false, true]) {
    const gap = accelerated ? 1e-10 : 5e-13, speed = accelerated ? 0 : -1, force = accelerated ? -2 : 0;
    const arrival = accelerated ? Math.sqrt(2 * gap) : gap;
    const system = new UnilateralSystem(definition([floor(0)]), { q: [gap], v: [speed] }, { maxStep: 1e-4 });
    const result = system.advanceUntil(2 * arrival, [force], [{ id: 'outgoing-floor', value: q => q[0] }]);
    assert.ok(result.boundary); assert.equal(result.events.length, 0); assert.deepEqual(result.supportImpulses, {});
    near(system.time, arrival, 1e-15); near(system.v[0], accelerated ? -arrival : speed, 1e-15);
    near(system.account.impactLoss, 0); near(system.account.inputWork, accelerated ? 2 * gap : 0, 1e-20);
    const before = { q: system.q, v: system.v, t: system.time, account: { ...system.account } };
    assert.equal(system.replaceContacts([]), null);
    assert.deepEqual({ q: system.q, v: system.v, t: system.time, account: { ...system.account } }, before);
  }
});

test('endpoint guard resolution is temporal, preserves the incoming state and never evaluates future force', () => {
  const end = .125, tau = 1e-12;
  const force = (_q: readonly number[], _v: readonly number[], time: number) => {
    assert.ok(time <= end, `force evaluated beyond requested time: ${time}`); return [-2];
  };
  const baseline = new UnilateralSystem(definition(), { q: [1], v: [-.25] }, { maxStep: .03125, eventTimeTolerance: tau });
  baseline.step(end, force);
  const saved = { q: baseline.q, v: baseline.v, t: baseline.time, account: { ...baseline.account } };
  for (const offset of [.5 * tau, 2 * tau]) {
    const system = new UnilateralSystem(definition(), { q: [1], v: [-.25] }, { maxStep: .03125, eventTimeTolerance: tau });
    const result = system.advanceUntil(end, force, [{ id: 'time-only', value: (_q, time) => end + offset - time }]);
    assert.equal(!!result.boundary, offset < tau); assert.equal(result.remaining, 0);
    assert.deepEqual({ q: system.q, v: system.v, t: system.time, account: { ...system.account } }, saved);
    if (result.boundary) {
      assert.equal(system.replaceContacts([]), null);
      assert.deepEqual({ q: system.q, v: system.v, t: system.time, account: { ...system.account } }, saved);
    } else assert.throws(() => system.replaceContacts([]), /explicit feature boundary/);
  }
});

test('accelerating curved guards retain incoming motion at a collision endpoint', () => {
  for (const id of ['aaa-curved', 'zzz-curved']) {
    const system = new UnilateralSystem(definition([floor(0)]), { q: [1], v: [0] }, { maxStep: .2 });
    const result = system.advanceUntil(1, (_q, _v, time) => { assert.ok(time <= 1); return [-4]; },
      [{ id, value: q => q[0] + .25 * q[0] ** 2 }]);
    assert.ok(result.boundary); near(system.time, 1); near(system.v[0], -2); assert.equal(result.events.length, 0);
    near(system.account.inputWork, 4); near(system.account.impactLoss, 0); near(system.account.residual, 0);
    assert.equal(system.replaceContacts([]), null); near(system.v[0], -2);
  }
});

test('an endpoint guard never skips an earlier impact even when both lie within the time resolution', () => {
  const tau = 1e-12;
  for (const id of ['aaa-after-impact', 'zzz-after-impact']) {
    const system = new UnilateralSystem(definition([floor(0)]), { q: [1], v: [-1] }, { maxStep: .2, eventTimeTolerance: tau });
    const guards = [{ id, value: (_q: readonly number[], time: number) => 1 + .5 * tau - time }];
    const first = system.advanceUntil(1, [0], guards);
    assert.equal(first.boundary, null);
    const second = system.advanceUntil(2 * tau, [0], guards);
    assert.ok(second.boundary); assert.equal([...first.events, ...second.events].length, 1);
    near(system.v[0], 0); near(system.account.impactLoss, 1); near(system.account.residual, 0);
    assert.equal(system.replaceContacts([]), null); near(system.v[0], 0);
  }
});

test('a guard earlier than a nearby endpoint impact reports without advancing or charging an impulse', () => {
  const tau = 1e-12, initial = 1 + .75 * tau;
  const system = new UnilateralSystem(definition([floor(0)]), { q: [initial], v: [-1] }, { maxStep: .25, eventTimeTolerance: tau });
  const baseline = new UnilateralSystem(definition(), { q: [initial], v: [-1] }, { maxStep: .25, eventTimeTolerance: tau });
  baseline.step(1);
  const result = system.advanceUntil(1, [0], [{ id: 'before-impact', value: (_q, time) => 1 + .25 * tau - time }]);
  assert.ok(result.boundary); assert.ok(system.q[0] > 0); assert.equal(result.events.length, 0);
  const saved = { q: baseline.q, v: baseline.v, t: baseline.time, account: { ...baseline.account } };
  assert.deepEqual({ q: system.q, v: system.v, t: system.time, account: { ...system.account } }, saved);
  assert.equal(system.replaceContacts([]), null);
  assert.deepEqual({ q: system.q, v: system.v, t: system.time, account: { ...system.account } }, saved);
});

test('established curved support retains the drift allowance across calls and identical-object replacement', () => {
  const contact: NormalContact = { id: 'inside-circle', gap: q => 1 - q[0] ** 2 - q[1] ** 2,
    gradient: q => [-2 * q[0], -2 * q[1]], timeDerivative: () => 0, accelerationBias: (_q, v) => -2 * (v[0] ** 2 + v[1] ** 2) };
  const circle: UnilateralDefinition = { mass: () => [[1, 0], [0, 1]], massDerivatives: () => [[[0, 0], [0, 0]], [[0, 0], [0, 0]]],
    potential: () => 0, potentialGradient: () => [0, 0], contacts: [contact] };
  const options = { maxStep: .03125, gapTolerance: 1e-6, velocityTolerance: 1e-6 };
  const system = new UnilateralSystem(circle, { q: [1, 0], v: [0, 1] }, options);
  const baseline = new UnilateralSystem(circle, { q: [1, 0], v: [0, 1] }, options);
  const first = system.advanceUntil(.25, [0, 0], [{ id: 'replace', value: (_q, time) => .25 - time }]);
  baseline.step(.25);
  assert.ok(first.boundary); assert.ok(contact.gap(system.q, system.time) > 0, 'fixture must exhibit positive integration drift');
  assert.equal(system.replaceContacts([contact]), null);
  const later = system.advanceUntil(.25, [0, 0], [{ id: 'far-away', value: () => 1 }]); baseline.step(.25);
  assert.equal(later.events.length, 0); assert.ok(later.contacts[0].reaction > 0); assert.ok(later.supportImpulses[contact.id] > 0);
  assert.deepEqual({ q: system.q, v: system.v, t: system.time, account: { ...system.account } },
    { q: baseline.q, v: baseline.v, t: baseline.time, account: { ...baseline.account } });
});

test('a replacement with the same ID cannot inherit support across a newly positive gap', () => {
  const system = new UnilateralSystem(definition([floor(0)]), { q: [0], v: [0] });
  const first = system.advanceUntil(.01, [-2], [{ id: 'replace', value: (_q, time) => .005 - time }]);
  assert.ok(first.boundary); assert.ok(first.supportImpulses.floor > 0); near(system.q[0], 0); near(system.v[0], 0);
  const gap = 5e-13, before = { q: system.q, v: system.v, t: system.time, account: { ...system.account } };
  assert.equal(system.replaceContacts([floor(-gap)]), null);
  assert.deepEqual({ q: system.q, v: system.v, t: system.time, account: { ...system.account } }, before);
  const result = system.advanceUntil(2e-6, [-2], [{ id: 'new-floor', value: q => q[0] + gap }]);
  assert.ok(result.boundary); near(result.elapsed, 1e-6, 1e-15); near(system.v[0], -1e-6, 1e-15);
  assert.equal(result.events.length, 0); assert.deepEqual(result.supportImpulses, {}); near(system.account.impactLoss, 0);
});

test('released support must actually reclose after a small free excursion', () => {
  const contact = floor(0), system = new UnilateralSystem(definition([contact]), { q: [0], v: [0] });
  const far = [{ id: 'far-away', value: () => 1 }];
  system.advanceUntil(.001, [-2], far);
  const opening = system.advanceUntil(1e-6, [2], far);
  assert.ok(opening.contacts[0].gap > 0); assert.ok(system.v[0] > 0);
  system.advanceUntil(1e-6, [-2], far);
  near(system.q[0], 1e-12, 1e-23); near(system.v[0], 0, 1e-15);
  const result = system.advanceUntil(2e-6, [-2], [{ id: 'reclose', value: q => q[0] }]);
  assert.ok(result.boundary); near(result.elapsed, Math.sqrt(2e-12), 1e-15);
  assert.equal(result.events.length, 0); assert.deepEqual(result.supportImpulses, {});
  near(system.v[0], -Math.sqrt(2e-12), 1e-15); near(system.account.impactLoss, 0);
});

test('a new separated replacement cannot supply impulse or loss before actual closure', () => {
  for (const gap of [5e-10, 5e-13, 5e-16]) {
    const system = new UnilateralSystem(definition(), { q: [gap], v: [-1] });
    system.advanceUntil(.01, [0], [{ id: 'replace', value: () => 0 }]);
    const before = { q: system.q, v: system.v, t: system.time, account: { ...system.account } };
    assert.equal(system.replaceContacts([floor(0)]), null);
    assert.deepEqual({ q: system.q, v: system.v, t: system.time, account: { ...system.account } }, before);
    const later = system.advanceUntil(1e-9, [0], [{ id: 'unrelated', value: () => 1 }]);
    assert.equal(later.events.length, 1); near(later.events[0].time, gap, 1e-22);
    near(system.v[0], 0); near(system.account.impactLoss, 1); near(system.account.residual, 0);
  }
});

test('analytic contact and time-guard coincidences preserve incoming state at interior and requested endpoints', () => {
  for (const h of [.2, .1, .07, .03, .013, .3, .3333333333]) for (const speed of [.1, .3, 1, 2, 3, 7]) for (const time of [.1, .3, 1, 1.3]) for (const factor of [1, 1.1]) {
    const system = new UnilateralSystem(definition([floor(0)]), { q: [speed * time], v: [-speed] }, { maxStep: h });
    const account = { ...system.account }, label = JSON.stringify({ h, speed, time, factor });
    const result = system.advanceUntil(time * factor, (_q, _v, t) => { assert.ok(t <= time * factor); return [0]; },
      [{ id: 'retire', value: (_q, t) => time - t }]);
    assert.ok(result.boundary, label); assert.equal(result.events.length, 0, label); assert.equal(system.v[0], -speed, label);
    assert.deepEqual(system.account, account, label); near(system.time, time, 1e-13);
    const before = { q: system.q, v: system.v, t: system.time, account: { ...system.account } };
    assert.equal(system.replaceContacts([]), null);
    assert.deepEqual({ q: system.q, v: system.v, t: system.time, account: { ...system.account } }, before, label);
  }
});

test('compensated accepted motion survives root retries and an impulse without advancing unrelated coordinates', () => {
  const wall: NormalContact = { id: 'wall', gap: q => q[0], gradient: () => [1, 0], timeDerivative: () => 0, accelerationBias: () => 0 };
  const model = (contacts: NormalContact[]): UnilateralDefinition => ({ mass: () => [[2, 0], [0, 1]],
    massDerivatives: () => [[[0, 0], [0, 0]], [[0, 0], [0, 0]]], potential: () => 0, potentialGradient: () => [0, 0], contacts });
  const initial = { q: [1, 1e9], v: [-1, 1e-6] }, options = { maxStep: .013 }, end = 1.3;
  const hit = new UnilateralSystem(model([wall]), initial, options), free = new UnilateralSystem(model([]), initial, options);
  let evaluations = 0;
  const result = hit.advanceUntil(end, (_q, _v, time) => { evaluations++; assert.ok(time <= end); return [0, 0]; }, [{ id: 'future', value: () => 1 }]);
  free.advanceUntil(end, [0, 0], [{ id: 'future', value: () => 1 }]);
  assert.equal(result.events.length, 1); near(result.events[0].time, 1); near(hit.account.impactLoss, 1);
  assert.ok(evaluations > 500, 'fixture must exercise many speculative root evaluations');
  assert.equal(hit.q[1], initial.q[1] + initial.v[1] * end); assert.equal(hit.q[1], free.q[1]);
  assert.equal(hit.v[1], free.v[1]); assert.equal(hit.time, end); assert.equal(free.time, end);
  near(hit.v[0], 0); near(hit.account.residual, 0);
});

test('failed replacement after impulse evaluation restores compensation and future continuation atomically', () => {
  let failPotential = false;
  const model: UnilateralDefinition = { ...definition(), potential: () => failPotential ? NaN : 0 };
  const system = new UnilateralSystem(model, { q: [1], v: [-1] }, { maxStep: .013 });
  const control = new UnilateralSystem(model, { q: [1], v: [-1] }, { maxStep: .013 });
  const guard = [{ id: 'replace', value: (_q: readonly number[], time: number) => .37 - time }];
  system.advanceUntil(.5, [.2], guard); control.advanceUntil(.5, [.2], guard);
  const before = { q: system.q, v: system.v, t: system.time, account: { ...system.account } };
  failPotential = true;
  assert.throws(() => system.replaceContacts([floor(system.q[0])]), /Nonfinite potential/);
  failPotential = false;
  assert.deepEqual({ q: system.q, v: system.v, t: system.time, account: { ...system.account } }, before);
  system.replaceContacts([]); control.replaceContacts([]);
  system.step(.1, [.2]); control.step(.1, [.2]);
  assert.deepEqual({ q: system.q, v: system.v, t: system.time, account: { ...system.account } },
    { q: control.q, v: control.v, t: control.time, account: { ...control.account } });
});
