import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  // Existing mount hydration, playback, and upstream Magic UI lifecycles intentionally
  // update state from effects. Keep the other recommended Hooks checks enabled.
  { files: ["src/components/editor.tsx", "src/lib/store.tsx", "src/components/ui/terminal.tsx"], rules: { "react-hooks/set-state-in-effect": "off" } },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", ".taste-skill/**"]),
]);
