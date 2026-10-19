import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { appOrigin, safeDestination, privateHeaders, googleIdentity, oauthAuthentication } from "@/lib/auth-policy";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const fail = (reason: string) => NextResponse.redirect(`${appOrigin()}/login?error=${reason}`, { headers: privateHeaders });
  if (params.has("error") || !params.get("code")) return fail("callback");
  const client = await serverSupabase();
  const { error } = await client.auth.exchangeCodeForSession(params.get("code")!);
  if (error) return fail("callback");
  const { data } = await client.auth.getUser();
  const { data: claims } = await client.auth.getClaims();
  if (!oauthAuthentication(claims?.claims) || !googleIdentity(data.user)) { await client.auth.signOut({ scope: "local" }); return fail("provider"); }
  const { error: bootstrapError } = await client.rpc("ff_bootstrap");
  if (bootstrapError) return fail("workspace");
  return NextResponse.redirect(`${appOrigin()}${safeDestination(params.get("next"))}`, { headers: privateHeaders });
}
