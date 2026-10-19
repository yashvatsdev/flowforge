import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export async function serverSupabase() {
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.APP_ORIGIN?.startsWith("https://") || false, path: "/" },
    cookies: { getAll: () => jar.getAll(), setAll: values => {
      try { values.forEach(({ name, value, options }) => jar.set(name, value, options)); }
      catch { /* Server components cannot write cookies; the refresh proxy handles this. */ }
    } },
  });
}
