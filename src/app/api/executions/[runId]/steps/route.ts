import { api } from "@/lib/workspace-api";
import { executionRpc, uuid } from "@/lib/execution/api";
import { displaySteps, type RunStep } from "@/lib/execution/presentation";

export async function GET(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  return api(async ({ client }) => displaySteps(await executionRpc(client, "ff_exec_read", { kind: "steps", rid: uuid((await params).runId) }) as RunStep[]));
}
