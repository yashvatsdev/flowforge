import { createHash, randomUUID } from "node:crypto";
import { api, body, loadWorkspace, commitWorkspace } from "@/lib/workspace-api";
import { validState } from "@/lib/workspace";
import { mergeImport } from "@/lib/persistence";
import { ApiError } from "@/lib/server-auth";
export async function POST(request: Request) {
  return api(async ({ client }) => {
    const data = await body(request);
    if (!validState(data.state)) throw new ApiError(422, "Invalid backup document.");
    const current = await loadWorkspace(client);
    const fingerprint = createHash("sha256").update(JSON.stringify(data.state)).digest("hex");
    const { data: previous, error } = await client.from("ff_imports").select("fingerprint").eq("workspace_id", current.workspaceId).eq("fingerprint", fingerprint);
    if (error) throw new ApiError(503, "Import history could not be checked.");
    if (previous?.length) return current;
    let merged;
    try { merged = mergeImport(current.state, data.state, randomUUID); } catch (e) { throw new ApiError(422, (e as Error).message); }
    await commitWorkspace(client, current.revision, merged, "imported", fingerprint);
    return loadWorkspace(client);
  }, request);
}
