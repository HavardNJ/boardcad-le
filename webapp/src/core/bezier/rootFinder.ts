const ROOTFINDER_VALUE_TOLERANCE = 0.005;
const SECANT_MAX_ITERATIONS = 50;
const BISECT_MAX_ITERATIONS = 50;

export type Fn = (x: number) => number;

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function secantRoot(f: Fn, target: number, minLimit: number, maxLimit: number): number {
  const valueAtMin = f(minLimit);
  const valueAtMax = f(maxLimit);

  let x = (target - valueAtMin) / (valueAtMax - valueAtMin);
  x = clamp(x, minLimit, maxLimit);

  let lastX = x + (maxLimit - minLimit) / 10.0;
  if (lastX > maxLimit) lastX = x - (maxLimit - minLimit) / 10.0;

  let currentValue = f(x);
  let lastValue = f(lastX);
  let currentError = target - currentValue;

  let n = 0;
  while (Math.abs(currentError) > ROOTFINDER_VALUE_TOLERANCE && n++ < SECANT_MAX_ITERATIONS && currentValue !== lastValue) {
    const d = ((x - lastX) / (currentValue - lastValue)) * currentError;
    lastX = x;
    x = x + d;
    x = clamp(x, minLimit, maxLimit);
    lastValue = currentValue;
    currentValue = f(x);
    currentError = target - currentValue;
  }

  return x;
}

function bisectRoot(f: Fn, target: number, minLimit: number, maxLimit: number): number {
  let n = 0;
  let lt = minLimit;
  let ht = maxLimit;
  let lError = f(lt) - target;

  let currentError = 100000000;
  let x = 0;
  while (Math.abs(currentError) > ROOTFINDER_VALUE_TOLERANCE && n++ < BISECT_MAX_ITERATIONS && ht - lt > 0.0001) {
    x = (ht + lt) / 2.0;
    const currentValue = f(x);
    currentError = currentValue - target;

    if (currentError * lError < 0.0) {
      ht = x;
    } else {
      lt = x;
      lError = currentError;
    }
  }
  return x;
}

/** Port of MathUtils.RootFinder.getRoot(Function, targetValue, minLimit, maxLimit). */
export function getRoot(f: Fn, targetValue: number, minLimit = 0.0, maxLimit = 1.0): number {
  const x = secantRoot(f, targetValue, minLimit, maxLimit);
  const secantActual = f(x);

  if (Math.abs(secantActual - targetValue) > ROOTFINDER_VALUE_TOLERANCE) {
    const bisectX = bisectRoot(f, targetValue, minLimit, maxLimit);
    const bisectActual = f(bisectX);

    if (Math.abs(bisectActual - targetValue) > ROOTFINDER_VALUE_TOLERANCE) {
      return Math.abs(bisectActual - targetValue) < Math.abs(secantActual - targetValue) ? bisectX : x;
    }
    return bisectX;
  }

  return x;
}
