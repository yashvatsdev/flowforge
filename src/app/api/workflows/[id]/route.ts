import { api, body, loadWorkspace, commitWorkspace } from "@/lib/workspace-api";
import { ApiError } from "@/lib/server-auth";
import type { Workflow } from "@/lib/engine";
type Params = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  return api(async ({ client }) => { const w = (await loadWorkspace(client)).state.workflows.find(w => w.id === id); if (!w) throw new ApiError(404,"Workflow not found."); return w; });
}
async function mutate(request: Request, { params }: Params, remove: boolean) {
  const { id } = await params;
  return api(async ({ client }) => {
    const data = await body(request); const current = await loadWorkspace(client);
    if (!current.state.workflows.some(w => w.id === id)) throw new ApiError(404,"Workflow not found.");
    const w = data.workflow as Workflow;
    if (!remove && (!w || w.id !== id)) throw new ApiError(422,"Workflow identifier mismatch.");
    const state = { ...current.state, workflows: remove ? current.state.workflows.filter(w => w.id !== id) : current.state.workflows.map(x => x.id === id ? w : x) };
    return { revision: await commitWorkspace(client, data.revision as number, state, "edited") };
  }, request);
}
export async function PUT(request: Request, context: Params) { return mutate(request, context, false); }
export async function DELETE(request: Request, context: Params) { return mutate(request, context, true); }
