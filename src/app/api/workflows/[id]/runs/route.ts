import { api } from "@/lib/workspace-api";
import { executionRpc, startBody } from "@/lib/execution/api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(async ({ client }) => executionRpc(client, "ff_exec_start", { workflow: (await params).id, ...await startBody(request) }), request);
}
