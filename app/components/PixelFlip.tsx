"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "../lib/clock";
import { readCssColor } from "../lib/theme";

const COLUMNS = 30;
const STEP_MS = 300;
const ACCENT_SHARE = 0.15;

/**
 * Swaps between two faces behind a pixel-grid wipe: pixels fill the card in
 * random order, the face changes while it is covered, then pixels clear in
 * random order. Drawn on one canvas instead of hundreds of animated elements.
 */
export default function PixelFlip({
  flipped,
  front,
  back,
  className,
}: {
  flipped: boolean;
  front: React.ReactNode;
  back: React.ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [animatedSide, setAnimatedSide] = useState(flipped);
  const reducedMotion = useReducedMotion();
  const showBack = reducedMotion ? flipped : animatedSide;
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!container || !canvas || !context) return;

    if (reducedMotion) {
      const frame = requestAnimationFrame(() => setAnimatedSide(flipped));
      return () => cancelAnimationFrame(frame);
    }

    const pixelRatio = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const cell = width / COLUMNS;
    const rows = Math.ceil(height / cell);
    const total = COLUMNS * rows;
    const order = Array.from({ length: total }, (_, i) => i);
    for (let i = total - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const accent = readCssColor("--series-1");
    const neutral = readCssColor("--dot");
    const colors = order.map(() =>
      Math.random() < ACCENT_SHARE ? accent : neutral,
    );

    const drawRange = (from: number, to: number) => {
      context.clearRect(0, 0, width, height);
      for (let n = from; n < to; n++) {
        const index = order[n];
        context.fillStyle = colors[n];
        // Overlap by half a pixel so neighbouring cells leave no hairline seams.
        context.fillRect(
          (index % COLUMNS) * cell,
          Math.floor(index / COLUMNS) * cell,
          cell + 0.5,
          cell + 0.5,
        );
      }
    };

    let swapped = false;
    let frame = 0;
    const start = performance.now();
    const tick = (time: number) => {
      const elapsed = time - start;
      if (elapsed < STEP_MS) {
        drawRange(0, Math.floor((total * elapsed) / STEP_MS));
      } else if (elapsed < STEP_MS * 2) {
        if (!swapped) {
          swapped = true;
          setAnimatedSide(flipped);
        }
        drawRange(Math.floor((total * (elapsed - STEP_MS)) / STEP_MS), total);
      } else {
        context.clearRect(0, 0, width, height);
        if (!swapped) setAnimatedSide(flipped);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      context.clearRect(0, 0, width, height);
    };
  }, [flipped, reducedMotion]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className ?? ""}`}
    >
      <div className={`h-full ${showBack ? "invisible" : ""}`} inert={showBack}>
        {front}
      </div>
      <div
        className={`absolute inset-0 overflow-y-auto ${showBack ? "" : "invisible"}`}
        inert={!showBack}
      >
        {back}
      </div>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
    </div>
  );
}
