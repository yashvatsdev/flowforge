import { api, body, loadWorkspace, commitWorkspace } from "@/lib/workspace-api";
import { ApiError } from "@/lib/server-auth";
import type { Workflow } from "@/lib/engine";
export async function GET() { return api(async ({ client }) => (await loadWorkspace(client)).state.workflows); }
export async function POST(request: Request) {
  return api(async ({ client }) => {
    const data = await body(request); const current = await loadWorkspace(client); const w = data.workflow as Workflow;
    if (!w || current.state.workflows.some(x => x.id === w.id)) throw new ApiError(409, "Workflow already exists or is missing.");
    const state = { ...current.state, workflows: [...current.state.workflows, w] };
    return { revision: await commitWorkspace(client, data.revision as number, state, "edited"), workflow: w };
  }, request);
}
