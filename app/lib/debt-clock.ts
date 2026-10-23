import type { MetricModel } from "./metrics-types.ts";

const ZERO = BigInt(0);
const ONE = BigInt(1);
const MICRO = BigInt(1_000_000);
const micros = (ms: number) => BigInt(Math.round(ms * 1000));
const abs = (value: bigint) => (value < ZERO ? -value : value);
const ceilDivide = (a: bigint, b: bigint) => (a + b - ONE) / b;

/** Dollars are rounded once at the source boundary; interpolation retains microdollars. */
export class DebtClock {
  private start: bigint;
  private end: bigint;
  private anchor: number;
  private duration: bigint;
  private offset = ZERO;
  private revisionAt: number;
  private revisionDuration = ZERO;
  readonly static: boolean;

  constructor(model: MetricModel, now: number, previous?: bigint) {
    this.start = BigInt(Math.round(model.start)) * MICRO;
    this.end = BigInt(Math.round(model.end)) * MICRO;
    this.anchor = Date.UTC(model.year, 0, 1);
    this.duration = micros(Date.UTC(model.year + 1, 0, 1) - this.anchor);
    this.static = model.historical || this.start === this.end;
    this.revisionAt = now;
    if (previous !== undefined && !this.static) {
      this.offset = previous - this.target(now);
      // Removing this offset must never overpower the source trend. A large
      // revision takes longer, rather than making an increasing balance reverse.
      const bounded = ceilDivide(
        BigInt(2) * abs(this.offset) * this.duration,
        abs(this.end - this.start),
      );
      this.revisionDuration =
        bounded > micros(60_000) ? bounded : micros(60_000);
    }
  }
  private target(now: number): bigint {
    if (this.static) return this.end;
    return (
      this.start +
      ((this.end - this.start) * micros(now - this.anchor)) / this.duration
    );
  }
  value(now: number): bigint {
    const elapsed = micros(Math.max(0, now - this.revisionAt));
    const remaining =
      this.revisionDuration > elapsed ? this.revisionDuration - elapsed : ZERO;
    return (
      this.target(now) +
      (this.revisionDuration > ZERO
        ? (this.offset * remaining) / this.revisionDuration
        : ZERO)
    );
  }
  reconciling(now: number) {
    return (
      this.offset !== ZERO &&
      micros(Math.max(0, now - this.revisionAt)) < this.revisionDuration
    );
  }
}
const formatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export function formatDebt(value: bigint) {
  // Monetary balances are nonnegative; retain mathematical floor for test fixtures too.
  const dollars = value >= ZERO ? value / MICRO : -ceilDivide(-value, MICRO);
  return formatter.format(dollars);
}

/** Wall time is consulted only at anchoring/resume, never for visible frame deltas. */
export class MonotonicClock {
  private epoch: number;
  private anchor: number;
  constructor(epoch: number, monotonic: number) {
    this.epoch = epoch;
    this.anchor = monotonic;
  }
  now(monotonic: number) {
    return this.epoch + Math.max(0, monotonic - this.anchor);
  }
  resume(wall: number, monotonic: number) {
    this.epoch = Math.max(this.now(monotonic), wall);
    this.anchor = monotonic;
  }
}
