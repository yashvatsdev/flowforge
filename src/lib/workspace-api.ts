import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authenticated, ApiError } from "./server-auth";
import { sameOrigin, privateHeaders } from "./auth-policy";
import { boundedJson, workspaceEnvelope, type WorkspaceEnvelope } from "./persistence";
import { validState, type State } from "./workspace";
export async function loadWorkspace(client: SupabaseClient): Promise<WorkspaceEnvelope> {
  const { error: bootstrap } = await client.rpc("ff_bootstrap").abortSignal(AbortSignal.timeout(15000));
  if (bootstrap) throw new ApiError(503, "Workspace unavailable. Check the Phase 1 migration and database access.");
  const { data, error } = await client.rpc("ff_load").abortSignal(AbortSignal.timeout(15000));
  if (error || !workspaceEnvelope(data)) throw new ApiError(503, "Workspace data could not be loaded safely. No local data was replaced.");
  return data;
}
export async function commitWorkspace(client: SupabaseClient, revision: number, state: State, action?: string, fingerprint?: string) {
  if (!validState(state) || !Number.isSafeInteger(revision) || revision < 0) throw new ApiError(422, "Invalid workspace or revision.");
  const { data, error } = await client.rpc("ff_commit", { expected: revision, document: state, import_fingerprint: fingerprint || null, action: action || null }).abortSignal(AbortSignal.timeout(15000));
  if (error?.code === "PT409" || error?.code === "40001") throw new ApiError(409, "This workspace changed in another tab. Your unsaved draft is preserved. Export it before reloading the server version.");
  if (error) throw new ApiError(error.code === "42501" ? 403 : 503, "Workspace save failed. Your draft is preserved; retry when the connection is available.");
  return data as number;
}
export function api(handler: (ctx: Awaited<ReturnType<typeof authenticated>>) => Promise<unknown>, request?: Request) {
  return (async () => {
    try {
      if (request && request.method !== "GET" && !sameOrigin(request)) throw new ApiError(403, "Invalid request origin.");
      const result = await handler(await authenticated());
      return NextResponse.json(result, { headers: privateHeaders });
    } catch (error) {
      return NextResponse.json({ error: error instanceof ApiError ? error.message : "The request could not be completed." }, { status: error instanceof ApiError ? error.status : 500, headers: privateHeaders });
    }
  })();
}
export async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await boundedJson(request);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch { throw new ApiError(400, "Send a valid JSON document smaller than 5 MB."); }
}
