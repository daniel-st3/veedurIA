/**
 * Frontend node utilities for SigueElDinero.
 *
 * These functions work on already-received NetworkNode arrays from the API.
 * They do NOT build nodes from scratch (that's the Python layer's job).
 * They provide frontend-specific transformations: sizing, color, filtering.
 */

import { networkConfig, getNodeColor } from "./config";
import type { NetworkNode, NodeType } from "./types";

// ─── Node radius (canvas size) ────────────────────────────────────────────────

/**
 * Compute canvas radius for a node based on its total_value.
 * Uses a log scale to prevent mega-contracts from dominating the canvas.
 */
export function nodeRadius(node: NetworkNode): number {
  const cfg = networkConfig.nodeTypes.find((t) => t.type === node.type);
  const min = cfg?.minRadiusPx ?? 4;
  const max = cfg?.maxRadiusPx ?? 18;
  const scale = Math.log1p(node.total_value / 1e8) * 2.5;
  return Math.max(min, Math.min(max, scale));
}

// ─── Node color ────────────────────────────────────────────────────────────────

export function resolveNodeColor(
  node: NetworkNode,
  selectedId: string | null,
  hoveredId: string | null,
): string {
  if (node.id === selectedId) return networkConfig.nodeTypes.find((t) => t.type === node.type)?.selectedColor ?? "#ffd700";
  if (node.id === hoveredId) return networkConfig.nodeTypes.find((t) => t.type === node.type)?.hoverColor ?? "#fff";
  return getNodeColor(node.type);
}

// ─── Node filtering ────────────────────────────────────────────────────────────

export function filterNodesByType(
  nodes: NetworkNode[],
  types: NodeType[],
): NetworkNode[] {
  if (!types.length) return nodes;
  return nodes.filter((n) => types.includes(n.type));
}

export function filterNodesByDepartment(
  nodes: NetworkNode[],
  department: string | null,
): NetworkNode[] {
  if (!department) return nodes;
  const dept = department.toUpperCase();
  return nodes.filter(
    (n) => !n.department || n.department.toUpperCase().includes(dept),
  );
}

// ─── Graph data merging ────────────────────────────────────────────────────────

/**
 * Merge new nodes (from an expand call) into the existing node list,
 * deduplicating by id.
 */
export function mergeNodes(
  existing: NetworkNode[],
  incoming: NetworkNode[],
): NetworkNode[] {
  const map = new Map<string, NetworkNode>(existing.map((n) => [n.id, n]));
  for (const n of incoming) {
    if (!map.has(n.id)) map.set(n.id, n);
  }
  return Array.from(map.values());
}

// ─── Top nodes by value ────────────────────────────────────────────────────────

export function topNodesByValue(
  nodes: NetworkNode[],
  type: NodeType,
  limit: number,
): NetworkNode[] {
  return nodes
    .filter((n) => n.type === type)
    .sort((a, b) => b.total_value - a.total_value)
    .slice(0, limit);
}

// ─── Herfindahl display ────────────────────────────────────────────────────────

export function hhiColor(hhi: number): string {
  if (hhi >= 0.6) return "#ef4444";  // red — critical
  if (hhi >= 0.35) return "#eab308"; // yellow — high
  if (hhi >= 0.15) return "#f97316"; // orange — moderate
  return "#22c55e";                   // green — dispersed
}

export function hhiBarWidth(hhi: number): string {
  return `${Math.round(hhi * 100)}%`;
}
