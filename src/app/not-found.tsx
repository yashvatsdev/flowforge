import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="not-found">
      <span className="eyebrow">404 / A CONNECTION NOT FOUND</span>
      <h1>This path ends here.</h1>
      <p>Let’s get your work flowing again.</p>
      <Link className="btn primary" href="/dashboard">
        Back to the workspace ↗
      </Link>
    </main>
  );
}
