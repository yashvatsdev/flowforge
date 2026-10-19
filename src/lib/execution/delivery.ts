import { randomUUID } from "node:crypto";
import type { Rpc } from "./runner";
import { runClaimedExecution, type Progress } from "./runner";

export type Delivery = { version: 1; runId: string; eventId: string; deliveryId: string };
export type DispatchClaim = { eventId: string; runId: string; generation: number; attempt: number };
export type Transport = { publish(message: Delivery, publicationId: string): Promise<string> };
export type Failure = "retryable" | "ambiguous" | "terminal";
export class DeliveryFailure extends Error {
  constructor(public category: Failure) { super(category); }
}
export function parseDelivery(value: unknown): Delivery {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid delivery");
  const v = value as Record<string, unknown>;
  if (Object.keys(v).sort().join() !== "deliveryId,eventId,runId,version" || v.version !== 1 ||
    typeof v.runId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.runId) ||
    typeof v.eventId !== "string" || !/^[1-9][0-9]{0,18}$/.test(v.eventId) || BigInt(v.eventId) > 9223372036854775807n ||
    v.deliveryId !== `ff:${v.eventId}`) throw new Error("Invalid delivery");
  return v as Delivery;
}
export type OperationalEvent = {
  event: "publication" | "worker" | "recovery"; runId?: string; deliveryId?: string;
  eventId?: string; attempt?: number; generation?: number; durationMs?: number;
  classification?: string; action?: string;
};
// Only explicit metadata enters logs. No spreading exceptions, headers or RPC bodies.
export type Log = (event: OperationalEvent) => void;
export const operationalLog: Log = event => console.info(JSON.stringify(event));

export async function dispatchOutbox(rpc: Rpc, transport: Transport, log: Log = operationalLog, batch = 10) {
  if (!Number.isInteger(batch) || batch < 1 || batch > 25) throw new Error("Invalid batch");
  const dispatcher = randomUUID();
  // Claim one at a time: a slow publish cannot consume the leases of a preclaimed batch.
  let published = 0;
  const until = Date.now() + 15000;
  for (let i = 0; i < batch && Date.now() < until; i++) {
    const rows = await rpc("ff_delivery_claim", { dispatcher, batch: 1 }) as DispatchClaim[];
    if (!rows.length) break;
    const row = rows[0];
    const message = parseDelivery({ version: 1, runId: row.runId, eventId: row.eventId, deliveryId: `ff:${row.eventId}` });
    let outcome: "published" | Failure = "ambiguous", transportId: string | null = null;
    try { transportId = await transport.publish(message, `${message.deliveryId}:${row.attempt}`); outcome = "published"; }
    catch (error) { outcome = error instanceof DeliveryFailure ? error.category : "ambiguous"; }
    // A DB/network error here is ambiguous. Leave the claim to expire, never
    // invent an acknowledgement or recursively publish inside this invocation.
    const accepted = await rpc("ff_delivery_settle", { eid: row.eventId, dispatcher, fence: row.generation, outcome, transport_id: transportId });
    if (outcome === "published" && accepted) published++;
    log({ event: "publication", runId: row.runId, eventId: row.eventId, deliveryId: message.deliveryId,
      attempt: row.attempt, generation: row.generation, classification: accepted ? outcome : "stale_dispatcher" });
  }
  return { published };
}

export async function consumeDelivery(rpc: Rpc, message: Delivery, log: Log = operationalLog, milliseconds = 10000) {
  message = parseDelivery(message);
  const worker = randomUUID(), started = Date.now();
  const claim = await rpc("ff_delivery_run_claim", { rid: message.runId, eid: message.eventId, worker }) as Progress & { status: string };
  if (claim.status !== "claimed") {
    log({ event: "worker", runId: message.runId, eventId: message.eventId, deliveryId: message.deliveryId, classification: claim.status });
    return claim.status === "busy" ? "retry" : "done";
  }
  const progress = await runClaimedExecution(rpc, claim, worker, milliseconds);
  log({ event: "worker", runId: message.runId, eventId: message.eventId, deliveryId: message.deliveryId,
    generation: claim.generation, durationMs: Date.now() - started, classification: progress.state === "running" ? "yielded" : "terminal" });
  return progress.state === "running" ? "retry" : "done";
}

/** In-process only: never an HTTP signature bypass. Delivery is explicit via flush. */
export class LocalTransport implements Transport {
  readonly pending: Delivery[] = [];
  async publish(message: Delivery, publicationId: string) {
    if (!publicationId) throw new DeliveryFailure("terminal");
    if (this.pending.length >= 25) throw new DeliveryFailure("retryable");
    this.pending.push(parseDelivery(structuredClone(message))); return `local:${message.deliveryId}`;
  }
  async flush(consume: (message: Delivery) => Promise<unknown>) {
    const count = this.pending.length;
    for (let i = 0; i < count; i++) await consume(this.pending.shift()!);
  }
}
