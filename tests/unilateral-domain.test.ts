// Exact kernel-only test bodies from reviewed fb15617 domain suites.
// Finite-escapement geometry tests stay with the unpromoted adapter.
import test from 'node:test';
import assert from 'node:assert/strict';
import { UnilateralSystem, type FeatureGuard, type NormalContact, type UnilateralDefinition } from '../src/mechanism/unilateral';
const providers = ['massDerivatives', 'potentialGradient', 'gradient', 'timeDerivative', 'accelerationBias'] as const;
function limitedFixture() {
  const calls = { total: 0, outside: 0 }, check = (q: readonly number[]) => { calls.total++; if (q[0] <= 0) calls.outside++; assert.ok(q[0] > 0); };
  const contact: NormalContact = { id: 'limited', gap: q => { check(q); return 100 + Math.log(q[0]); }, gradient: q => { check(q); return [1 / q[0]]; },
    timeDerivative: q => { check(q); return 0; }, accelerationBias: (q, v) => { check(q); return -(v[0] ** 2) / q[0] ** 2; } };
  const model: UnilateralDefinition = { mass: q => { check(q); return [[1]]; }, massDerivatives: q => { check(q); return [[[0]]]; },
    potential: q => { check(q); return 0; }, potentialGradient: q => { check(q); return [0]; }, contacts: [contact] };
  const guards: FeatureGuard[] = [{ id: 'retire', value: q => { calls.total++; return q[0] - 1e-6; }, smoothDomain: q => { calls.total++; return q[0] > 0; } }];
  const remove = (provider: typeof providers[number]) => {
    if (provider === 'massDerivatives' || provider === 'potentialGradient') delete model[provider]; else delete contact[provider];
  };
  return { calls, check, contact, model, guards, remove };
}
const snapshot = (system: UnilateralSystem) => ({ q: system.q, v: system.v, time: system.time, account: { ...system.account } });

test('every absent derivative provider fails before protected callbacks, including initially expired guards', () => {
  for (const provider of providers) for (const expired of [false, true]) {
    const f = limitedFixture(); f.remove(provider);
    const system = new UnilateralSystem(f.model, { q: [1], v: [-1] }, { maxStep: .2 }), before = snapshot(system);
    if (expired) f.guards[0].value = () => { f.calls.total++; return 0; };
    f.calls.total = 0;
    assert.throws(() => system.advanceUntil(1, q => { f.check(q); return [0]; }, f.guards), /requires analytic derivatives/);
    assert.equal(f.calls.total, 0, provider); assert.equal(f.calls.outside, 0, provider); assert.deepEqual(snapshot(system), before);
  }
});

test('analytic derivatives complete the original logarithmic-domain trajectory without invalid stencils', () => {
  const f = limitedFixture(), system = new UnilateralSystem(f.model, { q: [1], v: [-1] }, { maxStep: .2 });
  const result = system.advanceUntil(1, q => { f.check(q); return [0]; }, f.guards);
  assert.ok(result.boundary); assert.equal(f.calls.outside, 0); assert.equal(result.events.length, 0);
  assert.ok(Math.abs(system.time - .999999) < 1e-13); assert.ok(Math.abs(system.q[0] - 1e-6) < 1e-13);
  assert.deepEqual(system.v, [-1]); assert.equal(system.account.impactLoss, 0); assert.equal(system.account.residual, 0);
});

test('protected replacement checks all derivative metadata atomically before evaluating new formulas', () => {
  for (const provider of providers) {
    const f = limitedFixture(), system = new UnilateralSystem(f.model, { q: [1], v: [-1] });
    f.guards[0].value = () => 0; system.advanceUntil(.1, [0], f.guards);
    const before = snapshot(system), replacement = { ...f.contact }, originalMass = f.model.massDerivatives, originalPotential = f.model.potentialGradient;
    if (provider === 'massDerivatives' || provider === 'potentialGradient') f.remove(provider); else delete replacement[provider];
    f.calls.total = 0;
    assert.throws(() => system.replaceContacts([replacement]), /requires analytic derivatives/);
    assert.equal(f.calls.total, 0); assert.equal(f.calls.outside, 0); assert.deepEqual(snapshot(system), before);
    f.model.massDerivatives = originalMass; f.model.potentialGradient = originalPotential;
    assert.equal(system.replaceContacts([f.contact]), null); assert.deepEqual(snapshot(system), before);
  }
});

test('an absolute zero-duration boundary preserves accepted history and invalid deadlines are atomic', () => {
  const model: UnilateralDefinition = { mass: () => [[2]], massDerivatives: () => [[[0]]], potential: () => 0, potentialGradient: () => [0], contacts: [] };
  const system = new UnilateralSystem(model, { q: [1], v: [-1] }, { maxStep: .013 }), control = new UnilateralSystem(model, { q: [1], v: [-1] }, { maxStep: .013 });
  system.step(.37, [.2]); control.step(.37, [.2]); const before = snapshot(system);
  for (const end of [NaN, Infinity, system.time - 1e-6]) assert.throws(() => system.advanceTo(end, () => { throw new Error('deadline invoked force'); }, []), /Invalid unilateral deadline/);
  assert.deepEqual(snapshot(system), before);
  const result = system.advanceTo(system.time, [.2], [{ id: 'same-time', value: () => 0 }]);
  assert.equal(result.elapsed, 0); assert.equal(result.remaining, 0); assert.ok(result.boundary); assert.deepEqual(snapshot(system), before);
  system.replaceContacts([]); system.step(.1, [.2]); control.step(.1, [.2]); assert.deepEqual(snapshot(system), snapshot(control));
});


function guardedOscillator(maxStep: number, initial = 1) {
  const counters = { rejectedDomains: 0, ordinaryGuards: 0, contacts: 0, forces: 0, invalid: 0 };
  const valid = (q: readonly number[]) => q[0] > .01;
  const checked = (q: readonly number[]) => { if (!valid(q)) counters.invalid++; assert.ok(valid(q), 'ordinary formula evaluated outside its declared domain'); };
  const contact: NormalContact = { id: 'separated', gap: q => { checked(q); counters.contacts++; return 10 + Math.log(q[0]); },
    gradient: q => { checked(q); return [1 / q[0]]; }, timeDerivative: () => 0,
    accelerationBias: (q, v) => { checked(q); return -(v[0] ** 2) / q[0] ** 2; } };
  const guards: FeatureGuard[] = [
    { id: 'a-ordinary', value: q => { checked(q); counters.ordinaryGuards++; return Math.log(q[0] / .05); } },
    { id: 'z-domain', value: q => q[0] - .1, smoothDomain: q => { const yes = valid(q); if (!yes) counters.rejectedDomains++; return yes; } },
  ];
  const system = new UnilateralSystem({ mass: () => [[1]], massDerivatives: () => [[[0]]], potential: q => .5 * q[0] ** 2,
    potentialGradient: q => { checked(q); return [q[0]]; }, contacts: [contact] }, { q: [initial], v: [0] }, { maxStep });
  const result = system.advanceUntil(2, (q, _v, time) => { checked(q); counters.forces++; assert.ok(time <= 2); return [0]; }, guards);
  return { system, result, counters };
}

test('domain truncation evaluates no invalid formula or force and converges to the actual nonlinear trajectory', t => {
  const errors = [.8, .4, .2].map(step => {
    const { system, result, counters } = guardedOscillator(step);
    assert.ok(counters.rejectedDomains > 0); assert.equal(counters.invalid, 0);
    assert.ok(counters.ordinaryGuards > 0 && counters.contacts > 0 && counters.forces > 0);
    assert.deepEqual(result.boundary!.ids, ['z-domain']); assert.equal(result.events.length, 0); assert.deepEqual(result.supportImpulses, {});
    assert.ok(Math.abs(system.q[0] - .1) < 1e-12); assert.equal(system.account.inputWork, 0); assert.equal(system.account.impactLoss, 0);
    return Math.max(Math.abs(system.time - Math.acos(.1)), Math.abs(system.v[0] + Math.sqrt(.99)), Math.abs(system.account.residual));
  });
  assert.ok(errors[1] < errors[0] / 5, JSON.stringify(errors)); assert.ok(errors[2] < errors[1] / 5, JSON.stringify(errors));
  t.diagnostic(`nonlinear trajectory/time/energy maximum errors at 0.8/0.4/0.2 s steps: ${JSON.stringify(errors)}`);
});

test('a domain guard initially at its zero returns unchanged and unrelated exceptions are not retried', () => {
  const { system, result, counters } = guardedOscillator(.8, .1);
  assert.equal(result.elapsed, 0); assert.equal(result.events.length, 0); assert.equal(counters.invalid, 0);
  assert.deepEqual(system.q, [.1]); assert.deepEqual(system.v, [0]); assert.equal(system.time, 0);
  assert.equal(system.account.inputWork, 0); assert.equal(system.account.impactLoss, 0); assert.equal(system.account.residual, 0);
  let calls = 0;
  const failure = new UnilateralSystem({ mass: () => [[1]], massDerivatives: () => [[[0]]], potential: () => 0, potentialGradient: () => [0], contacts: [] }, { q: [1], v: [-1] });
  assert.throws(() => failure.advanceUntil(1, () => { calls++; throw new Error('unrelated callback failure'); },
    [{ id: 'domain', value: q => q[0] - .1, smoothDomain: q => q[0] > .01 }]), /unrelated callback failure/);
  assert.equal(calls, 1); assert.equal(failure.time, 0); assert.deepEqual(failure.q, [1]);
});

test('an established normal supplies only valid pre-boundary support and releases after retirement', () => {
  let invalid = 0, domainRejections = 0;
  const check = (q: readonly number[]) => { if (q[0] <= .01) invalid++; assert.ok(q[0] > .01); };
  const contact: NormalContact = { id: 'support', gap: q => { check(q); return q[1]; },
    gradient: q => { check(q); return [0, 1]; }, timeDerivative: () => 0, accelerationBias: q => { check(q); return 0; } };
  const system = new UnilateralSystem({ mass: () => [[1, 0], [0, 1]],
    massDerivatives: () => [[[0, 0], [0, 0]], [[0, 0], [0, 0]]], potential: q => .5 * q[0] ** 2,
    potentialGradient: q => { check(q); return [q[0], 0]; }, contacts: [contact] }, { q: [1, 0], v: [0, 0] }, { maxStep: .2 });
  const result = system.advanceUntil(2, q => { check(q); return [0, -1]; }, [{ id: 'retire-support', value: q => q[0] - .1,
    smoothDomain: q => { if (q[0] <= .01) domainRejections++; return q[0] > .01; } }]);
  assert.ok(result.boundary); assert.ok(domainRejections > 0); assert.equal(invalid, 0);
  assert.equal(result.events.length, 0); assert.ok(Math.abs(result.supportImpulses.support - system.time) < 1e-10);
  assert.equal(system.q[1], 0); assert.equal(system.v[1], 0); assert.equal(system.account.inputWork, 0); assert.equal(system.account.impactLoss, 0);
  assert.equal(system.replaceContacts([]), null);
  system.step(.05, [0, -1]);
  assert.ok(Math.abs(system.q[1] + .5 * .05 ** 2) < 1e-12); assert.ok(Math.abs(system.v[1] + .05) < 1e-12);
});
