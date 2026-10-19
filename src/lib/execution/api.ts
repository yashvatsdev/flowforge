import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "../server-auth";
import { body } from "../workspace-api";
import { EXECUTION_LIMITS, jsonBytes } from "./compiler";

export async function executionRpc(client: SupabaseClient, name: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, args).abortSignal(AbortSignal.timeout(15000));
  if (error) {
    const status = ({ PT404: 404, PT409: 409, PT422: 422, "42501": 403 } as Record<string, number>)[error.code] ?? 503;
    throw new ApiError(status, ({ 404: "Run or workflow not found.", 409: "Revision, idempotency key, or lease conflict.", 422: "Invalid execution request or unsupported workflow.", 403: "Execution access denied." } as Record<number, string>)[status] ?? "Execution service unavailable.");
  }
  if (data?.limited) throw new ApiError(429, "Workspace execution quota exceeded.");
  return data;
}
export function uuid(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new ApiError(400, "Invalid run identifier.");
  return value;
}
export async function startBody(request: Request) {
  const value = await body(request);
  const key = request.headers.get("Idempotency-Key");
  if (!key || !/^[A-Za-z0-9._:-]{1,128}$/.test(key) || Object.keys(value).some(k => !["expectedRevision", "input"].includes(k)) || !Number.isSafeInteger(value.expectedRevision) || (value.expectedRevision as number) < 0 || !value.input || typeof value.input !== "object" || Array.isArray(value.input) || jsonBytes(value.input) > EXECUTION_LIMITS.input) throw new ApiError(422, "Supply an idempotency key, expectedRevision, and bounded input object.");
  return { expected: value.expectedRevision, input: value.input, key };
}
