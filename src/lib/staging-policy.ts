/** Offline preflight for gate A only. Never connects, grants access or deploys. */
export function stagingProblems(env: Readonly<Record<string, string | undefined>>) {
  const errors: string[] = [];
  if (env.FLOWFORGE_ENVIRONMENT !== "staging") errors.push("Set FLOWFORGE_ENVIRONMENT=staging explicitly.");
  const ref = env.FLOWFORGE_STAGING_PROJECT_REF || "";
  if (!/^[a-z]{20}$/.test(ref) || ref === "kixwwrmedqazurvdnfhi") errors.push("Choose an isolated staging project, not the existing production project.");
  if (env.NEXT_PUBLIC_SUPABASE_URL !== `https://${ref}.supabase.co`) errors.push("Supabase URL must match the isolated staging project exactly.");
  try {
    const origin = new URL(env.APP_ORIGIN || "");
    if (origin.protocol !== "https:" || origin.origin !== env.APP_ORIGIN || origin.hostname === "localhost" || /^127\./.test(origin.hostname)) throw new Error();
  } catch { errors.push("APP_ORIGIN must be the exact HTTPS staging origin, without credentials, path or trailing slash."); }
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  // Gate A intentionally uses modern publishable keys; never accept service JWTs.
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) errors.push("Use the isolated project's publishable API key, never a secret or service-role key.");
  for (const name of Object.keys(env)) {
    if (!env[name]) continue;
    if (/^(?:QSTASH_|FLOWFORGE_(?:DELIVERY_|RUNNER_|WORKER_|MAINTENANCE_|EXECUTION_UI_ENABLED)|SUPABASE_(?:SERVICE_ROLE_KEY|SECRET_KEY)|DATABASE_URL|PGPASSWORD|PGPASSFILE)/.test(name)) {
      errors.push(`Remove ${name} from the execution-disabled staging environment.`);
    }
    if (name.startsWith("NEXT_PUBLIC_") && /TOKEN|SECRET|PASSWORD|SERVICE_ROLE|SIGNING|PRIVATE_KEY/.test(name)) errors.push(`Remove privileged public variable ${name}.`);
  }
  return errors;
}
