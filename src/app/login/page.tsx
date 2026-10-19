import Link from "next/link";
import { Logo } from "@/components/shared";
import { safeDestination } from "@/lib/auth-policy";
export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const errors: Record<string, string> = { start: "Google sign-in could not start. Please try again.", callback: "Sign-in was canceled or expired. Please try again.", provider: "Please use your Google account to sign in.", workspace: "You signed in, but your workspace could not open. Please retry after database setup is complete." };
  return <main id="main" className="auth-page"><div className="auth-wrap"><Logo />
    <section className="panel auth-panel"><span className="eyebrow">YOUR WORK, CONNECTED</span><h1>A space for your next good system<span className="accent">.</span></h1>
      <p className="muted">Sign in to save your workflows and pick up where you left off.</p>
      {params.error && <p className="notice" role="alert">{errors[params.error] || "Sign-in could not be completed. Please try again."}</p>}
      <form action="/auth/start" method="post"><input type="hidden" name="next" value={safeDestination(params.next || null)} /><button className="btn primary google-button"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.4ZM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2H3.1v2.6A10 10 0 0 0 12 22ZM6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9l3.3-2.6ZM12 5.9c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.9 5.5l3.3 2.6C7.2 7.7 9.4 5.9 12 5.9Z" /></svg>Continue with Google</button></form>
      <p className="micro">Only your basic Google profile is requested. Your existing local workspace stays in your browser.</p>
    </section><Link href="/" className="text-btn">Back to the studio ↗</Link></div></main>;
}
