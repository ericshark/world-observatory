"use client";

import { MonotonicClock } from "./debt-clock";

/** Shared monotonic clock; no dashboard-wide animation renders. */
type FrameListener = (now: number, deltaMs: number) => void;
const listeners = new Map<FrameListener, boolean>();
let frameId: number | null = null;
let lastFrame = 0;
let lastDispatch = 0;
let motionQuery: MediaQueryList | null = null;
let clock: MonotonicClock | null = null;
export function frameNow() {
  clock ??= new MonotonicClock(Date.now(), performance.now());
  return clock.now(performance.now());
}

function loop(frameTime: number) {
  if (document.hidden) {
    frameId = null;
    lastFrame = 0;
    return;
  }
  const now = frameNow();
  const due = !motionQuery?.matches || !lastFrame || now - lastDispatch >= 1000;
  const delta = lastFrame ? frameTime - lastFrame : 0;
  lastFrame = frameTime;
  if (due) lastDispatch = now;
  for (const [listener, throttleReduced] of listeners)
    if (due || !throttleReduced) listener(now, delta);
  frameId = requestAnimationFrame(loop);
}

function resume() {
  if (frameId === null && listeners.size && !document.hidden) {
    lastFrame = 0;
    frameId = requestAnimationFrame(loop);
  }
}
function onVisibilityChange() {
  if (document.hidden) {
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
    lastFrame = 0;
  } else {
    clock?.resume(Date.now(), performance.now());
    resume();
  }
}
export function subscribeFrame(
  listener: FrameListener,
  throttleReduced = true,
) {
  if (!listeners.size) {
    motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    document.addEventListener("visibilitychange", onVisibilityChange);
  }
  listeners.set(listener, throttleReduced);
  resume();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = null;
      motionQuery = null;
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
  };
}
