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
      color: "#2d6cdf",
      selectedColor: "#ffd700",
      hoverColor: "#6eadff",
      minRadiusPx: 5,
      maxRadiusPx: 20,
    },
    {
      type: "provider" as NodeType,
      label: { es: "Proveedor", en: "Provider" },
      color: "#20c997",
      selectedColor: "#ffd700",
      hoverColor: "#5de0c0",
      minRadiusPx: 4,
      maxRadiusPx: 16,
    },
    {
      type: "cluster" as NodeType,
      label: { es: "Grupo por departamento", en: "Department cluster" },
      color: "#6366f1",
      selectedColor: "#ffd700",
      hoverColor: "#a5b4fc",
      minRadiusPx: 8,
      maxRadiusPx: 22,
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
    initialHubs: 96,
    expandLimit: 48,
    backgroundColor: "#070d1a",
    physics: {
      alphaDecay: 0.022,       // slower cool-down → nodes settle into better positions
      velocityDecay: 0.38,     // less friction → more organic spread
      cooldownTicks: 140,      // more time to stabilize before freeze
      chargeStrength: -320,    // stronger repulsion → nodes spread out like a web
      linkDistance: 130,       // longer edges → more spider-web spacing
    },
    labelZoomThreshold: 0.7,   // show labels at a lower zoom so names are always visible
    labelMaxLength: 22,        // tighter truncation avoids overlapping long names
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
