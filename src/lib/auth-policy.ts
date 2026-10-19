export function appOrigin() {
  const value = process.env.APP_ORIGIN || "http://localhost:3001";
  const url = new URL(value);
  if (url.origin !== value || (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("Invalid application origin");
  return value;
}
export function safeDestination(value: string | null) {
  if (!value || !/^\/(dashboard|workflows|executions|templates|settings)(\/|\?|$)/.test(value) || /[\\\r\n]/.test(value)) return "/dashboard";
  return value;
}
export function googleIdentity(user: { app_metadata: Record<string, unknown>; identities?: { provider: string }[] } | null) {
  return !!user && user.app_metadata.provider === "google" && !!user.identities?.some(i => i.provider === "google");
}
export function sameOrigin(request: Request) {
  return request.headers.get("origin") === appOrigin();
}
export const privateHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export function oauthAuthentication(claims: { amr?: unknown } | null | undefined) {
  return Array.isArray(claims?.amr) && claims.amr.some((entry: unknown) => !!entry && typeof entry === "object" && "method" in entry && entry.method === "oauth");
}
