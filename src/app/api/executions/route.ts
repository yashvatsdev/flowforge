import { api } from "@/lib/workspace-api";
import { executionRpc, uuid } from "@/lib/execution/api";

export async function GET(request: Request) {
  return api(async ({ client }) => {
    const cursor = new URL(request.url).searchParams.get("cursor");
    return executionRpc(client, "ff_exec_read", { kind: "history", before_id: cursor ? uuid(cursor) : null });
  });
}
