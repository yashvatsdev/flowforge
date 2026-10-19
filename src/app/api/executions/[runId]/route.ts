import { api } from "@/lib/workspace-api";
import { executionRpc, uuid } from "@/lib/execution/api";
import { displayDetails, type RunDetails } from "@/lib/execution/presentation";

export async function GET(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  return api(async ({ client }) => displayDetails(await executionRpc(client, "ff_exec_read", { kind: "details", rid: uuid((await params).runId) }) as RunDetails));
}
