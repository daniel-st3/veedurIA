/**
 * Frontend edge utilities for SigueElDinero.
 *
 * Provides frontend-specific edge transformations:
 * - filtering by confidence
 * - merging edge lists
 * - computing edge visual weight
 * - evidence helpers
 */

import { networkConfig, confidenceBandColor } from "./config";
import type { NetworkEdge, Evidence } from "./types";

// ─── Edge filtering ────────────────────────────────────────────────────────────

export function filterEdgesByConfidence(
  edges: NetworkEdge[],
  minConfidence: number,
): NetworkEdge[] {
  return edges.filter((e) => e.confidence >= minConfidence);
}

export function filterEdgesForNode(
  edges: NetworkEdge[],
  nodeId: string,
): NetworkEdge[] {
  return edges.filter((e) => e.source === nodeId || e.target === nodeId);
}

// ─── Edge merging ──────────────────────────────────────────────────────────────

/**
 * Merge new edges (from expand) into existing list, deduplicating by id.
 */
export function mergeEdges(
  existing: NetworkEdge[],
  incoming: NetworkEdge[],
): NetworkEdge[] {
  const map = new Map<string, NetworkEdge>(existing.map((e) => [e.id, e]));
  for (const e of incoming) {
    if (!map.has(e.id)) map.set(e.id, e);
  }
  return Array.from(map.values());
}

// ─── Edge visual properties ────────────────────────────────────────────────────

/** Line width proportional to contract count (log scale). */
export function edgeWidth(edge: NetworkEdge): number {
  return Math.max(0.5, Math.log1p(edge.contract_count) * 0.9);
}

/** Edge color based on confidence level. */
export function edgeColor(
  edge: NetworkEdge,
  selectedEdgeId: string | null,
  hoveredNodeId: string | null,
): string {
  if (edge.id === selectedEdgeId) return "#ffd700";
  if (
    hoveredNodeId &&
    (edge.source === hoveredNodeId || edge.target === hoveredNodeId)
  ) {
    return confidenceBandColor(edge.confidence);
  }
  // Dim non-active edges
  if (edge.confidence >= networkConfig.confidence.highThreshold)
    return "rgba(32,201,151,0.40)";
  if (edge.confidence >= networkConfig.confidence.mediumThreshold)
    return "rgba(234,179,8,0.32)";
  return "rgba(239,68,68,0.22)";
}

/** Directional particles: only high-confidence edges get particles. */
export function edgeParticleCount(edge: NetworkEdge): number {
  return edge.confidence >= networkConfig.confidence.highThreshold ? 2 : 0;
}

// ─── Evidence helpers ──────────────────────────────────────────────────────────

/** Return the primary (highest confidence) evidence object. */
export function primaryEvidence(edge: NetworkEdge): Evidence | null {
  if (!edge.evidence || edge.evidence.length === 0) return null;
  return edge.evidence.reduce((best, ev) =>
    ev.confidence > best.confidence ? ev : best,
  );
}

/** Human-readable algorithm label. */
export function algorithmLabel(
  algorithm: Evidence["algorithm"],
  lang: "es" | "en" = "es",
): string {
  const labels: Record<Evidence["algorithm"], { es: string; en: string }> = {
    exact_match_nit: {
      es: "Verificado por NIT en SECOP II",
      en: "Verified by NIT in SECOP II",
    },
    exact_match_name: {
      es: "Nombre exacto en SECOP II",
      en: "Exact name match in SECOP II",
    },
    name_plus_dept: {
      es: "Nombre y departamento verificados",
      en: "Name and department verified",
    },
    fuzzy_match_name: {
      es: "Nombre similar (pequeña diferencia ortográfica)",
      en: "Similar name (minor spelling difference)",
    },
    pattern_repetition: {
      es: "Patrón repetido — verificar fuente",
      en: "Repeated pattern — verify source",
    },
    pattern_weak: {
      es: "Relación inferida — baja confianza",
      en: "Inferred relation — low confidence",
    },
    same_address: {
      es: "Mismo domicilio fiscal",
      en: "Same fiscal address",
    },
    political_donation: {
      es: "Donación política (CNE)",
      en: "Political donation (CNE)",
    },
  };
  return labels[algorithm]?.[lang] ?? algorithm;
}
