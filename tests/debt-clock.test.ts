import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DebtClock,
  formatDebt,
  MonotonicClock,
} from "../app/lib/debt-clock.ts";
import type { MetricModel } from "../app/lib/metrics-types.ts";
const epoch = Date.UTC(2024, 0, 1);
const duration = Date.UTC(2025, 0, 1) - epoch;
const micro = BigInt(1_000_000);
function model(rate = 1_000_000, offset = 0): MetricModel {
  const start = 38_500_000_000_000 + offset;
  return {
    year: 2024,
    start,
    end: start + (rate * duration) / 1000,
    annual: (rate * duration) / 1000,
    kind: "stock",
    historical: false,
    forecast: true,
    population: null,
    populationYear: null,
    rate: null,
    normalized: null,
    normalizedUnit: "",
  };
}
test("debt has exact elapsed-time values independent of 60/120 Hz sampling", () => {
  const clock = new DebtClock(model(), epoch);
  for (const hz of [60, 120]) {
    let previous = clock.value(epoch);
    for (let frame = 1; frame <= hz * 2; frame++) {
      const value = clock.value(epoch + (frame * 1000) / hz);
      assert.ok(value > previous);
      previous = value;
    }
    assert.equal(previous, BigInt(38_500_002_000_000) * micro);
  }
  assert.equal(clock.value(epoch + 0.125), BigInt(38_500_000_000_125) * micro);
});
test("formatting preserves exact large integer carries and separators", () => {
  assert.equal(formatDebt(BigInt("999999999999999999")), "999,999,999,999");
  assert.equal(formatDebt(BigInt("1000000000000000000")), "1,000,000,000,000");
});
test("source revisions preserve continuity, direction, bounded rates, and convergence", () => {
  for (const rate of [1_000_000, -100_000])
    for (const offset of [-100_000_000, 100_000_000]) {
      const before = new DebtClock(model(rate), epoch);
      const next = new DebtClock(
        model(rate, offset),
        epoch,
        before.value(epoch),
      );
      assert.equal(next.value(epoch), before.value(epoch));
      const step = Number(next.value(epoch + 1000) - next.value(epoch)) / 1e6;
      assert.equal(Math.sign(step), Math.sign(rate));
      assert.ok(Math.abs(step) >= Math.abs(rate) * 0.5);
      assert.ok(Math.abs(step) <= Math.abs(rate) * 1.5);
      const future = epoch + 3_000_000;
      assert.equal(
        next.value(future),
        new DebtClock(model(rate, offset), epoch).value(future),
      );
      const revisedAgain = new DebtClock(
        model(rate, -offset),
        epoch + 10_000,
        next.value(epoch + 10_000),
      );
      assert.equal(
        revisedAgain.value(epoch + 10_000),
        next.value(epoch + 10_000),
      );
    }
});
test("historical and zero-rate models are static; midnight/year boundaries do not reset debt", () => {
  for (const m of [{ ...model(), historical: true }, model(0)]) {
    const clock = new DebtClock(m, epoch);
    assert.equal(clock.value(epoch), clock.value(epoch + duration));
  }
  const clock = new DebtClock(model(), epoch);
  assert.equal(
    clock.value(epoch + duration),
    BigInt(Math.round(model().end)) * micro,
  );
  assert.equal(
    clock.value(epoch + duration + 1) - clock.value(epoch + duration),
    BigInt(1000) * micro,
  );
  assert.equal(
    clock.value(epoch + 86400000) - clock.value(epoch + 86400000 - 1),
    BigInt(1000) * micro,
  );
});
test("monotonic clock ignores backward wall adjustments and catches up after sleep", () => {
  const clock = new MonotonicClock(epoch, 100);
  assert.equal(clock.now(350), epoch + 250);
  clock.resume(epoch - 1000, 400);
  assert.equal(clock.now(400), epoch + 300);
  clock.resume(epoch + 3_600_000, 500);
  assert.equal(clock.now(750), epoch + 3_600_250);
  const debt = new DebtClock(model(), epoch);
  assert.equal(debt.value(clock.now(750)), debt.value(epoch + 3_600_250));
});

test("small revisions respect the minimum window and static updates do not fabricate activity", () => {
  const previous = new DebtClock(model(), epoch);
  const revised = new DebtClock(
    model(1_000_000, 100),
    epoch,
    previous.value(epoch),
  );
  assert.equal(revised.reconciling(epoch + 59_999), true);
  assert.equal(revised.reconciling(epoch + 60_000), false);
  const fixed = new DebtClock(model(0, 100), epoch, previous.value(epoch));
  assert.equal(fixed.value(epoch), fixed.value(epoch + 60_000));
  assert.equal(fixed.reconciling(epoch), false);
});
