import { timingSafeEqual } from "node:crypto";
import { Receiver } from "@upstash/qstash";
import { consumeDelivery, dispatchOutbox, operationalLog, type Log, type Transport } from "./delivery";
import type { Rpc } from "./runner";
import { IngressError, limitedText, verifiedMessage } from "./qstash";

const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
function response(status: number) { return new Response(null, { status, headers }); }
export function workerHandler(dependencies: () => { rpc: Rpc; receiver: Pick<Receiver, "verify">; url: string; log?: Log }) {
  return async (request: Request) => {
    try {
      const { rpc, receiver, url, log } = dependencies();
      const message = await verifiedMessage(request, receiver, url);
      const result = await consumeDelivery(rpc, message, log);
      return response(result === "retry" ? 503 : 204);
    } catch (error) { return response(error instanceof IngressError ? error.status : 503); }
  };
}
export function maintenanceHandler(dependencies: () => { rpc: Rpc; token: string; transport: Transport; batch?: number; flush?: () => Promise<void>; log?: Log }) {
  return async (request: Request) => {
    try {
      const { rpc, token, transport, batch = 10, flush, log = operationalLog } = dependencies();
      const supplied = request.headers.get("authorization") ?? "";
      const expected = `Bearer ${token}`;
      if (token.length < 32 || supplied.length > 512 || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
        !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return response(401);
      let data: unknown;
      try { data = JSON.parse(await limitedText(request, 128)); } catch (e) { if (e instanceof IngressError) throw e; throw new IngressError(400); }
      if (!data || typeof data !== "object" || Object.keys(data).join() !== "action" || !["dispatch", "recover", "status"].includes((data as { action: string }).action)) throw new IngressError(400);
      const { action } = data as { action: string };
      if (action === "dispatch") { await dispatchOutbox(rpc, transport, log, batch); await flush?.(); }
      else if (action === "recover") { await rpc("ff_delivery_recover", { batch: 25 }); log({ event: "recovery", action: "reconcile" }); }
      else return Response.json(await rpc("ff_delivery_status", {}), { headers });
      return response(204);
    } catch (error) { return response(error instanceof IngressError ? error.status : 503); }
  };
}
