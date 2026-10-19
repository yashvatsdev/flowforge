import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { appOrigin, privateHeaders } from "@/lib/auth-policy";
export async function proxy(request: NextRequest) {
  if (["/api/internal/execution-worker", "/api/internal/execution-maintenance"].includes(request.nextUrl.pathname)) {
    // These routes enforce signature/Bearer authentication themselves, without
    // touching cookie Auth or consuming the original signed request body.
    return NextResponse.next({ headers: privateHeaders });
  }
  if (request.nextUrl.pathname === "/") {
    // Supabase can send provider/state failures to Site URL before our callback.
    if (request.nextUrl.searchParams.has("error")) {
      return NextResponse.redirect(`${appOrigin()}/login?error=callback`, { headers: privateHeaders });
    }
    return NextResponse.next();
  }
  let response = NextResponse.next({ request });
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.APP_ORIGIN?.startsWith("https://") || false, path: "/" },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await client.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/", "/dashboard/:path*", "/workflows/:path*", "/executions/:path*", "/templates/:path*", "/settings/:path*", "/api/:path*", "/auth/:path*"] };
