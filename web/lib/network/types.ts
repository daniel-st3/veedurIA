/**
 * Network graph types for SigueElDinero.
 *
 * Designed to be forward-compatible with future node types
 * (politician, legal_rep, holding) and edge types (donation, same_rep, same_address).
 *
 * Everything is plain JSON-serializable (no class instances).
 */

import type { Lang } from "@/lib/types";

// ─── Evidence ────────────────────────────────────────────────────────────────

export type EvidenceSource = "SECOP_II" | "CNE" | "Registraduría" | "Inferred";

export type EvidenceAlgorithm =
  | "exact_match_nit"     // 100 — both NITs verified
  | "exact_match_name"    // 90  — exact name match
  | "name_plus_dept"      // 70–80 — name + department
  | "fuzzy_match_name"    // 50  — Levenshtein ≤ 2
  | "pattern_repetition"  // 40  — ≥3 contracts, no NIT
  | "pattern_weak"        // 35  — <3 contracts, no NIT
  | "same_address"        // 60  — future: same fiscal address
  | "political_donation"; // future: campaign donation (CNE)

export type EvidenceExtractedData = {
  contractValue?: number;
  entity?: string;
  contractor?: string;
  modality?: string;
  department?: string;
};

export type Evidence = {
  sourceType: EvidenceSource;
  sourceUrl: string;
  sourceDocument: string;
  sourceDate: string;
  algorithm: EvidenceAlgorithm;
  confidence: number;
  confidenceBand: "high" | "medium" | "low";
  confidenceLabel: string;
  explanation: string;
  extractedData: EvidenceExtractedData;
};

// ─── Edge ─────────────────────────────────────────────────────────────────────

export type EdgeType =
  | "contrato-proveedor"   // MVP: public entity → provider
  | "donacion-candidato"   // future: company → campaign
  | "mismo-representante"  // future: same legal representative
  | "mismo-domicilio"      // future: same fiscal address
  | "cluster-group";       // internal: cluster aggregate

export type NetworkEdge = {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  typeLabel: string;
  typeDescription: string;
  confidence: number;
  confidenceBand: "high" | "medium" | "low";
  confidenceLabel: string;
  total_monto: number;
  total_monto_label: string;
  contract_count: number;
  modalidad: string;
  departamento: string;
  date_range: { from: string; to: string };
  risk_mean: number;
  risk_max: number;
  evidence: Evidence[];
  detectedAt: string;
};

// ─── Node ─────────────────────────────────────────────────────────────────────

export type NodeType =
  | "entity"     // public contracting entity
  | "provider"   // contractor/supplier
  | "cluster"    // aggregated cluster of providers by department
  // future:
  // | "politician"
  // | "legal_rep"
  // | "holding"
  ;

export type NetworkNode = {
  id: string;
  label: string;
  type: NodeType;
  typeLabel: string;
  degree: number;
  total_value: number;
  total_value_label: string;
  mean_risk: number;
  max_risk: number;
  herfindahl: number | null;
  herfindahl_label: string;
  is_hub: boolean;
  department?: string | null;
  nit?: string | null;
  connection_count: number;
  cluster_id?: string | null;
  // cluster-specific fields
  is_cluster?: boolean;
  cluster_hub_id?: string;
  cluster_dept?: string;
  // Runtime coordinates injected by react-force-graph / d3-force.
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
};

// ─── Node Detail (panel data) ─────────────────────────────────────────────────

export type NodeDetailConnection = {
  node_id: string;
  label: string;
  type: NodeType;
  total_monto: number;
  total_monto_label: string;
  contract_count: number;
  confidence: number;
  edge_id: string;
};

export type ModalityBreakdown = {
  modalidad: string;
  count: number;
  share: number;
};

export type TopContract = {
  id: string;
  value: number;
  value_label: string;
  date: string;
  modality: string;
  department: string;
  secop_url: string;
  risk_score: number;
};

export type NetworkNodeDetail = NetworkNode & {
  found: boolean;
  top_connections: NodeDetailConnection[];
  modality_breakdown: ModalityBreakdown[];
  date_range: { from: string; to: string };
  top_contracts: TopContract[];
};

// ─── Payload ──────────────────────────────────────────────────────────────────

export type NetworkMeta = {
  lang: Lang;
  version: string;
  total_nodes: number;
  total_edges: number;
  total_value: number;
  department_filter: string | null;
  built_at: string;
  source: "live" | "cache" | "mock" | "empty";
  confidence_filter: number;
  partial?: boolean;
  query?: string;
  found?: boolean;
  match_label?: string;
  match_type?: NodeType;
  expanded_node?: string;
  new_neighbors?: number;
};

export type NetworkPayload = {
  meta: NetworkMeta;
  nodes: NetworkNode[];
  edges: NetworkEdge[];
};

// ─── Graph data for ForceGraph2D ──────────────────────────────────────────────

/** ForceGraph2D expects { nodes, links } — we call it graphData. */
export type GraphData = {
  nodes: NetworkNode[];
  links: NetworkEdge[];
};

// ─── Error report ─────────────────────────────────────────────────────────────

export type ErrorReportBody = {
  edge_id?: string;
  node_id?: string;
  description: string;
  reporter_email?: string;
};

// ─── Network version ─────────────────────────────────────────────────────────

export type NetworkVersion = {
  version: string;
  built_at: string | null;
  entity_count: number;
  provider_count: number;
  edge_count: number;
  total_value: number;
};
