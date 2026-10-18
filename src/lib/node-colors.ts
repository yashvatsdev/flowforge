import type { Kind } from "./engine";

// Presentation only: the same roles are used by previews, the library, and canvas.
export const nodeColors: Record<Kind, string> = {
  trigger: "#91CBA7",
  transform: "#A8C7E6",
  condition: "#E5B47F",
  http: "#94C8C5",
  notification: "#C2B5DE",
};
