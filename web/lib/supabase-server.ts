import { createClient } from "@supabase/supabase-js";
import { deptDisplayLabel, deptGeoName } from "@/lib/colombia-departments";

/**
 * Server-only Supabase client for Next.js API routes.
 * Uses the anon key — RLS is enabled with a public SELECT policy so anyone
 * can read civic data, but INSERT/UPDATE/DELETE require the service_role key.
 */
export function createServerSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL and SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_KEY) must be set",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Server-only Supabase client for internal route handlers and admin pages.
 * Prefers the dedicated service-role key but falls back to SUPABASE_KEY so the
 * existing GitHub Actions / local setups keep working.
 */
export function createServiceSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
  const key =
    serviceKey?.startsWith("eyJ")
      ? serviceKey
      : process.env.SUPABASE_KEY ??
        process.env.SUPABASE_ANON_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY (or SUPABASE_KEY) must be set",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export { deptDisplayLabel, deptGeoName };

import { formatCompactCop } from "@/lib/format";

export function formatCop(value: number, lang: string): string {
  return formatCompactCop(value, lang === "en" ? "en" : "es");
}
