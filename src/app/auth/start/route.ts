import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { appOrigin, safeDestination, sameOrigin, privateHeaders } from "@/lib/auth-policy";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403, headers: privateHeaders });
  const form = await request.formData();
  const next = safeDestination(String(form.get("next") || ""));
  const client = await serverSupabase();
  const { data, error } = await client.auth.signInWithOAuth({ provider: "google", options: {
    scopes: "openid email profile", redirectTo: `${appOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
  } });
  return NextResponse.redirect(error || !data.url ? `${appOrigin()}/login?error=start` : data.url, { status: 303, headers: privateHeaders });
}
