"use client";

/** One wall-time clock for the canvas and counters; no dashboard-wide React renders. */
type FrameListener = (now: number, deltaMs: number) => void;
const listeners = new Set<FrameListener>();
let frameId: number | null = null;
let lastFrame = 0;
let lastDispatch = 0;
let motionQuery: MediaQueryList | null = null;

function loop(frameTime: number) {
  if (document.hidden) {
    frameId = null;
    lastFrame = 0;
    return;
  }
  const now = Date.now();
  if (!motionQuery?.matches || !lastFrame || now - lastDispatch >= 1000) {
    const delta = lastFrame ? frameTime - lastFrame : 0;
    lastFrame = frameTime;
    lastDispatch = now;
    for (const listener of listeners) listener(now, delta);
  }
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
  } else resume();
}
export function subscribeFrame(listener: FrameListener) {
  if (!listeners.size) {
    motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    document.addEventListener("visibilitychange", onVisibilityChange);
  }
  listeners.add(listener);
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
