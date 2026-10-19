import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { authenticated, ApiError } from "@/lib/server-auth";
import { CloudProvider } from "@/components/cloud-provider";
import { MotionProvider } from "@/components/motion-provider";
import { localExecutionUI } from "@/lib/execution/ui-capability";
export default async function Layout({ children }: { children: React.ReactNode }) {
  const identity = await authenticated().catch(error => {
    if (error instanceof ApiError && [401,403].includes(error.status)) redirect("/login");
    throw error;
  });
  const user = identity.user;
  const display = (value: unknown) => typeof value === "string" ? value : "";
  return <CloudProvider executionEnabled={localExecutionUI()} user={{ id: user.id, name: display(user.user_metadata.full_name || user.user_metadata.name), email: display(user.email), avatar: display(user.user_metadata.avatar_url) }}><MotionProvider><Shell>{children}</Shell></MotionProvider></CloudProvider>;
}
