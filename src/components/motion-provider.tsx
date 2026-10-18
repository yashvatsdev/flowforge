"use client";
import { MotionConfig } from "motion/react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useStore } from "@/lib/store";
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useStore();
  const reduced = useReducedMotion();
  return (
    <MotionConfig reducedMotion={settings.reduceMotion ? "always" : "user"}>
      <div data-reduced={settings.reduceMotion || reduced ? "true" : "false"}>
        {children}
      </div>
    </MotionConfig>
  );
}
