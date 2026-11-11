// The solver is checked against closed-form mechanics before it is trusted with the typewriter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Body, Constraint, System } from '../src/sim/solver';
import { AppliedForce, CoordSpring, FnConstraint, Limit, PointCylinder, PointPlane, PointSpring, Rod } from '../src/sim/elements';
import type { Vec3 } from '../src/sim/vec';

const near = (a: number, b: number, tol: number, msg: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg}: got ${a}, expected ${b} ± ${tol}`);

test('pendulum: period matches the exact large-angle solution and energy is conserved', () => {
  const sys = new System();
  const L = 0.2, m = 0.05;
  // Hinge about +X at the origin, bob hanging down (-Y).
  const b = sys.addBody({ name: 'bob', kind: 'hinge', origin: [0, 0, 0], axis: [1, 0, 0], inertia: m * L * L, mass: m, com: [0, -L, 0] });
  const th0 = 0.5;
  b.q = th0;
  const e0 = sys.kinetic() + sys.potential();
  // Exact period via the arithmetic-geometric mean: T = 2π sqrt(L/g) / agm(1, cos(θ0/2)).
  let a = 1, g = Math.cos(th0 / 2);
  for (let i = 0; i < 20; i++) [a, g] = [(a + g) / 2, Math.sqrt(a * g)];
  const T = (2 * Math.PI * Math.sqrt(L / sys.gravity)) / a;
  // Time two successive upward zero crossings.
  let prev = b.q, t1 = NaN, t2 = NaN;
  while (sys.time < 3 * T) {
    sys.step();
    if (prev < 0 && b.q >= 0) {
      const tc = sys.time - (sys.h * b.q) / (b.q - prev);
      if (Number.isNaN(t1)) t1 = tc; else if (Number.isNaN(t2)) t2 = tc;
    }
    prev = b.q;
  }
  near(t2 - t1, T, T * 2e-4, 'period');
  const e1 = sys.kinetic() + sys.potential();
  near(e1, e0, Math.abs(m * sys.gravity * L) * 1e-3, 'energy');
});

test('rigid rod: a parallelogram four-bar stays closed and conserves energy', () => {
  const sys = new System();
  const L = 0.1, m = 0.02;
  const a = sys.addBody({ name: 'a', kind: 'hinge', origin: [0, 0, 0], axis: [1, 0, 0], inertia: m * L * L, mass: m, com: [0, -L, 0] });
  const b = sys.addBody({ name: 'b', kind: 'hinge', origin: [0, 0, 0.15], axis: [1, 0, 0], inertia: 3 * m * L * L, mass: 0, com: [0, 0, 0] });
  const rod = sys.add(new Rod(a, [0, -L, 0], b, [0, -L, 0.15], 0.15));
  a.q = 0.6; b.q = 0.6;
  const e0 = sys.kinetic() + sys.potential();
  let worst = 0;
  for (let i = 0; i < 40000; i++) {
    sys.step();
    worst = Math.max(worst, Math.abs(rod.value));
    assert.ok(Math.abs(a.q - b.q) < 1e-6, 'parallelogram keeps both cranks parallel');
  }
  assert.ok(worst < 1e-8, `rod length error stays below 10 nm (worst ${worst})`);
  near(sys.kinetic() + sys.potential(), e0, 2e-5 * Math.abs(e0) + 1e-7, 'energy');
  // The combined inertia is 4 m L², so the motion must be slower than the lone pendulum.
  assert.ok(Math.abs(a.q) <= 0.6 + 1e-6);
});

test('rigid stop: restitution sets the rebound height', () => {
  const sys = new System();
  const e = 0.6, drop = 0.02;
  const b = sys.addBody({ name: 'ball', kind: 'slide', axis: [0, 1, 0], inertia: 0.01, mass: 0.01, com: [0, 0, 0] });
  const stop = sys.add(new Limit(b, 0, 1));
  stop.restitution = e;
  b.q = drop;
  let peak = 0, bounced = false;
  for (let i = 0; i < 8000; i++) {
    sys.step();
    if (!bounced && b.v > 0) bounced = true;
    if (bounced) peak = Math.max(peak, b.q);
    assert.ok(b.q > -1e-9, 'never penetrates the stop');
  }
  near(peak, e * e * drop, drop * 0.01, 'rebound height = e² h');
});

test('compliant damped contact behaves as the equivalent spring-damper', () => {
  const sys = new System();
  sys.gravity = 0;
  const m = 0.003, k = 2.5e5, c = 12;
  const b = sys.addBody({ name: 'slug', kind: 'slide', axis: [1, 0, 0], inertia: m });
  const wall = sys.add(new Limit(b, 0, 1));
  wall.stiffness = k;
  wall.dampingCoef = c;
  const v0 = -3;
  b.q = 1e-5; b.v = v0;
  let maxPen = 0, maxF = 0, tIn = NaN, tOut = NaN;
  for (let i = 0; i < 4000 && Number.isNaN(tOut); i++) {
    sys.step();
    if (wall.active && Number.isNaN(tIn)) tIn = sys.time;
    if (!wall.active && !Number.isNaN(tIn) && b.v > 0) tOut = sys.time;
    maxPen = Math.min(maxPen, b.q);
    maxF = Math.max(maxF, wall.force);
  }
  // Under-damped oscillator: contact lasts until the force returns to zero.
  const w0 = Math.sqrt(k / m), zeta = c / (2 * Math.sqrt(k * m)), wd = w0 * Math.sqrt(1 - zeta * zeta);
  // Force k x + c v = 0 again at t* where tan(wd t*) = -2 zeta sqrt(1-zeta²) / (1 - 2 zeta²).
  const tStar = (Math.PI - Math.atan2(2 * zeta * Math.sqrt(1 - zeta * zeta), 1 - 2 * zeta * zeta)) / wd;
  const eExpected = Math.exp(-zeta * w0 * tStar);
  near(tOut - tIn, tStar, 2 * sys.h, 'contact duration (resolved to within two substeps)');
  near(b.v / -v0, eExpected, 0.03, 'effective restitution');
  near(-maxPen, (Math.abs(v0) / wd) * Math.exp((-zeta * w0 * Math.atan2(wd, zeta * w0)) / wd), 4e-5, 'peak indentation');
  assert.ok(maxF > 50 && maxF < 120, `a 3 m/s slug impact peaks at tens of newtons (${maxF.toFixed(0)} N)`);
});

test('spring oscillator: frequency and first-order convergence in the timestep', () => {
  const run = (h: number) => {
    const sys = new System();
    sys.h = h; sys.gravity = 0;
    const b = sys.addBody({ name: 'm', kind: 'slide', axis: [1, 0, 0], inertia: 0.2 });
    sys.addForce(new CoordSpring(b, 800));
    b.q = 0.01;
    const T = 2 * Math.PI * Math.sqrt(0.2 / 800);
    sys.advance(T);
    return { err: Math.abs(b.q - 0.01), sys };
  };
  const coarse = run(100e-6), fine = run(25e-6);
  assert.ok(fine.err < 2e-6, `returns to the start after one period (err ${fine.err})`);
  assert.ok(coarse.err > fine.err, 'smaller steps are more accurate');
});

test('point spring and applied force: work in equals energy stored', () => {
  const sys = new System();
  sys.gravity = 0;
  const b = sys.addBody({ name: 'lever', kind: 'hinge', origin: [0, 0, 0], axis: [1, 0, 0], inertia: 1e-4, damping: 2e-3 });
  const spring = sys.addForce(new PointSpring(b, [0, 0, 0.1], null, [0, 0.05, 0.1], 200, 0.05));
  const push = sys.addForce(new AppliedForce(b, [0, 0, 0.2]));
  push.set([0, -1.5, 0]);
  // Ledger: every joule the push puts in is either stored (spring, motion) or was turned to heat by the damper.
  let heat = 0;
  for (let i = 0; i < 60000; i++) { sys.step(); heat += b.damping * b.v * b.v * sys.h; }
  assert.ok(Math.abs(b.v) < 1e-3, 'settles');
  const stored = sys.potential();
  near(push.work, stored + sys.kinetic() + heat, 2e-3 * push.work, 'work in = energy stored + energy dissipated');
  // Viscous damping removed the difference; at rest, torque balance must hold.
  const A: [number, number, number] = [0, 0, 0], B: [number, number, number] = [0, 0, 0];
  spring.ends(A, B);
  const tSpring = spring.tension * ((A[2] * (B[1] - A[1]) - A[1] * (B[2] - A[2])) / spring.length);
  const P = b.world([0, 0, 0.2]);
  const tPush = P[2] * 1.5;
  near(tSpring, tPush, 2e-4, 'static torque balance');
  assert.ok(push.work > stored && stored > 0.25 * push.work, `work ${push.work} J, stored ${stored} J`);
});

// --- Constraint gradients ------------------------------------------------------------------------
// Every element reports dC/dq for each body it touches. If one were wrong the solver would still "work"
// but push parts in the wrong direction; so each is compared with a numerical derivative, on bodies that
// ride on other bodies the way the platen rides on the shift cradle on the carriage.

function lcg(seed: number): () => number {
  let x = seed >>> 0;
  return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296 - 0.5; };
}

test('gradients of rod, point-plane and point-cylinder constraints match finite differences on chains of bodies', () => {
  const rnd = lcg(7);
  const vec = (scale = 0.1): Vec3 => [rnd() * scale, rnd() * scale, rnd() * scale];
  const unit = (): Vec3 => { const v = vec(1); const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
  let checked = 0, worst = 0;
  for (let trial = 0; trial < 30; trial++) {
    const sys = new System();
    const mk = (kind: 'hinge' | 'slide', parent?: Body): Body => sys.addBody({ name: 'b' + sys.bodies.length, kind, parent, origin: vec(), axis: unit(), inertia: 1 });
    const carriage = mk('slide'), cradle = mk('slide', carriage), platen = mk('hinge', cradle), lever = mk('hinge', cradle), crank = mk('hinge'), bar = mk('hinge', crank);
    const bodies = [carriage, cradle, platen, lever, crank, bar];
    const pick = (): Body => bodies[Math.floor((rnd() + 0.5) * bodies.length)];
    const rodT = new Rod(pick(), vec(), pick(), vec(), 0.05);
    rodT.mode = 'tension';
    const cons: Constraint[] = [
      new Rod(bar, vec(), platen, vec(), 0.05), new Rod(pick(), vec(), null, vec(), 0.03), rodT,
      new PointPlane(lever, vec(), platen, vec(), unit()), new PointPlane(pick(), vec(), null, vec(), unit()), new PointPlane(bar, vec(), carriage, vec(), unit()),
      new PointCylinder(bar, vec(), platen, vec(), unit(), 0.016), new PointCylinder(lever, vec(), null, vec(), unit(), 0.01), new PointCylinder(platen, vec(), crank, vec(), unit(), 0.02),
    ];
    for (const b of bodies) b.q = rnd() * (b.kind === 'hinge' ? 2 : 0.1);
    for (const c of cons) {
      c.eval();
      const grad = new Map<Body, number>();
      for (let i = 0; i < c.n; i++) grad.set(c.gb[i], c.gv[i]);
      for (const b of bodies) {
        const q = b.q, eps = 1e-6;
        b.q = q + eps; const hi = c.eval();
        b.q = q - eps; const lo = c.eval();
        b.q = q;
        const numeric = (hi - lo) / (2 * eps), stated = grad.get(b) ?? 0;
        worst = Math.max(worst, Math.abs(numeric - stated));
        assert.ok(Math.abs(numeric - stated) < 1e-7 + 1e-6 * Math.abs(numeric), `${c.constructor.name} trial ${trial}, body ${b.name}: stated ${stated}, numerical ${numeric}`);
        checked++;
      }
    }
  }
  assert.ok(checked === 30 * 9 * 6 && worst < 1e-7, `${checked} derivatives, worst difference ${worst.toExponential(1)}`);
});

test('two bodies colliding: momentum is kept and the bounce is the coefficient of restitution times the approach', () => {
  for (const [m1, m2, v1, v2, e] of [[0.02, 0.005, 1.5, -0.4, 0.5], [1.3, 0.0015, 0.2, 0, 0], [0.004, 0.3, 2, 0.5, 0.9]] as number[][]) {
    const sys = new System();
    sys.gravity = 0;
    const a = sys.addBody({ name: 'a', kind: 'slide', axis: [1, 0, 0], inertia: m1 });
    const b = sys.addBody({ name: 'b', kind: 'slide', axis: [1, 0, 0], inertia: m2 });
    // b starts 5 mm ahead of a and must stay ahead of it.
    const touch = sys.add(new FnConstraint((c) => { c.coord(b, 1); c.coord(a, -1); return b.q - a.q + 0.005; }));
    touch.restitution = e;
    a.v = v1; b.v = v2;
    sys.advance(0.05);
    const p = m1 * v1 + m2 * v2, approach = v1 - v2;
    near(m1 * a.v + m2 * b.v, p, 1e-9 + 1e-9 * Math.abs(p), 'momentum');
    near(b.v - a.v, e * approach, 1e-9 + 1e-6 * approach, 'separation speed = e x approach speed');
    near(a.v, (p - m2 * e * approach) / (m1 + m2), 1e-9 + 1e-6 * Math.abs(v1), 'velocity of the striking body');
    assert.ok(b.q - a.q + 0.005 > -1e-12, 'they never pass through each other');
  }
});

test('dry friction: holds a body still below the friction force, and stops a sliding one for good', () => {
  const sys = new System();
  sys.gravity = 0;
  const m = 0.4, Ff = 0.25;
  const b = sys.addBody({ name: 'block', kind: 'slide', axis: [1, 0, 0], inertia: m, friction: Ff });
  const push = sys.addForce(new AppliedForce(b, [0, 0, 0]));
  // Pushed with less than the friction force it does not creep at all.
  push.set([0.8 * Ff, 0, 0]);
  sys.advance(0.5);
  assert.equal(b.q, 0);
  assert.equal(b.v, 0);
  // Pushed harder it accelerates at (F - Ff) / m.
  push.set([3 * Ff, 0, 0]);
  sys.advance(0.2);
  near(b.v, ((3 * Ff - Ff) / m) * 0.2, 1e-9, 'speed after 0.2 s');
  // Let go, it slides to rest in v² m / (2 Ff) and then stays exactly still (no chatter about zero).
  push.set([0, 0, 0]);
  const v0 = b.v, q0 = b.q;
  sys.advance((v0 * m) / Ff + 0.01);
  assert.equal(b.v, 0);
  near(b.q - q0, (v0 * v0 * m) / (2 * Ff), 2 * v0 * sys.h, 'stopping distance');
  const rest = b.q;
  sys.advance(0.5);
  assert.equal(b.q, rest);
});
