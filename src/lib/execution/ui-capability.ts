export function localExecutionUI(env: Readonly<Record<string, string | undefined>> = process.env) {
  if (env.FLOWFORGE_EXECUTION_UI_ENABLED !== "local" || env.NODE_ENV === "production") return false;
  try { const u = new URL(env.NEXT_PUBLIC_SUPABASE_URL || ""); return u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname); }
  catch { return false; }
}
