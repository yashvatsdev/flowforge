"use client";

import { useEffect, useRef } from "react";

/** A decorative signal field; one capped canvas rather than animated DOM particles. */
export function AmbientBackground({ paused }: { paused: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const phase = useRef(0);

  useEffect(() => {
    const surface = canvas.current;
    const context = surface?.getContext("2d", { alpha: true });
    if (!surface || !context) return;

    let width = 0;
    let height = 0;
    let frame = 0;
    let lastPaint = 0;
    let ink: CanvasGradient;
    const staticMode = paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const point = (x: number, lane: number, time: number) => {
      const spread = Math.min(width * 0.085, 105);
      return height * (0.02 + lane * 0.13) +
        Math.sin(x / width * 4.5 + lane * 0.7 + time * 0.24) * spread +
        Math.cos(x / width * 2.8 - time * 0.16 + lane) * spread * 0.55;
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      const time = phase.current;
      const lanes = width < 600 ? 7 : 9;
      for (let lane = 0; lane < lanes; lane++) {
        context.beginPath();
        for (let sample = 0; sample <= 80; sample++) {
          const x = sample / 80 * width;
          const y = point(x, lane, time);
          if (sample === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.strokeStyle = ink;
        context.lineWidth = lane % 3 === 0 ? 1 : 0.6;
        context.stroke();

        // Short moving segments make the current's direction visible.
        const progress = (time * 0.028 + lane * 0.173) % 1;
        const head = progress * (width + 140) - 70;
        context.beginPath();
        for (let segment = 0; segment <= 12; segment++) {
          const x = head - 55 + segment * 5;
          const y = point(x, lane, time);
          if (segment === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.strokeStyle = "rgba(168,199,230,0.17)";
        context.lineWidth = 1.2;
        context.stroke();

        for (let particle = 0; particle < 4; particle++) {
          const offset = (time * (0.012 + particle * 0.003) + lane * 0.219 + particle * 0.277) % 1;
          const x = offset * width;
          const y = point(x, lane, time);
          const alpha = Math.sin(offset * Math.PI) * 0.5;
          context.beginPath();
          context.arc(x, y, particle === 0 ? 2 : 1, 0, Math.PI * 2);
          context.fillStyle = `rgba(168,199,230,${alpha})`;
          context.fill();
          if (particle === 0) {
            context.beginPath();
            context.arc(x, y, 7, 0, Math.PI * 2);
            context.fillStyle = `rgba(168,199,230,${alpha * 0.07})`;
            context.fill();
          }
        }
      }
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      surface.width = Math.round(width * ratio);
      surface.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      ink = context.createLinearGradient(0, 0, width, 0);
      ink.addColorStop(0, "rgba(168,199,230,0)");
      ink.addColorStop(0.3, "rgba(168,199,230,0.045)");
      ink.addColorStop(0.75, "rgba(168,199,230,0.12)");
      ink.addColorStop(1, "rgba(168,199,230,0.025)");
      draw();
    };

    const animate = (now: number) => {
      if (document.hidden || staticMode) return;
      if (!lastPaint) lastPaint = now;
      const elapsed = now - lastPaint;
      if (elapsed >= 1000 / 30) {
        phase.current += Math.min(elapsed, 100) / 1000;
        lastPaint = now;
        draw();
      }
      frame = requestAnimationFrame(animate);
    };
    const visibility = () => {
      cancelAnimationFrame(frame);
      lastPaint = 0;
      if (!document.hidden && !staticMode) frame = requestAnimationFrame(animate);
    };

    resize();
    visibility();
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [paused]);

  return <canvas ref={canvas} className="ff-atmosphere" aria-hidden="true" />;
}
