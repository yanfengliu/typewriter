/** Safeguarded false-position search. No state is interpolated:
 * every oracle sample must be a complete integration from the same start. */
export function scalarCrossing<T>(lower: number, upper: number, fLower: number, fUpper: number, upperValue: T,
  evaluate: (duration: number) => { value: T; scalar: number }) {
  const resolution = (upper - lower) * 2 ** -42;
  if (!(lower < upper && fLower > 0 && fUpper <= 0)) throw new Error('Invalid continuous crossing bracket');
  let lo = lower, hi = upper, fl = fLower, fh = fUpper, wl = fl, wh = fh, value = upperValue;
  let side = 0, nearZeroProbes = 0, count = 0, previousWidth = hi - lo, slow = 0;
  for (; count < 96 && hi - lo > resolution; count++) {
    const width = hi - lo, mid = lo + width / 2;
    if (mid === lo || mid === hi) break;
    let trial = lo + width * (wl / (wl - wh));
    // An exact zero may have a wide opposite bracket. Check the required
    // lower resolution directly; a zero plateau still requires localization.
    if (fh === 0 && nearZeroProbes < 2) { trial = hi - resolution; nearZeroProbes++; }
    else if (slow >= 2 || !(trial > lo && trial < hi) || !Number.isFinite(trial)) trial = mid;
    if (!(trial > lo && trial < hi)) trial = mid;
    const sample = evaluate(trial), f = sample.scalar;
    if (!Number.isFinite(f)) throw new Error('Nonfinite crossing sample');
    if (f <= 0) {
      hi = trial; fh = f; wh = f; value = sample.value;
      wl = side === -1 ? wl / 2 : fl; side = -1;
    } else {
      lo = trial; fl = f; wl = f;
      wh = side === 1 ? wh / 2 : fh; side = 1;
    }
    slow = hi - lo > previousWidth * .6 ? slow + 1 : 0;
    previousWidth = hi - lo;
  }
  // Any unusual scalar shape falls back to the original bisection mechanism.
  // These extra samples never loosen the initial 42-bisection resolution.
  while (hi - lo > resolution) {
    const mid = lo + (hi - lo) / 2; if (mid === lo || mid === hi) break;
    const sample = evaluate(mid); count++;
    if (!Number.isFinite(sample.scalar)) throw new Error('Nonfinite crossing sample');
    if (sample.scalar <= 0) { hi = mid; value = sample.value; } else lo = mid;
  }
  return { lower: lo, upper: hi, value, evaluations: count, resolution };
}
