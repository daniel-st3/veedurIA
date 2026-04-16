"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { forceCollide } from "d3-force-3d";
import type { NetworkEdge, NetworkNode } from "@/lib/network/types";
import { resolveNodeColor, nodeRadius } from "@/lib/network/buildNodes";
import { edgeWidth } from "@/lib/network/buildEdges";
import { networkConfig } from "@/lib/network/config";
import type { Lang } from "@/lib/types";

// Dynamic import — ForceGraph2D uses canvas, incompatible with SSR
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false }) as any;

type Props = {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  hoveredNodeId: string | null;
  lang: Lang;
  onNodeClick: (node: NetworkNode) => void;
  onEdgeClick: (edge: NetworkEdge) => void;
  onNodeHover: (node: NetworkNode | null) => void;
  onBackgroundClick: () => void;
  width?: number;
  height?: number;
};

export function NetworkCanvas({
  nodes,
  edges,
  selectedNodeId,
  selectedEdgeId,
  hoveredNodeId,
  lang,
  onNodeClick,
  onEdgeClick,
  onNodeHover,
  onBackgroundClick,
  width,
  height = 640,
}: Props) {
  const graphRef = useRef<any>(null);
  const autoFitRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const renderedLabelBoxesRef = useRef<Array<{ x: number; y: number; w: number; h: number }>>([]);

  useEffect(() => { setMounted(true); }, []);

  // ── CRITICAL: memoize graph data so hover/selection changes don't restart simulation ──
  const graphData = useMemo(() => ({
    nodes: nodes.map((n) => ({ ...n })),
    links: edges.map((e) => ({ ...e })),
  }), [nodes, edges]);

  const topLabelIds = useMemo(() => {
    return [...nodes]
      .sort((left, right) => {
        const hubDelta = Number(right.is_hub) - Number(left.is_hub);
        if (hubDelta !== 0) return hubDelta;
        const connectionDelta = right.connection_count - left.connection_count;
        if (connectionDelta !== 0) return connectionDelta;
        return right.total_value - left.total_value;
      })
      .slice(0, 7)
      .map((node) => node.id);
  }, [nodes]);

  const focusedNodeId = hoveredNodeId ?? selectedNodeId;

  // ── Adjacency map for neighbor highlighting ──────────────────────────────
  const adjacencyMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    edges.forEach((e) => {
      // After d3-force processes the graph, source/target become objects; handle both
      const src = typeof e.source === "string" ? e.source : (e.source as any)?.id ?? "";
      const tgt = typeof e.target === "string" ? e.target : (e.target as any)?.id ?? "";
      if (!src || !tgt) return;
      if (!map.has(src)) map.set(src, new Set());
      if (!map.has(tgt)) map.set(tgt, new Set());
      map.get(src)!.add(tgt);
      map.get(tgt)!.add(src);
    });
    return map;
  }, [edges]);

  // Center on selected node
  useEffect(() => {
    if (!selectedNodeId || !graphRef.current) return;
    const node = graphData.nodes.find((n) => n.id === selectedNodeId);
    if (node && typeof node.x === "number" && typeof node.y === "number") {
      graphRef.current.centerAt(node.x, node.y, 600);
      graphRef.current.zoom(1.8, 600);
    }
  }, [selectedNodeId, graphData.nodes]);

  useEffect(() => {
    autoFitRef.current = false;
    if (!graphRef.current) return;
    const chargeForce = graphRef.current.d3Force("charge");
    if (chargeForce) chargeForce.strength(networkConfig.canvas.physics.chargeStrength);
    const linkForce = graphRef.current.d3Force("link");
    if (linkForce) linkForce.distance(networkConfig.canvas.physics.linkDistance);
    graphRef.current.d3Force(
      "collision",
      forceCollide((node: NetworkNode) => nodeRadius(node) + networkConfig.canvas.physics.collisionPadding)
        .strength(0.95)
        .iterations(3),
    );
    graphRef.current.d3ReheatSimulation();
  }, [nodes.length, edges.length]);

  // ── Custom node rendering ────────────────────────────────────────────────
  const renderNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      try {
        const typedNode = node as NetworkNode & { x: number; y: number };
        if (typedNode.id === graphData.nodes[0]?.id) {
          renderedLabelBoxesRef.current = [];
        }
        const r = nodeRadius(typedNode);
        const isSelected = typedNode.id === selectedNodeId;
        const isHovered = typedNode.id === hoveredNodeId;
        const color = resolveNodeColor(typedNode, selectedNodeId, hoveredNodeId);

        // Determine neighbor state for dimming
        const neighbors = focusedNodeId ? adjacencyMap.get(focusedNodeId) : null;
        const isNeighbor = neighbors?.has(typedNode.id) ?? false;
        const isDimmed = !!focusedNodeId && !isHovered && !isSelected && !isNeighbor;
        const isPrimaryLabel = topLabelIds.includes(typedNode.id);

        // Apply opacity dimming for non-neighbor nodes
        ctx.save();
        ctx.globalAlpha = isDimmed ? 0.12 : 1.0;

        // Glow / halo
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(typedNode.x, typedNode.y, r + 6, 0, 2 * Math.PI);
          const glow = ctx.createRadialGradient(typedNode.x, typedNode.y, r, typedNode.x, typedNode.y, r + 12);
          glow.addColorStop(0, "rgba(198,40,57,0.4)");
          glow.addColorStop(1, "rgba(198,40,57,0)");
          ctx.fillStyle = glow;
          ctx.fill();
        } else if (isHovered || isNeighbor) {
          ctx.beginPath();
          ctx.arc(typedNode.x, typedNode.y, r + 4, 0, 2 * Math.PI);
          const hGlow = ctx.createRadialGradient(typedNode.x, typedNode.y, r * 0.5, typedNode.x, typedNode.y, r + 7);
          hGlow.addColorStop(0, `${color}55`);
          hGlow.addColorStop(1, `${color}00`);
          ctx.fillStyle = hGlow;
          ctx.fill();
        }

        // Node fill — solid color with inner sheen
        if (isSelected) {
          ctx.fillStyle = "#c62839";
        } else {
          const grad = ctx.createRadialGradient(
            typedNode.x - r * 0.3, typedNode.y - r * 0.32, r * 0.05,
            typedNode.x, typedNode.y, r * 1.1,
          );
          grad.addColorStop(0, isHovered || isNeighbor
            ? color.replace(/^#/, "").length === 6
              ? lightenHex(color, 0.28)
              : color
            : lightenHex(color, 0.12));
          grad.addColorStop(1, color);
          ctx.fillStyle = grad;
        }
        ctx.beginPath();
        ctx.arc(typedNode.x, typedNode.y, r, 0, 2 * Math.PI);
        ctx.fill();

        // Node border
        ctx.strokeStyle = isSelected
          ? "rgba(198,40,57,0.9)"
          : isHovered || isNeighbor
            ? `${color}cc`
            : typedNode.is_hub
              ? `${color}88`
              : `${color}44`;
        ctx.lineWidth = isSelected ? 2.5 : isHovered ? 1.8 : typedNode.is_hub ? 1.2 : 0.7;
        ctx.stroke();

        // Thin white inner ring for depth
        if (r > 7) {
          ctx.beginPath();
          ctx.arc(typedNode.x - r * 0.22, typedNode.y - r * 0.22, r * 0.28, 0, 2 * Math.PI);
          ctx.fillStyle = "rgba(255,255,255,0.22)";
          ctx.fill();
        }

        // ── Label ──────────────────────────────────────────────────────────
        // Default view keeps a curated set of names visible.
        // Hover or click focuses a node and reveals its neighborhood labels.
        const hubThreshold = (networkConfig.canvas as any).hubLabelZoomThreshold ?? 1.4;
        const forceShow = isSelected || isHovered;
        const neighborShow = isNeighbor && !!focusedNodeId;
        const showLabel =
          !isDimmed && (
            forceShow ||
            neighborShow ||
            (isPrimaryLabel && globalScale >= 0.9) ||
            (typedNode.is_hub && globalScale >= hubThreshold) ||
            globalScale >= networkConfig.canvas.labelZoomThreshold
          );

        if (showLabel) {
          const targetPx = isSelected ? 13 : isHovered || isNeighbor ? 11.5 : isPrimaryLabel ? 10.5 : 9.5;
          const fontSize = Math.max(targetPx / globalScale, 5.5);
          const isBold = isSelected || typedNode.is_hub || isHovered || isPrimaryLabel;
          ctx.font = `${isBold ? "600 " : ""}${fontSize}px Inter,ui-sans-serif,sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          const maxLen = forceShow
            ? networkConfig.canvas.labelMaxLength + 10
            : neighborShow
              ? networkConfig.canvas.labelMaxLength + 4
              : typedNode.is_hub
                ? networkConfig.canvas.labelMaxLength
                : isPrimaryLabel
                  ? 14
                  : 11;
          const label =
            typedNode.label.length > maxLen
              ? typedNode.label.slice(0, maxLen - 1) + "…"
              : typedNode.label;

          const m = ctx.measureText(label);
          const tw = m.width;
          const th = fontSize * 1.2;
          const px = isSelected ? 6 : 4;
          const py = 2;
          const lx = typedNode.x;
          const labelOffset = forceShow || neighborShow ? r + 16 : r + 12;
          const labelDirection = typedNode.y > height * 0.58 ? -1 : 1;
          const ly = typedNode.y + labelDirection * labelOffset;
          const pr = (th + py * 2) / 2; // pill corner radius
          const proposedBox = {
            x: lx - tw / 2 - px - 4,
            y: ly - th / 2 - py - 3,
            w: tw + px * 2 + 8,
            h: th + py * 2 + 6,
          };

          const collidesWithExistingLabel = renderedLabelBoxesRef.current.some((box) =>
            !(
              proposedBox.x + proposedBox.w < box.x ||
              box.x + box.w < proposedBox.x ||
              proposedBox.y + proposedBox.h < box.y ||
              box.y + box.h < proposedBox.y
            ),
          );

          if (collidesWithExistingLabel && !forceShow && !neighborShow) {
            ctx.restore();
            return;
          }

          // Pill background
          const bx = lx - tw / 2 - px;
          const by = ly - th / 2 - py;
          const bw = tw + px * 2;
          const bh = th + py * 2;

          ctx.fillStyle = isSelected
            ? "rgba(255,255,255,0.98)"
            : neighborShow || isHovered
              ? "rgba(255,255,255,0.96)"
              : isPrimaryLabel
                ? "rgba(255,252,248,0.94)"
                : "rgba(255,255,255,0.91)";

          ctx.beginPath();
          ctx.moveTo(bx + pr, by);
          ctx.lineTo(bx + bw - pr, by);
          ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + pr);
          ctx.lineTo(bx + bw, by + bh - pr);
          ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - pr, by + bh);
          ctx.lineTo(bx + pr, by + bh);
          ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - pr);
          ctx.lineTo(bx, by + pr);
          ctx.quadraticCurveTo(bx, by, bx + pr, by);
          ctx.closePath();
          ctx.fill();

          // Pill border
          ctx.strokeStyle = isSelected
            ? "rgba(198,40,57,0.35)"
            : neighborShow
              ? `${color}55`
              : isPrimaryLabel
                ? "rgba(23,32,51,0.18)"
              : typedNode.is_hub
                ? `${color}33`
                : "rgba(23,32,51,0.12)";
          ctx.lineWidth = 0.7 / globalScale;
          ctx.stroke();

          // Label text
          ctx.fillStyle = isSelected
            ? "#c62839"
            : neighborShow || isHovered
              ? color
              : isPrimaryLabel || typedNode.is_hub
                ? "#172033"
                : "rgba(23,32,51,0.72)";
          ctx.fillText(label, lx, ly);
          renderedLabelBoxesRef.current.push(proposedBox);
        }

        ctx.restore();
      } catch { /* ignore canvas errors */ }
    },
    [selectedNodeId, hoveredNodeId, adjacencyMap, focusedNodeId, graphData.nodes, height, topLabelIds],
  );

  // ── Pointer hit area (must match visual radius so clicks register accurately) ─
  const paintPointerArea = useCallback(
    (node: any, color: string, ctx: CanvasRenderingContext2D) => {
      try {
        const typedNode = node as NetworkNode & { x: number; y: number };
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(typedNode.x, typedNode.y, nodeRadius(typedNode) + 5, 0, 2 * Math.PI);
        ctx.fill();
      } catch { /* ignore */ }
    },
    [],
  );

  // ── Edge color — dims non-connected edges on hover ───────────────────────
  const getLinkColor = useCallback(
    (link: any) => {
      const sourceId = typeof link.source === "string" ? link.source : link.source?.id;
      const targetId = typeof link.target === "string" ? link.target : link.target?.id;
      const isSelectedEdge = link.id === selectedEdgeId;
      const connectedToFocus =
        focusedNodeId && (sourceId === focusedNodeId || targetId === focusedNodeId);

      if (isSelectedEdge) return "#c62839";
      if (focusedNodeId) {
        if (connectedToFocus) return `rgba(23,32,51,${link.confidence >= 80 ? 0.48 : 0.3})`;
        return "rgba(23,32,51,0.055)";
      }
      // Default: semi-transparent dark edges on cream background
      const conf = (link.confidence ?? 50) / 100;
      return `rgba(23,32,51,${0.12 + conf * 0.18})`;
    },
    [focusedNodeId, selectedEdgeId],
  );

  // ── Zoom controls ────────────────────────────────────────────────────────
  const handleZoomIn = useCallback(() => {
    if (graphRef.current) {
      const next = Math.min((graphRef.current.zoom() ?? 1) * 1.4, 12);
      graphRef.current.zoom(next, 350);
      setZoomLevel(next);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (graphRef.current) {
      const next = Math.max((graphRef.current.zoom() ?? 1) / 1.4, 0.15);
      graphRef.current.zoom(next, 350);
      setZoomLevel(next);
    }
  }, []);

  const handleZoomReset = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(450, 42);
      setZoomLevel(1);
    }
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (e.shiftKey) return;
    e.stopPropagation();
  }, []);

  const handleNodeClick = useCallback(
    (node: any) => onNodeClick(node as NetworkNode),
    [onNodeClick],
  );
  const handleEdgeClick = useCallback(
    (link: any) => onEdgeClick(link as NetworkEdge),
    [onEdgeClick],
  );
  const handleNodeHover = useCallback(
    (node: any | null) => onNodeHover(node ? (node as NetworkNode) : null),
    [onNodeHover],
  );

  if (!mounted) {
    return (
      <div
        className="sed-canvas-loading"
        style={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <span style={{ color: "rgba(23,32,51,0.4)", fontSize: "0.9rem" }}>
          {lang === "es" ? "Cargando visualización…" : "Loading visualization…"}
        </span>
      </div>
    );
  }

  return (
    <div
      className="sed-canvas-inner"
      style={{ height, position: "relative" }}
      ref={wrapRef}
      onWheel={handleWheel}
    >
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        width={width}
        height={height}
        backgroundColor={networkConfig.canvas.backgroundColor}
        // Node rendering
        nodeLabel={() => ""}
        nodeCanvasObject={renderNode}
        nodeCanvasObjectMode={() => "replace"}
        nodePointerAreaPaint={paintPointerArea}
        // Link rendering
        linkWidth={(link: any) => {
          return hoveredNodeId || selectedNodeId ? edgeWidth(link) * 1.2 : edgeWidth(link);
        }}
        linkColor={getLinkColor}
        linkDirectionalParticles={(link: any) => {
          const src = typeof link.source === "string" ? link.source : link.source?.id;
          const tgt = typeof link.target === "string" ? link.target : link.target?.id;
          const focusedLink = focusedNodeId && (src === focusedNodeId || tgt === focusedNodeId);
          if (link.id === selectedEdgeId) return 5;
          if (focusedLink && link.confidence >= 80) return selectedNodeId ? 3 : 2;
          return 0;
        }}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleWidth={2.5}
        linkDirectionalParticleColor={() => "#c62839"}
        linkLabel={() => ""}
        // Events
        onNodeClick={handleNodeClick}
        onLinkClick={handleEdgeClick}
        onNodeHover={handleNodeHover}
        onBackgroundClick={onBackgroundClick}
        onZoom={({ k }: { k: number }) => setZoomLevel(k)}
        enableNodeDrag={false}
        onEngineStop={() => {
          if (!selectedNodeId && !autoFitRef.current && graphRef.current && nodes.length > 0) {
            autoFitRef.current = true;
            graphRef.current.zoomToFit(500, 42);
          }
        }}
        // Physics
        d3AlphaDecay={networkConfig.canvas.physics.alphaDecay}
        d3VelocityDecay={networkConfig.canvas.physics.velocityDecay}
        cooldownTicks={networkConfig.canvas.physics.cooldownTicks}
        // Performance
        autoPauseRedraw
        warmupTicks={40}
      />

      {/* Zoom controls */}
      <div className="sed-canvas-controls" aria-label={lang === "es" ? "Controles de zoom" : "Zoom controls"}>
        <button className="sed-canvas-ctrl-btn" onClick={handleZoomIn} title={lang === "es" ? "Acercar" : "Zoom in"}>+</button>
        <button className="sed-canvas-ctrl-btn sed-canvas-ctrl-btn--reset" onClick={handleZoomReset} title={lang === "es" ? "Ajustar" : "Fit"}>⤢</button>
        <button className="sed-canvas-ctrl-btn" onClick={handleZoomOut} title={lang === "es" ? "Alejar" : "Zoom out"}>−</button>
      </div>

      {zoomLevel <= 1.05 && nodes.length > 0 && (
        <div className="sed-canvas-hint" aria-hidden="true">
          {lang === "es"
            ? "Arrastra · Pasa el cursor por un nodo · Usa + para acercar"
            : "Drag · Hover a node to see its connections · Use + to zoom"}
        </div>
      )}
    </div>
  );
}

/** Lighten a hex color by blending toward white */
function lightenHex(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `#${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`;
}
