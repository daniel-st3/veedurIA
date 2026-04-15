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
      color: "#1e6fff",
      selectedColor: "#FCD116",
      hoverColor: "#6eb4ff",
      minRadiusPx: 5,
      maxRadiusPx: 22,
    },
    {
      type: "provider" as NodeType,
      label: { es: "Proveedor", en: "Provider" },
      color: "#00c896",
      selectedColor: "#FCD116",
      hoverColor: "#5de8c8",
      minRadiusPx: 4,
      maxRadiusPx: 17,
    },
    {
      type: "cluster" as NodeType,
      label: { es: "Grupo por departamento", en: "Department cluster" },
      color: "#9d6fff",
      selectedColor: "#FCD116",
      hoverColor: "#c4a8ff",
      minRadiusPx: 8,
      maxRadiusPx: 24,
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
    initialHubs: 32,           // small default scene → clean, no label crowding
    expandLimit: 48,
    backgroundColor: "#050b18",
    physics: {
      alphaDecay: 0.010,       // very slow cool-down → nodes spread further before freezing
      velocityDecay: 0.22,     // less friction → organic spread
      cooldownTicks: 320,      // more ticks → better final layout
      chargeStrength: -1100,   // very strong repulsion → wide spider-web
      linkDistance: 260,       // long edges → spacious layout
    },
    labelZoomThreshold: 2.8,   // labels visible only at 2.8× zoom (hub labels at 1.6×)
    hubLabelZoomThreshold: 1.6, // hub labels appear at 1.6× zoom
    labelMaxLength: 16,
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
