import { api } from "@/lib/workspace-api";
import { executionRpc, uuid } from "@/lib/execution/api";

export async function POST(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  return api(async ({ client }) => executionRpc(client, "ff_exec_cancel", { rid: uuid((await params).runId) }), request);
}
