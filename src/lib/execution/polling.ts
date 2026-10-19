/** One active request, bounded retries and total polls; no setInterval overlap. */
export function pollingLoop(task: (signal: AbortSignal) => Promise<boolean>, options: {
  visible: () => boolean; schedule?: typeof setTimeout; unschedule?: typeof clearTimeout; limit?: number;
}) {
  let stopped = false, finished = false, busy = false, count = 0, failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  const schedule = options.schedule ?? setTimeout, unschedule = options.unschedule ?? clearTimeout;
  async function tick() {
    if (stopped || finished || busy || !options.visible()) return;
    if (timer) unschedule(timer);
    busy = true; controller = new AbortController();
    let again = false;
    try { again = await task(controller.signal); failures = 0; }
    catch { failures++; again = failures < 3; }
    finally { busy = false; }
    if (controller.signal.aborted) {
      if (!stopped && options.visible()) timer = schedule(() => { void tick(); }, 0);
      return;
    }
    count++;
    finished = !again || count >= (options.limit ?? 120);
    if (!stopped && again && count < (options.limit ?? 120) && options.visible()) timer = schedule(() => { void tick(); }, failures ? 15000 : 5000);
  }
  return { start: () => { void tick(); }, visibilityChanged: () => {
    if (!options.visible()) { if (timer) unschedule(timer); controller?.abort(); }
    else if (!stopped && !finished && count < (options.limit ?? 120)) void tick();
  }, stop: () => { stopped = true; if (timer) unschedule(timer); controller?.abort(); } };
}
