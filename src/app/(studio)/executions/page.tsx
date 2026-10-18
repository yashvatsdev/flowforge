import { Suspense } from "react";
import { Executions } from "@/components/executions";
export default function Page() {
  return (
    <Suspense fallback={<p>Loading executions…</p>}>
      <Executions />
    </Suspense>
  );
}
