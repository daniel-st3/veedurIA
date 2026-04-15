import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client for Next.js API routes.
 * Uses the anon key — RLS is enabled with a public SELECT policy so anyone
 * can read civic data, but INSERT/UPDATE/DELETE require the service_role key.
 */
export function createServerSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Colombia department name → GeoJSON feature name ──────────────────────────
const DEPT_GEO: Record<string, string> = {
  "BOGOTA": "SANTAFE DE BOGOTA D.C",
  "BOGOTÁ": "SANTAFE DE BOGOTA D.C",
  "BOGOTA D.C.": "SANTAFE DE BOGOTA D.C",
  "BOGOTÁ D.C.": "SANTAFE DE BOGOTA D.C",
  "SAN ANDRES": "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA",
};

export function deptGeoName(dept: string): string {
  return DEPT_GEO[dept.toUpperCase().trim()] ?? dept.toUpperCase().trim();
}

export function formatCop(value: number, lang: string): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  return `$${(value / 1_000).toFixed(0)}K`;
}
