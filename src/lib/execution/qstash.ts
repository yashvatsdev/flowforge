import { Client, Receiver } from "@upstash/qstash";
import { DeliveryFailure, parseDelivery, type Delivery, type Transport } from "./delivery";

type Publisher = Pick<Client, "publishJSON">;
export class QStashTransport implements Transport {
  constructor(private client: Publisher, private destination: string) {
    const url = new URL(destination);
    if (url.username || url.password || url.search || url.hash || url.protocol !== "https:" || url.pathname !== "/api/internal/execution-worker") throw new Error("Invalid worker URL");
  }
  async publish(message: Delivery, publicationId: string) {
    try {
      const response = await this.client.publishJSON({ url: this.destination, body: parseDelivery(message),
        deduplicationId: publicationId, retries: 4, retryDelay: "min(60000, pow(2, retried) * 5000)", timeout: 20 });
      if (!response || Array.isArray(response) || typeof response.messageId !== "string" || !response.messageId || response.messageId.length > 200) throw new DeliveryFailure("ambiguous");
      return response.messageId;
    } catch (error) {
      if (error instanceof DeliveryFailure) throw error;
      const status = (error as { status?: number })?.status;
      throw new DeliveryFailure(status === 429 || (status && status >= 500) ? "retryable" : status && status >= 400 && status < 500 ? "terminal" : "ambiguous");
    }
  }
}
export function createQStashTransport(token: string, destination: string) {
  if (!token) throw new Error("QStash credential missing");
  const client = new Client({ token, baseUrl: "https://qstash.upstash.io", retry: false, devMode: false, enableTelemetry: false });
  // The SDK's public requester is replaced because its default HTTP layer logs
  // raw exceptions and does not expose a publish AbortSignal. Retain SDK payload/
  // header construction, but restrict this requester to publication and never log
  // error bodies. An aborted fetch is still an ambiguous remote publication.
  client.http.request = async request => {
    if (request.path.length !== 3 || request.path[0] !== "v2" || request.path[1] !== "publish" || request.method !== "POST" || request.baseUrl || request.query) throw new DeliveryFailure("terminal");
    const headers = new Headers(request.headers as HeadersInit); headers.set("Authorization", `Bearer ${token}`);
    let response: Response;
    try { response = await fetch(["https://qstash.upstash.io", ...request.path].join("/"), {
      method: "POST", body: request.body, headers, signal: AbortSignal.timeout(5000), redirect: "error",
    }); } catch { throw new DeliveryFailure("ambiguous"); }
    if (!response.ok) { await response.body?.cancel(); throw new DeliveryFailure(response.status === 429 || response.status >= 500 ? "retryable" : "terminal"); }
    try { return JSON.parse(await limitedText(response, 4096)); } catch { throw new DeliveryFailure("ambiguous"); }
  };
  return new QStashTransport(client, destination);
}
export async function verifiedMessage(request: Request, receiver: Pick<Receiver, "verify">, canonicalUrl: string) {
  const signature = request.headers.get("upstash-signature");
  if (!signature || signature.length > 4096) throw new IngressError(401);
  const raw = await limitedText(request, 1024);
  try { if (!await receiver.verify({ signature, body: raw, url: canonicalUrl, clockTolerance: 0 })) throw new Error(); }
  catch { throw new IngressError(401); }
  try { return parseDelivery(JSON.parse(raw)); } catch { throw new IngressError(400); }
}
export class IngressError extends Error { constructor(public status: number) { super("Worker request rejected"); } }
export async function limitedText(request: Pick<Request, "headers" | "body">, limit: number) {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > limit)) throw new IngressError(413);
  const reader = request.body?.getReader(); if (!reader) throw new IngressError(400);
  const chunks: Uint8Array[] = []; let bytes = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => { timer = setTimeout(() => { reject(new IngressError(408)); void reader.cancel().catch(() => {}); }, 2000); });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), expired]); if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) { void reader.cancel().catch(() => {}); throw new IngressError(413); }
      chunks.push(value);
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
  } catch (error) { if (error instanceof IngressError) throw error; throw new IngressError(400); }
  finally { clearTimeout(timer); reader.releaseLock(); }
}
