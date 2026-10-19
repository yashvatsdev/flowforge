"use client";
import { useEffect, useState } from "react";
import { ExecutionRequestError } from "./browser-client";
import { pollingLoop } from "./polling";
export function useExecutionResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>, poll: (value: T) => boolean) {
  const [retry, setRetry] = useState(0);
  const requestKey = `${key}|${retry}`;
  const [state, setState] = useState<{ key: string; data?: T; error?: string; status?: number; paused?: boolean }>({ key: "" });
  useEffect(() => {
    let mounted = true, count = 0;
    const loop = pollingLoop(async signal => {
      try {
        const data = await load(signal);
        if (!mounted || signal.aborted) return false;
        count++; const again = poll(data);
        setState({ key: requestKey, data, paused: again && count >= 120 });
        return again;
      } catch (error) {
        if (!mounted || signal.aborted) return false;
        const status = error instanceof ExecutionRequestError ? error.status : 0;
        setState(old => ({ key: requestKey, data: old.key === requestKey ? old.data : undefined, error: error instanceof Error ? error.message : "Could not load execution history.", status }));
        // Pause on errors. Retry is explicit, so expired auth/network failures do
        // not create a background request storm or silent login navigation.
        return false;
      }
    }, { visible: () => !document.hidden });
    const visibility = () => loop.visibilityChanged(); document.addEventListener("visibilitychange", visibility); loop.start();
    return () => { mounted = false; document.removeEventListener("visibilitychange", visibility); loop.stop(); };
  }, [requestKey, load, poll]);
  return { ...(state.key === requestKey ? state : {}), loading: state.key !== requestKey, refresh: () => setRetry(v => v + 1) };
}
