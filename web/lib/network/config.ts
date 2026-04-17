/**
 * networkConfig — Single source of truth for SigueElDinero behavior.
 *
 * HOW TO ADD A NEW NODE TYPE:
 * 1. Add entry to networkConfig.nodeTypes array
 * 2. Add the new type to NodeType union in types.ts
 * 3. Add a color case in NetworkCanvas renderNode()
 * No other files need to change.
 *
 * HOW TO ADD A NEW EDGE TYPE:
 * 1. Add entry to networkConfig.edgeTypes array
 * 2. Add the new type to EdgeType union in types.ts
 * 3. Update EdgeModal to handle the new type's evidence display
 * No other files need to change.
 */

import type { NodeType, EdgeType, EvidenceSource } from "./types";

export const networkConfig = {
  nodeTypes: [
    {
      type: "entity" as NodeType,
      label: { es: "Entidad pública", en: "Public entity" },
      color: "#0d5bd7",
      selectedColor: "#c62839",
      hoverColor: "#2f7cff",
      minRadiusPx: 5,
      maxRadiusPx: 18,
    },
    {
      type: "provider" as NodeType,
      label: { es: "Proveedor", en: "Provider" },
      color: "#0a7a4e",
      selectedColor: "#c62839",
      hoverColor: "#0fa869",
      minRadiusPx: 4,
      maxRadiusPx: 14,
    },
    {
      type: "cluster" as NodeType,
      label: { es: "Grupo por departamento", en: "Department cluster" },
      color: "#6d28d9",
      selectedColor: "#c62839",
      hoverColor: "#8b5cf6",
      minRadiusPx: 8,
      maxRadiusPx: 19,
    },
    // Future node types — add here without touching UI components:
    // { type: "politician", label: { es: "Político", en: "Politician" }, color: "#f97316", ... },
    // { type: "legal_rep", label: { es: "Representante legal", en: "Legal rep" }, color: "#a78bfa", ... },
  ],

  edgeTypes: [
    {
      type: "contrato-proveedor" as EdgeType,
      label: { es: "Contrato público", en: "Public contract" },
      description: {
        es: "Relación de contratación directa registrada en SECOP II",
        en: "Direct contracting relationship registered in SECOP II",
      },
      minConfidence: 40,
      source: "SECOP_II" as EvidenceSource,
    },
    // Future edge types — add here:
    // { type: "donacion-candidato", source: "CNE", label: {...}, description: {...} },
    // { type: "mismo-representante", source: "Registraduría", label: {...}, description: {...} },
  ],

  clustering: {
    enabled: true,
    threshold: 100,            // cluster if node has > this many connections
    algorithm: "department",   // group by departamento for MVP
  },

  canvas: {
    maxNodes: 300,
    initialHubs: 14,           // start with a lighter frame so the first read feels intentional, not crowded
    expandLimit: 48,
    backgroundColor: "rgba(0,0,0,0)",
    physics: {
      alphaDecay: 0.028,       // fast settling — sim reaches equilibrium in ~3s instead of 15s
      velocityDecay: 0.40,     // standard D3 damping — eliminates jitter after settle
      cooldownTicks: 200,      // enough ticks for full convergence with new decay
      chargeStrength: -400,    // balanced repulsion — nodes spread naturally without flying apart
      linkDistance: 200,       // tighter web — edges form a clear structure
      collisionPadding: 18,    // comfortable spacing without over-spreading
    },
    labelZoomThreshold: 1.5,   // show labels earlier
    hubLabelZoomThreshold: 0.7, // hub labels visible at any reasonable zoom
    labelMaxLength: 26,        // allow longer names before truncating
  },

  cache: {
    enabled: true,
    ttlMs: 3_600_000,           // 1 hour
    storage: "localStorage" as const,
    keyPrefix: "veeduria_network_",
  },

  confidence: {
    defaultMinimum: 40,
    highThreshold: 80,          // green badge
    mediumThreshold: 60,        // yellow badge
  },
} as const;

export type NetworkConfig = typeof networkConfig;

// ─── Helpers derived from config ─────────────────────────────────────────────

export function getNodeColor(type: NodeType): string {
  const def = networkConfig.nodeTypes.find((t) => t.type === type);
  return def?.color ?? "#888";
}

export function getNodeSelectedColor(type: NodeType): string {
  const def = networkConfig.nodeTypes.find((t) => t.type === type);
  return def?.selectedColor ?? "#ffd700";
}

export function getNodeHoverColor(type: NodeType): string {
  const def = networkConfig.nodeTypes.find((t) => t.type === type);
  return def?.hoverColor ?? "#fff";
}

export function getNodeTypeLabel(type: NodeType, lang: "es" | "en" = "es"): string {
  const def = networkConfig.nodeTypes.find((t) => t.type === type);
  return def?.label[lang] ?? type;
}

export function getEdgeTypeLabel(type: string, lang: "es" | "en" = "es"): string {
  const def = networkConfig.edgeTypes.find((t) => t.type === type);
  if (!def) return type;
  return (def.label as Record<string, string>)[lang] ?? type;
}

export function confidenceBandColor(confidence: number): string {
  if (confidence >= networkConfig.confidence.highThreshold) return "rgba(32,201,151,0.55)";
  if (confidence >= networkConfig.confidence.mediumThreshold) return "rgba(234,179,8,0.45)";
  return "rgba(239,68,68,0.30)";
}

export function confidenceBandLabel(confidence: number, lang: "es" | "en" = "es"): string {
  const labels = {
    es: { high: "Alta confianza", medium: "Confianza media", low: "Relación inferida" },
    en: { high: "High confidence", medium: "Medium confidence", low: "Inferred relation" },
  };
  if (confidence >= networkConfig.confidence.highThreshold) return labels[lang].high;
  if (confidence >= networkConfig.confidence.mediumThreshold) return labels[lang].medium;
  return labels[lang].low;
}
