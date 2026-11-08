import test from 'node:test';
import assert from 'node:assert/strict';
import { UnilateralSystem, type UnilateralDefinition, type NormalContact } from '../src/mechanism/unilateral';

const near = (actual: number, expected: number, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} (tolerance ${tolerance})`);
const zero = (n: number) => Array(n).fill(0);
function masses(values: number[], contacts: NormalContact[] = []): UnilateralDefinition {
  return { mass: () => values.map((m, i) => values.map((_, j) => i === j ? m : 0)),
    massDerivatives: () => values.map(() => values.map(() => zero(values.length))), potential: () => 0,
    potentialGradient: () => zero(values.length), contacts };
}
const push: NormalContact = { id: 'driver-to-follower', gap: q => q[1] - q[0], gradient: () => [-1, 1], timeDerivative: () => 0, accelerationBias: () => 0 };

test('approaching bodies conserve momentum and have analytical capture/restitution loss', () => {
  for (const e of [0, .5, 1]) {
    const system = new UnilateralSystem(masses([2, 3], [push]), { q: [0, 1], v: [3, 0] }, { maxStep: .05, restitution: e });
    const result = system.step(.5), impulse = 3.6 * (1 + e), v0 = 3 - impulse / 2, v1 = impulse / 3;
    near(system.v[0], v0); near(system.v[1], v1); near(2 * system.v[0] + 3 * system.v[1], 6);
    near(system.q[0], 1 + v0 / 6); near(system.q[1], 1 + v1 / 6);
    assert.equal(result.events.length, 1); near(result.events[0].elapsed, 1 / 3, 1e-12);
    near(result.events[0].contacts[0].impulse, impulse); near(result.events[0].loss, 5.4 * (1 - e * e));
    near(system.account.impactLoss, 5.4 * (1 - e * e)); near(system.account.residual, 0, 1e-11);
    assert.ok(result.events[0].contacts.every(c => c.impulse >= 0 && c.outgoing >= -1e-12));
  }
});

test('a receding driver cannot capture a stopped follower; its spring accelerates it continuously', () => {
  const definition = masses([1, 1], [push]);
  definition.potential = q => 2 * (q[1] + .2) ** 2;
  definition.potentialGradient = q => [0, 4 * (q[1] + .2)];
  const system = new UnilateralSystem(definition, { q: [0, 0], v: [-1, 0] });
  const first = system.step(.0001);
  assert.equal(first.events.length, 0); assert.deepEqual(first.supportImpulses, {});
  near(system.v[1], -.4 * Math.sin(.0002), 1e-13);
  system.step(.0499);
  near(system.q[0], -.05); near(system.q[1], -.2 + .2 * Math.cos(.1), 1e-12);
  near(system.v[0], -1); near(system.v[1], -.4 * Math.sin(.1), 1e-12);
  assert.ok(system.q[1] - system.q[0] > .049); near(system.account.impactLoss, 0);
});

test('a sustained push supports load, then releases without glue when the driver recedes', () => {
  const system = new UnilateralSystem(masses([1, 3], [push]), { q: [0, 0], v: [0, 0] });
  const held = system.step(.1, [2, 0]);
  system.q.forEach(q => near(q, .0025)); system.v.forEach(v => near(v, .05));
  near(held.contacts[0].reaction, 1.5); near(held.supportImpulses[push.id], .15);
  near(held.contacts[0].gap, 0); near(held.contacts[0].normalVelocity, 0);
  near(system.account.inputWork, .005); near(system.account.residual, 0, 1e-12);
  const released = system.step(.1, [-2, 0]);
  near(system.q[1] - system.q[0], .01); near(released.contacts[0].reaction, 0);
  assert.deepEqual(released.supportImpulses, {}); assert.equal(released.events.length, 0);
  near(system.v[1], .05); near(system.v[0], -.15);
});

test('a moving support has the boundary velocity and correct separately measured work', () => {
  const boundary = (t: number) => .02 * t + .015 * t * t;
  const contact: NormalContact = { id: 'moving-support', gap: (q, t) => q[0] - boundary(t), gradient: () => [1],
    timeDerivative: (_q, t) => -.02 - .03 * t, accelerationBias: () => -.03 };
  const definition = masses([1], [contact]); definition.potential = q => .1 * q[0]; definition.potentialGradient = () => [.1];
  const system = new UnilateralSystem(definition, { q: [0], v: [.02] }, { maxStep: 1 / 60 });
  const a = system.step(.5), middle = system.q[0], b = system.step(.5);
  near(middle, boundary(.5), 1e-12); near(system.q[0], boundary(1), 1e-12); near(system.v[0], .05, 1e-12);
  near((system.q[0] - middle) / .5, .0425, 1e-12); near(a.contacts[0].reaction, .13); near(b.contacts[0].reaction, .13);
  near(b.contacts[0].normalVelocity, 0); near(system.account.boundaryWork, .13 * boundary(1), 1e-12);
  near(system.account.impactLoss, 0); near(system.account.inputWork, 0); near(system.account.residual, 0, 1e-12);
});

test('collision with a moving wall separates wall work from impact loss', () => {
  const contact: NormalContact = { id: 'wall', gap: (q, t) => q[0] - .4 * t, gradient: () => [1], timeDerivative: () => -.4, accelerationBias: () => 0 };
  const system = new UnilateralSystem(masses([2], [contact]), { q: [1], v: [-.6] }, { maxStep: .1, restitution: .5 });
  const result = system.step(1.2), event = result.events[0];
  near(event.time, 1); near(event.contacts[0].incoming, -1); near(event.contacts[0].outgoing, .5);
  near(system.v[0], .9); near(event.contacts[0].impulse, 3); near(event.boundaryWork, 1.2); near(event.loss, .75);
  near(system.account.residual, 0, 1e-11);
});

test('simultaneous coupled impacts are independent of contact enumeration order and dissipative', () => {
  const ab: NormalContact = { ...push, id: 'a-b', gap: q => q[1] - q[0], gradient: () => [-1, 1, 0] };
  const bc: NormalContact = { ...push, id: 'b-c', gap: q => q[2] - q[1], gradient: () => [0, -1, 1] };
  for (const e of [0, .2, 1]) {
    const systems = [[ab, bc], [bc, ab]].map(contacts => new UnilateralSystem(masses([1, 2, 3], contacts), { q: [0, 0, 0], v: [2, 0, -1] }, { restitution: e }));
    const results = systems.map(s => s.step(.01));
    assert.deepEqual(systems[0].q, systems[1].q); assert.deepEqual(systems[0].v, systems[1].v);
    assert.deepEqual(results[0].events, results[1].events);
    const expected = [2, 0, -1].map(v => (1 + e) * (-1 / 6) - e * v);
    systems[0].v.forEach((v, i) => near(v, expected[i]));
    near(systems[0].account.impactLoss, (1 - e * e) * (3.5 - 1 / 12));
    near(systems[0].account.residual, 0, 1e-11);
    assert.ok(results[0].events[0].contacts.every(c => c.impulse >= 0 && c.outgoing >= -1e-12));
  }
});

test('restitution cannot drive another touching face into penetration or create energy', () => {
  const a: NormalContact = { id: 'a', gap: q => q[0], gradient: () => [1, 0], timeDerivative: () => 0, accelerationBias: () => 0 };
  const b: NormalContact = { id: 'b', gap: q => -.8 * q[0] + .6 * q[1], gradient: () => [-.8, .6], timeDerivative: () => 0, accelerationBias: () => 0 };
  const system = new UnilateralSystem(masses([1, 1], [a, b]), { q: [0, 0], v: [-1, 0] }, { restitution: 1 });
  const result = system.step(.01);
  near(system.v[0], .36); near(system.v[1], .48); near(system.account.impactLoss, .32);
  assert.ok(result.events[0].contacts.every(c => c.impulse >= 0 && c.outgoing >= -1e-12));
  near(system.account.residual, 0, 1e-12);
  // One touched face is separating. A joint solve must leave it unloaded,
  // rather than accept a full-set solution requiring a negative impulse.
  const separating = new UnilateralSystem(masses([1, 1], [a, b]), { q: [0, 0], v: [-1, 1 / 3] });
  const separation = separating.step(.01);
  near(separating.v[0], 0); near(separating.v[1], 1 / 3);
  near(separation.events[0].contacts.find(c => c.id === 'a')!.impulse, 1);
  near(separation.events[0].contacts.find(c => c.id === 'b')!.impulse, 0);
  near(separating.account.impactLoss, .5); near(separating.account.residual, 0, 1e-12);
});

test('a curved sustained contact retains tangential motion and converges without position projection', () => {
  const contact: NormalContact = { id: 'inside-circle', gap: q => 1 - q[0] ** 2 - q[1] ** 2,
    gradient: q => [-2 * q[0], -2 * q[1]], timeDerivative: () => 0, accelerationBias: (_q, v) => -2 * (v[0] ** 2 + v[1] ** 2) };
  const errors = [.05, .025, .0125].map(maxStep => {
    const system = new UnilateralSystem(masses([1, 1], [contact]), { q: [1, 0], v: [0, 1] }, { maxStep, gapTolerance: 1e-6, velocityTolerance: 1e-6 });
    const result = system.step(.5);
    assert.ok(result.minGap >= -1e-6); assert.ok(result.contacts[0].reaction > 0);
    return Math.max(Math.abs(system.q[0] - Math.cos(.5)), Math.abs(system.q[1] - Math.sin(.5)), Math.abs(system.account.residual));
  });
  assert.ok(errors[0] > 1e-10); assert.ok(errors[1] < errors[0] / 10); assert.ok(errors[2] < errors[1] / 10);
});

function transformedGravity(analytic: boolean): UnilateralDefinition {
  // Cartesian x=q0, y=q1+sin(q0). This is independent analytic ground truth
  // with a variable, fully coupled mass matrix, not a coordinate-wise mass fit.
  const definition: UnilateralDefinition = {
    mass: q => { const c = Math.cos(q[0]); return [[1 + c * c, c], [c, 1]]; },
    potential: q => 2 * (q[1] + Math.sin(q[0])), contacts: [],
  };
  if (analytic) {
    definition.massDerivatives = q => { const c = Math.cos(q[0]), s = Math.sin(q[0]); return [[[-2 * c * s, -s], [-s, 0]], [[0, 0], [0, 0]]]; };
    definition.potentialGradient = q => [2 * Math.cos(q[0]), 2];
  }
  return definition;
}

test('full configuration-dependent inertia includes cross terms and Christoffel acceleration', () => {
  const x0 = .3, y0 = .4 + Math.sin(.3), vx = .8, vy = -.2 + Math.cos(.3) * vx, t = 1;
  const expectedQ = [x0 + vx * t, y0 + vy * t - t * t - Math.sin(x0 + vx * t)];
  const expectedV = [vx, vy - 2 * t - Math.cos(x0 + vx * t) * vx];
  const errors = [.2, .1, .05].map(maxStep => {
    const system = new UnilateralSystem(transformedGravity(true), { q: [.3, .4], v: [.8, -.2] }, { maxStep, coordinateScales: [1, .1] });
    system.step(t); near(system.q[0], expectedQ[0], 1e-12); near(system.v[0], expectedV[0], 1e-12);
    return Math.max(Math.abs(system.q[1] - expectedQ[1]), Math.abs(system.v[1] - expectedV[1]), Math.abs(system.account.residual));
  });
  assert.ok(errors[0] > 1e-8); assert.ok(errors[1] < errors[0] / 10); assert.ok(errors[2] < errors[1] / 10);
  const numerical = new UnilateralSystem(transformedGravity(false), { q: [.3, .4], v: [.8, -.2] }, { maxStep: .005, coordinateScales: [1, .1] });
  numerical.step(t); numerical.q.forEach((q, i) => near(q, expectedQ[i], 2e-8)); numerical.v.forEach((v, i) => near(v, expectedV[i], 2e-8));
  assert.ok(Math.abs(numerical.account.residual) < 2e-8);
});

test('damping and finite-force work have honest convergent energy residuals', () => {
  const frequencies = [.1, .05, .025, .0125, .00625];
  const frequency = Math.sqrt(3.99), a = 1 - .3 / 8, b = (.1 + .1 * a) / frequency;
  const expected = .3 / 8 + Math.exp(-.1) * (a * Math.cos(frequency) + b * Math.sin(frequency));
  const errors = frequencies.map(maxStep => {
    const definition = masses([2]); definition.potential = q => 4 * q[0] ** 2; definition.potentialGradient = q => [8 * q[0]];
    definition.damping = (_q, v) => [-.4 * v[0]];
    const system = new UnilateralSystem(definition, { q: [1], v: [.1] }, { maxStep }); system.step(1, () => [.3]);
    assert.ok(system.account.dampingLoss > 0); assert.ok(system.totalEnergy < system.account.initial + system.account.inputWork);
    return { residual: Math.abs(system.account.residual), position: Math.abs(system.q[0] - expected) };
  });
  // The h=.1 residual has cancellation between leading errors, so its coarse
  // ratio is about 6, not an asymptotic order estimate. Preserve those points.
  for (let i = 1; i < errors.length; i++) { assert.ok(errors[i].residual < errors[i - 1].residual); assert.ok(errors[i].position < errors[i - 1].position / 10); }
  assert.ok(errors[3].residual < errors[2].residual / 10); assert.ok(errors[4].residual < errors[3].residual / 10);
  assert.ok(errors[4].residual < 4e-10); assert.ok(errors[4].position < 4e-10);
});

test('seeded full-matrix contact cones preserve signed impulses, momentum jump and passivity', () => {
  let seed = 0x729ada;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32 - .5; };
  for (let trial = 0; trial < 45; trial++) {
    const n = 2 + trial % 5, count = n + 2, raw = Array.from({ length: n }, () => Array.from({ length: n }, random));
    const matrix = raw.map((row, i) => raw.map((other, j) => row.reduce((s, x, k) => s + x * other[k], i === j ? .5 : 0)));
    const normals = Array.from({ length: count }, () => Array.from({ length: n }, random)), initial = Array.from({ length: n }, random);
    const contacts: NormalContact[] = normals.map((normal, i) => ({ id: `face-${i}`, gap: q => normal.reduce((s, x, j) => s + x * q[j], 0), gradient: () => normal, timeDerivative: () => 0, accelerationBias: () => 0 }));
    const definition = masses(Array(n).fill(1), contacts); definition.mass = () => matrix;
    const system = new UnilateralSystem(definition, { q: zero(n), v: initial }, { restitution: (trial % 3) / 2 });
    const result = system.step(.001), impulses = Object.fromEntries(result.events.flatMap(e => e.contacts.map(c => [c.id, c.impulse])));
    assert.ok(system.totalEnergy <= system.account.initial + 1e-10); assert.ok(system.account.impactLoss >= 0); near(system.account.residual, 0, 1e-10);
    for (let i = 0; i < n; i++) {
      const momentum = matrix[i].reduce((s, x, j) => s + x * (system.v[j] - initial[j]), 0);
      const impulse = normals.reduce((s, normal, j) => s + normal[i] * (impulses[`face-${j}`] ?? 0), 0);
      near(momentum, impulse, 1e-9);
    }
    for (const c of result.events.flatMap(e => e.contacts)) assert.ok(c.impulse >= 0 && c.outgoing >= -1e-9);
  }
});

test('swept interior and exact-endpoint impacts are resolved in the calling step', () => {
  const ground: NormalContact = { id: 'floor', gap: q => q[0], gradient: () => [1], timeDerivative: () => 0, accelerationBias: () => 0 };
  const outAndBack = masses([1], [ground]); outAndBack.potential = q => -20 * q[0]; outAndBack.potentialGradient = () => [-20];
  const system = new UnilateralSystem(outAndBack, { q: [.1], v: [-3] }, { maxStep: .3 });
  const result = system.step(.3), hitTime = (3 - Math.sqrt(5)) / 20;
  assert.equal(result.events.length, 1); near(result.events[0].elapsed, hitTime, 1e-12); near(result.events[0].loss, 2.5, 1e-10);
  near(system.q[0], 10 * (.3 - hitTime) ** 2, 1e-10); near(system.account.residual, 0, 1e-10);
  const endpoint = new UnilateralSystem(masses([1], [ground]), { q: [1], v: [-3] }, { maxStep: .1 });
  const atEnd = endpoint.step(1 / 3); assert.equal(atEnd.events.length, 1); near(endpoint.v[0], 0); near(endpoint.q[0], 0, 1e-12); near(atEnd.events[0].elapsed, 1 / 3, 1e-12);
});

test('a held contact releases, collides and lifts again inside a step with positive final gap', () => {
  // Free q after first release is A*s³*(B-s)*(C-s). It crosses the floor at
  // t=b, then is held until the second positive root of its acceleration.
  const a = .15, b = .3, c = .4, end = .4, A = 100, B = b - a, C = c - a;
  const position = (t: number) => { const s = t - a; return A * (B * C * s ** 3 - (B + C) * s ** 4 + s ** 5); };
  const velocity = (t: number) => { const s = t - a; return A * (3 * B * C * s ** 2 - 4 * (B + C) * s ** 3 + 5 * s ** 4); };
  const force = (t: number) => { const s = t - a; return A * (6 * B * C * s - 12 * (B + C) * s * s + 20 * s ** 3); };
  const secondRelease = a + (12 * (B + C) + Math.sqrt(144 * (B + C) ** 2 - 480 * B * C)) / 40;
  const expectedQ = position(end) - position(secondRelease) - velocity(secondRelease) * (end - secondRelease), expectedV = velocity(end) - velocity(secondRelease);
  const contact: NormalContact = { id: 'floor', gap: q => q[0], gradient: () => [1], timeDerivative: () => 0, accelerationBias: () => 0 };
  const run = (maxStep: number) => {
    const system = new UnilateralSystem(masses([1], [contact]), { q: [0], v: [0] }, { maxStep });
    const result = system.step(end, (_q, _v, t) => [force(t)]);
    assert.equal(result.events.length, 1); assert.equal(result.releases.length, 2); assert.ok(system.q[0] > 0); assert.ok(result.minGap >= -1e-9);
    near(result.releases[0].time, a, 1e-8); near(result.releases[1].time, secondRelease, 1e-8);
    return { system, result };
  };
  // A deliberately coarse single step still discovers the hidden event;
  // accurate event/coordinate claims below use explicit refinement.
  const coarse = run(.4); assert.ok(coarse.result.events[0].time > .25 && coarse.result.events[0].time < .31);
  const errors = [.025, .0125, .00625, .003125].map(h => {
    const { system, result } = run(h); near(system.v[0], expectedV, 1e-8);
    return { position: Math.abs(system.q[0] - expectedQ), time: Math.abs(result.events[0].time - b), loss: Math.abs(system.account.impactLoss - .5 * velocity(b) ** 2) };
  });
  for (let i = 1; i < errors.length; i++) for (const metric of ['position', 'time', 'loss'] as const) assert.ok(errors[i][metric] < errors[i - 1][metric] / 10);
  assert.ok(errors.at(-1)!.position < 2e-10); assert.ok(errors.at(-1)!.time < 8e-9);
});

test('two distinct contacts in one dense bracket resolve by physical time, not ID order', () => {
  const run = (swapIds: boolean) => {
    const early: NormalContact = { id: swapIds ? 'a-early' : 'z-early', gap: q => q[0] - .52, gradient: () => [1, 0], timeDerivative: () => 0, accelerationBias: () => 0 };
    const late: NormalContact = { id: swapIds ? 'z-late' : 'a-late', gap: q => q[1] - .515, gradient: () => [0, 1], timeDerivative: () => 0, accelerationBias: () => 0 };
    const system = new UnilateralSystem(masses([1, 2], [early, late]), { q: [1, 1], v: [-1, -1] }, { maxStep: .5 });
    const result = system.step(.5); assert.equal(result.events.length, 2);
    near(result.events[0].time, .48, 1e-12); near(result.events[1].time, .485, 1e-12);
    assert.ok(result.events[0].contacts.some(contact => contact.id === early.id && contact.impulse > 0));
    assert.ok(result.events[1].contacts.some(contact => contact.id === late.id && contact.impulse > 0));
    return system;
  };
  const first = run(false), second = run(true); assert.deepEqual(first.q, second.q); assert.deepEqual(first.v, second.v);
});

test('all simultaneous releases are emitted; nearby distinct releases retain physical order', () => {
  const floor = (id: string, i: number): NormalContact => ({ id, gap: q => q[i], gradient: () => [i === 0 ? 1 : 0, i === 1 ? 1 : 0], timeDerivative: () => 0, accelerationBias: () => 0 });
  for (const reverse of [false, true]) for (const offset of [0, 5e-13, 1e-6]) {
    const contacts = [floor('z-first', 0), floor('a-second', 1)]; if (reverse) contacts.reverse();
    const system = new UnilateralSystem(masses([1, 1], contacts), { q: [0, 0], v: [0, 0] }, { maxStep: .1 });
    const result = system.step(.1, (_q, _v, t) => [t - .05, t - .05 - offset]);
    assert.equal(result.releases.length, 2);
    if (offset < 1e-12) {
      assert.deepEqual(result.releases.map(e => e.id), ['a-second', 'z-first']);
      near(result.releases[0].time, .05 + 1e-8 + offset, 5e-14);
      assert.equal(result.releases[0].time, result.releases[1].time);
    } else {
      assert.deepEqual(result.releases.map(e => e.id), ['z-first', 'a-second']);
      near(result.releases[0].time, .05 + 1e-8, 5e-14); near(result.releases[1].time, .05 + offset + 1e-8, 5e-14);
    }
    system.q.forEach((q, i) => near(q, (.05 - (i ? offset : 0)) ** 3 / 6, 1e-10));
    system.v.forEach((v, i) => near(v, (.05 - (i ? offset : 0)) ** 2 / 2, 1e-9));
  }
});

test('seven-coordinate full-SPD impact and sustained support match Cartesian ground truth', () => {
  const n = 7, weights = Array.from({ length: n }, (_, i) => i + 1);
  // Cartesian x=Aq, where A is upper bidiagonal; M=A^T diag(m) A.
  const transform = weights.map((_, i) => weights.map((_, j) => j === i ? 1 : j === i + 1 ? .25 : 0));
  const matrix = weights.map((_, i) => weights.map((_, j) => weights.reduce((s, m, k) => s + m * transform[k][i] * transform[k][j], 0)));
  const physicalV = weights.map((_, i) => -.1 - .03 * i), v = [...physicalV];
  for (let i = n - 2; i >= 0; i--) v[i] -= .25 * v[i + 1];
  const contacts: NormalContact[] = transform.map((normal, i) => ({ id: `floor-${i}`, gap: q => normal.reduce((s, x, j) => s + x * q[j], 0), gradient: () => normal, timeDerivative: () => 0, accelerationBias: () => 0 }));
  const definition = masses(weights, contacts); definition.mass = () => matrix;
  const physicalF = weights.map(m => -.3 * m), force = weights.map((_, i) => weights.reduce((s, _, k) => s + transform[k][i] * physicalF[k], 0));
  const system = new UnilateralSystem(definition, { q: zero(n), v });
  const result = system.step(.02, force); assert.equal(result.events.length, 1);
  for (let i = 0; i < n; i++) {
    near(system.q[i], 0, 1e-12); near(system.v[i], 0, 1e-12);
    near(result.events[0].contacts[i].impulse, -weights[i] * physicalV[i], 1e-10);
    near(result.contacts[i].reaction, -physicalF[i], 1e-10);
    near(result.supportImpulses[`floor-${i}`], -.02 * physicalF[i], 1e-10);
  }
  near(system.account.impactLoss, weights.reduce((s, m, i) => s + .5 * m * physicalV[i] ** 2, 0), 1e-10);
  near(system.account.residual, 0, 1e-10);
  assert.throws(() => new UnilateralSystem(masses(Array(52).fill(1)), { q: zero(52), v: zero(52) }), /1–51/);
});

test('six-coordinate coupled inertia is supported and invalid physical state is rejected', () => {
  const system = new UnilateralSystem(masses([1, 2, 3, 4, 5, 6]), { q: zero(6), v: [1, 2, 3, 4, 5, 6] });
  system.step(.01); system.q.forEach((q, i) => near(q, (i + 1) * .01));
  const copy = system.q as number[]; copy[0] = 99; near(system.q[0], .01);
  assert.throws(() => new UnilateralSystem({ ...masses([1, 1]), mass: () => [[1, 2], [2, 1]] }, { q: [0, 0], v: [0, 0] }), /positive definite/);
  assert.throws(() => new UnilateralSystem(masses([1, 1], [push]), { q: [1, 0], v: [0, 0] }), /penetrates/);
  assert.throws(() => new UnilateralSystem(masses([1]), { q: [0], v: [1] }, { coordinateScales: [0] }), /options/);
  const poweredDamping = masses([1]); poweredDamping.damping = (_q, v) => [v[0]];
  assert.throws(() => new UnilateralSystem(poweredDamping, { q: [0], v: [1] }).step(.01), /positive power/);
});
