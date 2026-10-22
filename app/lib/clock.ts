"use client";

import { useSyncExternalStore } from "react";

/**
 * One requestAnimationFrame loop shared by every live number and the map.
 * React subscribers are throttled to TICK_MS so counters re-render ~20 times a
 * second; frame subscribers (the canvas) get every frame.
 */
const TICK_MS = 50;
const REDUCED_MOTION_TICK_MS = 1000;

type FrameListener = (now: number, deltaMs: number) => void;

const tickListeners = new Set<() => void>();
const frameListeners = new Set<FrameListener>();
let now = 0;
let lastTick = 0;
let lastFrame = 0;
let frameId: number | null = null;

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia(reducedMotionQuery).matches
  );
}

function loop(frameTime: number) {
  const delta = lastFrame ? frameTime - lastFrame : 0;
  lastFrame = frameTime;
  const wallTime = Date.now();

  for (const listener of frameListeners) listener(wallTime, delta);

  const interval = prefersReducedMotion() ? REDUCED_MOTION_TICK_MS : TICK_MS;
  if (wallTime - lastTick >= interval) {
    lastTick = wallTime;
    now = wallTime;
    for (const listener of tickListeners) listener();
  }

  frameId = requestAnimationFrame(loop);
}

function ensureRunning() {
  if (frameId === null && (tickListeners.size > 0 || frameListeners.size > 0)) {
    now = Date.now();
    lastFrame = 0;
    frameId = requestAnimationFrame(loop);
  }
}

function stopIfIdle() {
  if (
    frameId !== null &&
    tickListeners.size === 0 &&
    frameListeners.size === 0
  ) {
    cancelAnimationFrame(frameId);
    frameId = null;
  }
}

function subscribeTick(listener: () => void) {
  tickListeners.add(listener);
  ensureRunning();
  return () => {
    tickListeners.delete(listener);
    stopIfIdle();
  };
}

export function subscribeFrame(listener: FrameListener) {
  frameListeners.add(listener);
  ensureRunning();
  return () => {
    frameListeners.delete(listener);
    stopIfIdle();
  };
}

/**
 * Current wall-clock time in ms, or null during server rendering and
 * hydration, so the server HTML never disagrees with the client.
 */
export function useNow(): number | null {
  return useSyncExternalStore(subscribeTick, getNowSnapshot, () => null);
}

// useSyncExternalStore requires repeated snapshot reads to be stable, so the
// first read pins `now` instead of returning a fresh Date.now() each call.
function getNowSnapshot(): number {
  if (!now) now = Date.now();
  return now;
}

function subscribeReducedMotion(listener: () => void) {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    prefersReducedMotion,
    () => false,
  );
}
