import { maintenanceHandler } from "@/lib/execution/background-http";
import { backgroundRuntime } from "@/lib/execution/background-runtime";
export const runtime = "nodejs";
export const maxDuration = 30;
export const POST = maintenanceHandler(backgroundRuntime);
