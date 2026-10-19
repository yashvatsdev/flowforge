import { api, body, loadWorkspace, commitWorkspace } from "@/lib/workspace-api";
import { validState } from "@/lib/workspace";
import { ApiError } from "@/lib/server-auth";
export async function GET() { return api(async ({ client }) => loadWorkspace(client)); }
export async function PUT(request: Request) {
  return api(async ({ client }) => {
    const data = await body(request);
    if (!validState(data.state) || !Number.isSafeInteger(data.revision)) throw new ApiError(422, "Invalid workspace document.");
    const revision = await commitWorkspace(client, data.revision as number, data.state, typeof data.action === "string" ? data.action : undefined);
    return { revision };
  }, request);
}
