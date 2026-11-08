import assert from 'node:assert/strict';
import test from 'node:test';
import { ESTIMATED_PRINT_MATERIAL, evaluatePrintMaterial, PressureExposure, type PrintMaterialParameters } from '../src/mechanism/print-material';

const near = (actual: number, expected: number, tolerance = 1e-12) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} (tolerance ${tolerance})`);
const p: PrintMaterialParameters = { stiffness: 1200, exponent: 1, damping: .5, area: .001 };

test('Hunt–Crossley force, potential, local loss and declared-area pressure match independent analytic values', () => {
  const value = evaluatePrintMaterial(.002, .4, p);
  near(value.elasticForce, 2.4); near(value.normalForce, 2.88); near(value.dissipativeForce, .48);
  near(value.storedEnergy, .0024); near(value.lossRate, .192); near(value.pressure, 2880, 1e-9);
  const cubic = evaluatePrintMaterial(.003, 0, { ...p, stiffness: 9e8, exponent: 3 });
  near(cubic.normalForce, 24.3); near(cubic.storedEnergy, .018225); assert.equal(cubic.lossRate, 0);
  assert.equal(ESTIMATED_PRINT_MATERIAL.area, .0019 * .0026);
  assert.equal(Object.isFrozen(ESTIMATED_PRINT_MATERIAL), true);
});

test('the stack cannot attract a separating face or exert force outside contact', () => {
  for (const indentation of [-.01, -Number.MIN_VALUE, 0]) for (const speed of [-100, 0, 100]) {
    assert.deepEqual(evaluatePrintMaterial(indentation, speed, p), { normalForce: 0, elasticForce: 0, dissipativeForce: 0, storedEnergy: 0, lossRate: 0, pressure: 0 });
  }
  for (const speed of [-2, -3, -100]) {
    const value = evaluatePrintMaterial(.002, speed, p);
    assert.equal(value.normalForce, 0); assert.equal(value.pressure, 0); near(value.dissipativeForce, -2.4);
    near(value.storedEnergy, .0024); near(value.lossRate, -2.4 * speed);
  }
  const unloading = evaluatePrintMaterial(.002, -1, p); near(unloading.normalForce, 1.2); near(unloading.lossRate, 1.2);
});

test('loading and unloading remain non-tensile and passive across independent parameter/velocity sweeps', () => {
  for (const exponent of [.5, 1, 1.5, 2.5]) for (const damping of [0, .03, .5, 3]) {
    for (const indentation of [1e-7, 17e-6, 80e-6, .001]) for (const speed of [-100, -3, -1, -.01, 0, .01, 1, 100]) {
      const value = evaluatePrintMaterial(indentation, speed, { stiffness: 5e6, exponent, damping, area: 4e-6 });
      assert.ok(value.normalForce >= 0); assert.ok(value.storedEnergy >= 0); assert.ok(value.lossRate >= 0);
      near(value.lossRate, (value.normalForce - value.elasticForce) * speed, 1e-10);
      if (damping === 0) { assert.equal(value.normalForce, value.elasticForce); assert.equal(value.lossRate, 0); }
    }
  }
});

test('stiffness scales work/force, area only scales pressure, and parameters are never mutated', () => {
  const parameters = { ...ESTIMATED_PRINT_MATERIAL }, saved = { ...parameters };
  const a = evaluatePrintMaterial(80e-6, .6, parameters), twice = evaluatePrintMaterial(80e-6, .6, { ...parameters, stiffness: parameters.stiffness * 2 });
  for (const name of ['normalForce', 'elasticForce', 'dissipativeForce', 'storedEnergy', 'lossRate', 'pressure'] as const) near(twice[name], 2 * a[name], Math.abs(a[name]) * 1e-12);
  const largerArea = evaluatePrintMaterial(80e-6, .6, { ...parameters, area: parameters.area * 2 });
  near(largerArea.pressure, a.pressure / 2); near(largerArea.storedEnergy, a.storedEnergy); near(largerArea.normalForce, a.normalForce); assert.deepEqual(parameters, saved);
});

test('stored-energy gradients supply the same elastic reaction for conservative coupling', () => {
  for (const exponent of [.6, 1, 1.5, 2]) for (const depth of [30e-6, 80e-6]) {
    const parameters = { ...ESTIMATED_PRINT_MATERIAL, exponent }, h = depth * 1e-5;
    const derivative = (evaluatePrintMaterial(depth + h, 0, parameters).storedEnergy - evaluatePrintMaterial(depth - h, 0, parameters).storedEnergy) / (2 * h);
    const force = evaluatePrintMaterial(depth, 0, parameters).elasticForce;
    near(derivative, force, force * 1e-8);
  }
});

test('invalid stiffness/exponent/area/speed and non-finite computed responses fail explicitly', () => {
  for (const name of ['stiffness', 'exponent', 'area'] as const) for (const bad of [0, -1, NaN, Infinity]) assert.throws(() => evaluatePrintMaterial(1e-4, 1, { ...p, [name]: bad }), RangeError);
  for (const bad of [-1, NaN, Infinity]) assert.throws(() => evaluatePrintMaterial(1e-4, 1, { ...p, damping: bad }), RangeError);
  for (const bad of [NaN, Infinity, -Infinity]) { assert.throws(() => evaluatePrintMaterial(bad, 0, p), RangeError); assert.throws(() => evaluatePrintMaterial(0, bad, p), RangeError); }
  assert.throws(() => evaluatePrintMaterial(1e200, 1, { ...p, exponent: 2 }), /Computed/);
  assert.throws(() => evaluatePrintMaterial(.1, 1, { ...p, area: Number.MIN_VALUE }), /Computed/);
});

function rampWork(speed: number, start: number, end: number, parameters: PrintMaterialParameters, steps: number) {
  const duration = (end - start) / speed, h = duration / steps;
  let work = 0, loss = 0;
  for (let i = 0; i <= steps; i++) {
    const indentation = Math.max(0, start + (end - start) * i / steps), response = evaluatePrintMaterial(indentation, speed, parameters), weight = i === 0 || i === steps ? .5 : 1;
    work += weight * h * response.normalForce * speed; loss += weight * h * response.lossRate;
  }
  return { work, loss };
}

test('independent work quadrature accounts for loading, ordinary unloading and cutoff energy loss', () => {
  const parameters = { stiffness: 4e6, exponent: 1.5, damping: .8, area: 5e-6 }, depth = 100e-6;
  const potential = parameters.stiffness * depth ** 2.5 / 2.5;
  const loading = rampWork(.5, 0, depth, parameters, 4096);
  near(loading.work, 1.4 * potential, potential * 1e-7); near(loading.loss, .4 * potential, potential * 1e-7); near(loading.work, potential + loading.loss, potential * 1e-7);
  const unloading = rampWork(-.5, depth, 0, parameters, 4096);
  near(unloading.work, -.6 * potential, potential * 1e-7); near(unloading.loss, .4 * potential, potential * 1e-7);
  near(loading.work + unloading.work, loading.loss + unloading.loss, potential * 1e-12);
  const fast = rampWork(-2, depth, 0, parameters, 4096);
  assert.equal(fast.work, 0); near(fast.loss, potential, potential * 1e-7);
});

test('finite-difference closing-speed refinement converges to analytic dissipated work', () => {
  // δ=D sin(πt/T), n=2, no cutoff: integral αk δ² δdot² dt = αkD⁴π²/(8T).
  const depth = 80e-6, duration = .001, parameters = { stiffness: 1e11, exponent: 2, damping: .3, area: 5e-6 };
  const exact = parameters.damping * parameters.stiffness * depth ** 4 * Math.PI ** 2 / (8 * duration), errors: number[] = [];
  for (const steps of [16, 32, 64]) {
    const h = duration / steps; let loss = 0;
    for (let i = 0; i < steps; i++) {
      const t = (i + .5) * h, indentation = depth * Math.sin(Math.PI * t / duration);
      const speed = depth * (Math.sin(Math.PI * (t + h / 2) / duration) - Math.sin(Math.PI * (t - h / 2) / duration)) / h;
      loss += evaluatePrintMaterial(indentation, speed, parameters).lossRate * h;
    }
    errors.push(Math.abs(loss - exact));
  }
  assert.ok(errors[0] / errors[1] > 3.9); assert.ok(errors[1] / errors[2] > 3.9); assert.ok(errors[2] < exact * .00021);
});

test('pressure exposure integrates supplied pulse area and retains a fixed material anchor', () => {
  const exposure = new PressureExposure(), sample = { time: 0, u: .02, v: .03, pressure: 0 };
  exposure.add(sample); sample.u = 99; exposure.add({ time: .002, u: .02, v: .03, pressure: 1e6 }); exposure.add({ time: .004, u: .02, v: .03, pressure: 0 });
  const result = exposure.finish(); near(result.pressureTime, 2000); near(result.excessPressureTime, 2000); assert.deepEqual(result.centroid, { u: .02, v: .03 });
  assert.deepEqual(result.covariance, { uu: 0, uv: 0, vv: 0 }); assert.equal(result.rmsRadius, 0); assert.equal(result.maxSampleGap, .002);
  assert.equal(result.observedRefinement.comparisons, 1); near(result.observedRefinement.pressureTimeDifference, 2000); assert.equal(result.interpolationErrorBound, null);
  assert.equal(result.finished, true); assert.equal(Object.isFrozen(result), true); assert.equal(Object.isFrozen(result.centroid), true);
});

test('moving material footprint moments match analytic uniform and linearly weighted paths', () => {
  const uniform = new PressureExposure(); uniform.add({ time: 0, u: .01, v: .02, pressure: 2e5 }); uniform.add({ time: .01, u: .013, v: .016, pressure: 2e5 });
  const a = uniform.finish(); near(a.pressureTime, 2000); near(a.centroid!.u, .0115); near(a.centroid!.v, .018);
  near(a.covariance.uu, .003 ** 2 / 12, 1e-18); near(a.covariance.vv, .004 ** 2 / 12, 1e-18); near(a.covariance.uv, -.003 * .004 / 12, 1e-18); near(a.rmsRadius, .005 / Math.sqrt(12));
  const linear = new PressureExposure(); linear.add({ time: 0, u: .01, v: .02, pressure: 0 }); linear.add({ time: .01, u: .013, v: .026, pressure: 2e5 });
  const b = linear.finish(); near(b.excessPressureTime, 1000); near(b.centroid!.u, .012); near(b.centroid!.v, .024);
  near(b.covariance.uu, .003 ** 2 / 18, 1e-18); near(b.covariance.uv, .003 * .006 / 18, 1e-18); near(b.covariance.vv, .006 ** 2 / 18, 1e-18);
});

test('declared transfer thresholds split linear crossings without reducing the raw normal-pressure integral', () => {
  for (const rising of [true, false]) {
    const exposure = new PressureExposure({ pressureThreshold: 1e6 });
    exposure.add({ time: 0, u: 0, v: .02, pressure: rising ? 0 : 2e6 }); exposure.add({ time: .002, u: .006, v: .02, pressure: rising ? 2e6 : 0 });
    const result = exposure.finish(); near(result.pressureTime, 2000); near(result.excessPressureTime, 500); near(result.centroid!.u, .006 * (rising ? 5 / 6 : 1 / 6)); near(result.centroid!.v, .02);
    near(result.covariance.uu, .006 ** 2 / 72, 1e-18); assert.equal(result.interpolationErrorBound, null);
  }
  const below = new PressureExposure({ pressureThreshold: 2e6 }); below.add({ time: 0, u: 0, v: 0, pressure: 1e6 }); below.add({ time: .01, u: 1, v: 1, pressure: 1e6 });
  const result = below.finish(); near(result.pressureTime, 10000); assert.equal(result.excessPressureTime, 0); assert.equal(result.centroid, null); assert.equal(result.rmsRadius, 0);
});

test('same-time pressure limits add zero exposure and use the right limit after a rigid impact', () => {
  const exposure = new PressureExposure();
  exposure.add({ time: 0, u: 0, v: 0, pressure: 100 }); exposure.add({ time: .1, u: .001, v: 0, pressure: 100 });
  const before = exposure.summary(); exposure.add({ time: .1, u: .001, v: 0, pressure: 300 }); const jump = exposure.summary();
  assert.equal(jump.pressureTime, before.pressureTime); assert.equal(jump.excessPressureTime, before.excessPressureTime); assert.deepEqual(jump.centroid, before.centroid);
  exposure.add({ time: .2, u: .002, v: 0, pressure: 300 }); const result = exposure.finish(); near(result.pressureTime, 40); near(result.excessPressureTime, 40); near(result.centroid!.u, .00125);
  assert.equal(result.observedRefinement.comparisons, 0, 'Never interpolate a coarse comparison across a pressure jump');
});

test('exposure sampling converges to independent smooth pressure/trajectory moments', () => {
  // x=t/T; P=4P0(x−x²), u=D x². Exact mean u=.3D and variance=37D²/700.
  const duration = .01, pressure = 1e6, travel = .005, exactExposure = 2 * pressure * duration / 3, errors: number[] = [];
  for (const count of [8, 16, 32, 64]) {
    const exposure = new PressureExposure();
    for (let i = 0; i <= count; i++) { const x = i / count; exposure.add({ time: duration * x, u: travel * x * x, v: .03, pressure: 4 * pressure * (x - x * x) }); }
    const result = exposure.finish(); errors.push(Math.abs(result.excessPressureTime - exactExposure));
    near(result.centroid!.u, .3 * travel, travel / (count * count)); near(result.covariance.uu, 37 * travel ** 2 / 700, travel ** 2 / (count * count));
    assert.ok(result.observedRefinement.excessPressureTimeDifference > 0); assert.equal(result.interpolationErrorBound, null);
  }
  for (let i = 1; i < errors.length; i++) near(errors[i - 1] / errors[i], 4, 1e-8);
});

test('unsupplied pressure history remains unknown rather than creating an inferred contact event', () => {
  const coarse = new PressureExposure(); coarse.add({ time: 0, u: 0, v: 0, pressure: 0 }); coarse.add({ time: .01, u: .001, v: 0, pressure: 0 });
  const result = coarse.finish(); assert.equal(result.pressureTime, 0); assert.equal(result.centroid, null); assert.equal(result.observedRefinement.comparisons, 0); assert.equal(result.interpolationErrorBound, null);
  // The same endpoints could hide a pulse. It is counted only when supplied.
  const observed = new PressureExposure(); observed.add({ time: 0, u: 0, v: 0, pressure: 0 }); observed.add({ time: .005, u: .0005, v: 0, pressure: 1e6 }); observed.add({ time: .01, u: .001, v: 0, pressure: 0 });
  near(observed.finish().pressureTime, 5000);
});

test('episode limits, input validity and finalization fail without corrupting accumulated exposure', () => {
  for (const options of [{ pressureThreshold: -1 }, { pressureThreshold: Infinity }, { maxSamples: 0 }, { maxSamples: 2.5 }, { maxDuration: 0 }, { maxDuration: NaN }]) assert.throws(() => new PressureExposure(options), RangeError);
  const exposure = new PressureExposure({ maxSamples: 3, maxDuration: .1 }); exposure.add({ time: 0, u: 0, v: 0, pressure: 100 });
  for (const bad of [
    { time: -1, u: 0, v: 0, pressure: 100 }, { time: 0, u: .001, v: 0, pressure: 100 }, { time: .01, u: 0, v: 0, pressure: -1 },
    { time: .01, u: NaN, v: 0, pressure: 1 }, { time: .01, u: 0, v: Infinity, pressure: 1 }, { time: Infinity, u: 0, v: 0, pressure: 1 },
    { time: .11, u: 0, v: 0, pressure: 100 },
  ]) { const before = exposure.summary(); assert.throws(() => exposure.add(bad), RangeError); assert.deepEqual(exposure.summary(), before); }
  exposure.add({ time: .05, u: 0, v: 0, pressure: 0 }); exposure.add({ time: .1, u: 0, v: 0, pressure: 100 });
  assert.throws(() => exposure.add({ time: .1, u: 0, v: 0, pressure: 100 }), /sample limit/);
  const result = exposure.finish(); assert.equal(result.samples, 3); assert.equal(result.limits.maxSamples, 3); assert.equal(result.limits.maxDuration, .1); assert.ok(result.pressureTime > 0);
  assert.throws(() => exposure.add({ time: .1, u: 0, v: 0, pressure: 0 }), /finished/); assert.deepEqual(exposure.finish(), result);
  const overflow = new PressureExposure({ maxDuration: 10 }); overflow.add({ time: 0, u: 0, v: 0, pressure: 1e308 }); const before = overflow.summary();
  assert.throws(() => overflow.add({ time: 10, u: 1, v: 1, pressure: 1e308 }), /Computed/); assert.deepEqual(overflow.summary(), before);
});

test('P2-MAT-001: finite raw moments with overflowing normalized covariance reject atomically', () => {
  for (const extreme of [{ u: 1e200, v: 0 }, { u: 0, v: 1e200 }, { u: 1e200, v: -1e200 }]) {
    const exposure = new PressureExposure(), control = new PressureExposure();
    for (const sample of [{ time: 0, u: 0, v: 0, pressure: 1e-100 }, { time: .02, u: .01, v: .02, pressure: 1e-100 }]) {
      exposure.add(sample); control.add(sample);
    }
    const before = exposure.summary();
    assert.throws(() => exposure.add({ time: .1, ...extreme, pressure: 1e-100 }), /Computed pressure covariance/);
    assert.deepEqual(exposure.summary(), before);
    // This earlier valid time also checks that the rejected sample did not
    // advance the previous sample, coarse comparison, counts or episode clock.
    const next = { time: .04, u: .02, v: .01, pressure: 2e-100 };
    exposure.add(next); control.add(next);
    assert.deepEqual(exposure.finish(), control.finish());
  }
});

test('finish leaves the episode open if producing its summary fails', () => {
  class FailingSummaryExposure extends PressureExposure {
    failSummary = true;
    override summary() {
      if (this.failSummary) throw new RangeError('Injected summary failure');
      return super.summary();
    }
  }
  const exposure = new FailingSummaryExposure();
  exposure.add({ time: 0, u: 0, v: 0, pressure: 100 });
  assert.throws(() => exposure.finish(), /Injected summary failure/);
  exposure.failSummary = false;
  assert.equal(exposure.summary().finished, false);
  exposure.add({ time: .1, u: .01, v: 0, pressure: 100 });
  const result = exposure.finish(); assert.equal(result.finished, true); assert.equal(result.pressureTime, 10);
  assert.equal(Object.isFrozen(result), true); assert.deepEqual(exposure.finish(), result);
});
