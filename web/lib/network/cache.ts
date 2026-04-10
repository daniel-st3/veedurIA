/**
 * localStorage cache for network graph data.
 * TTL-based, version-aware, and silent on storage errors.
 */

import { networkConfig } from "./config";
import type { NetworkPayload } from "./types";

const PREFIX = networkConfig.cache.keyPrefix;
const TTL_MS = networkConfig.cache.ttlMs;

type CacheEntry = {
  data: NetworkPayload;
  expiresAt: number;
  version: string;
};

// ─── Read ──────────────────────────────────────────────────────────────────────

export function getCachedGraph(key: string): NetworkPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${PREFIX}${key}`);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(`${PREFIX}${key}`);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

// ─── Write ─────────────────────────────────────────────────────────────────────

export function setCachedGraph(
  key: string,
  data: NetworkPayload,
  ttl: number = TTL_MS,
): void {
  if (typeof window === "undefined") return;
  try {
    const entry: CacheEntry = {
      data,
      expiresAt: Date.now() + ttl,
      version: data.meta.version,
    };
    localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(entry));
  } catch {
    // QuotaExceededError or other storage errors — silent fail
  }
}

// ─── Staleness check ───────────────────────────────────────────────────────────

/** Returns true if the cached payload is from an older server version. */
export function isCacheStale(
  cached: NetworkPayload,
  serverVersion: string,
): boolean {
  return cached.meta.version !== serverVersion;
}

// ─── Invalidate ────────────────────────────────────────────────────────────────

export function invalidateCachedGraph(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`${PREFIX}${key}`);
  } catch {
    // silent
  }
}

/** Clear ALL veeduria network cache entries. */
export function clearAllNetworkCache(): void {
  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // silent
  }
}
