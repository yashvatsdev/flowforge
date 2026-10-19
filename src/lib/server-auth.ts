import { serverSupabase } from "./supabase/server";
import { googleIdentity, oauthAuthentication } from "./auth-policy";
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function authenticated() {
  const client = await serverSupabase();
  const { data, error } = await client.auth.getUser();
  if (error?.name === "AuthRetryableFetchError" || (error?.status && error.status >= 500)) throw new ApiError(503, "Authentication service is temporarily unavailable. Please retry.");
  if (error || !data.user) throw new ApiError(401, "Sign in with Google to continue.");
  const { data: claims, error: claimsError } = await client.auth.getClaims();
  if (claimsError || !oauthAuthentication(claims?.claims) || !googleIdentity(data.user)) throw new ApiError(403, "Google authentication is required.");
  return { client, user: data.user };
}
