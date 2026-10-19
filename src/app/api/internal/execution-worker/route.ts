import { workerHandler } from "@/lib/execution/background-http";
import { backgroundRuntime } from "@/lib/execution/background-runtime";
export const runtime = "nodejs";
export const maxDuration = 20;
export const POST = workerHandler(backgroundRuntime);
