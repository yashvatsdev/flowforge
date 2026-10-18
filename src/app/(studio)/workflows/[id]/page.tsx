"use client";
import dynamic from "next/dynamic";
const Editor = dynamic(() => import("@/components/editor"), {
  ssr: false,
  loading: () => <div className="loading-workspace">Opening the canvas…</div>,
});
export default function Page() {
  return <Editor />;
}
