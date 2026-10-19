import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { appOrigin, sameOrigin, privateHeaders } from "@/lib/auth-policy";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403, headers: privateHeaders });
  const client = await serverSupabase();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) return NextResponse.redirect(`${appOrigin()}/settings?signout=failed`, { status: 303, headers: privateHeaders });
  return NextResponse.redirect(`${appOrigin()}/login`, { status: 303, headers: { ...privateHeaders, "Clear-Site-Data": '"cache"' } });
}
