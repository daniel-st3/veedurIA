"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { NetworkEdge, NetworkNode } from "@/lib/network/types";
import { resolveNodeColor, nodeRadius } from "@/lib/network/buildNodes";
import { edgeWidth, edgeColor } from "@/lib/network/buildEdges";
import { networkConfig } from "@/lib/network/config";
import type { Lang } from "@/lib/types";

// Dynamic import — ForceGraph2D uses canvas/WebGL, incompatible with SSR
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false }) as any;

/** Convert a 6-digit hex color (#rrggbb) to rgba() — Canvas API does not support 8-digit hex universally. */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

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
  height = 560,
}: Props) {
  const graphRef = useRef<any>(null);
  const autoFitRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Only render on client (canvas requires window)
  useEffect(() => { setMounted(true); }, []);

  // Center on selected node
  useEffect(() => {
    if (!selectedNodeId || !graphRef.current) return;
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (node && typeof node.x === "number" && typeof node.y === "number") {
      graphRef.current.centerAt(node.x, node.y, 500);
      graphRef.current.zoom(2.2, 500);
    }
  }, [selectedNodeId, nodes]);

  useEffect(() => {
    autoFitRef.current = false;
    if (!graphRef.current) return;

    const chargeForce = graphRef.current.d3Force("charge");
    if (chargeForce) chargeForce.strength(networkConfig.canvas.physics.chargeStrength);

    const linkForce = graphRef.current.d3Force("link");
    if (linkForce) linkForce.distance(networkConfig.canvas.physics.linkDistance);

    graphRef.current.d3ReheatSimulation();
  }, [nodes.length, edges.length]);

  // ── Custom node rendering ────────────────────────────────────────────────

  const renderNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      try {
      const typedNode = node as NetworkNode & { x: number; y: number };
      const r = nodeRadius(typedNode);
      const isSelected = typedNode.id === selectedNodeId;
      const isHovered = typedNode.id === hoveredNodeId;
      const color = resolveNodeColor(typedNode, selectedNodeId, hoveredNodeId);

      // Outer glow ring — selected node: gold, hovered: white, hub: subtle
      if (isSelected) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(typedNode.x, typedNode.y, r + 6, 0, 2 * Math.PI);
        const glowGrad = ctx.createRadialGradient(typedNode.x, typedNode.y, r, typedNode.x, typedNode.y, r + 10);
        glowGrad.addColorStop(0, "rgba(255,215,0,0.45)");
        glowGrad.addColorStop(1, "rgba(255,215,0,0)");
        ctx.fillStyle = glowGrad;
        ctx.fill();
        ctx.restore();
      } else if (isHovered) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(typedNode.x, typedNode.y, r + 4, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fill();
        ctx.restore();
      } else if (typedNode.is_hub) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(typedNode.x, typedNode.y, r + 3, 0, 2 * Math.PI);
        ctx.fillStyle = hexToRgba(color, 0.13);
        ctx.fill();
        ctx.restore();
      }

      // Node fill with subtle radial sheen
      const grad = ctx.createRadialGradient(
        typedNode.x - r * 0.28, typedNode.y - r * 0.28, r * 0.05,
        typedNode.x, typedNode.y, r,
      );
      grad.addColorStop(0, color);
      grad.addColorStop(1, hexToRgba(color, 0.73));
      ctx.fillStyle = isSelected ? "#ffd700" : grad;
      ctx.beginPath();
      ctx.arc(typedNode.x, typedNode.y, r, 0, 2 * Math.PI);
      ctx.fill();

      // Thin border ring
      ctx.strokeStyle = isSelected
        ? "rgba(255,235,100,0.9)"
        : typedNode.is_hub
          ? "rgba(255,255,255,0.28)"
          : "rgba(255,255,255,0.10)";
      ctx.lineWidth = isSelected ? 1.8 : 0.8;
      ctx.stroke();

      // Label visibility strategy:
      //   • Always show for selected and hovered nodes
      //   • Hubs: show always but with tighter truncation
      //   • Other nodes: only show when zoomed in past threshold (2×)
      const forceShow = isSelected || isHovered;
      const showLabel = forceShow || typedNode.is_hub || globalScale > networkConfig.canvas.labelZoomThreshold;

      if (showLabel) {
        // Fixed on-screen pixel size regardless of zoom
        const targetPx = isSelected ? 13 : typedNode.is_hub ? 11.5 : 10;
        const fontSize = Math.max(targetPx / globalScale, 5.5);
        const isBold = isSelected || typedNode.is_hub;
        ctx.font = `${isBold ? "600 " : ""}${fontSize}px Inter,ui-sans-serif,sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        // Hub labels truncate more aggressively to avoid collision
        const maxLen = isHovered || isSelected
          ? networkConfig.canvas.labelMaxLength + 6
          : typedNode.is_hub
            ? networkConfig.canvas.labelMaxLength
            : 10;
        const label =
          typedNode.label.length > maxLen
            ? typedNode.label.slice(0, maxLen - 1) + "…"
            : typedNode.label;

        const metrics = ctx.measureText(label);
        const tw = metrics.width;
        const th = fontSize * 1.15;
        const px = isSelected ? 5 : 3;
        const py = 1.5;
        const lx = typedNode.x;
        const ly = typedNode.y + r + 3.5;

        // Pill background — darker and more opaque for selected/hubs
        const pillAlpha = isSelected ? 0.92 : typedNode.is_hub ? 0.80 : 0.68;
        ctx.fillStyle = `rgba(4,9,20,${pillAlpha})`;
        ctx.fillRect(lx - tw / 2 - px, ly - py, tw + px * 2, th + py * 2);

        // Thin top border on pill to lift it from node
        ctx.strokeStyle = isSelected
          ? "rgba(255,215,0,0.5)"
          : typedNode.is_hub
            ? "rgba(100,160,255,0.3)"
            : "rgba(100,160,255,0.15)";
        ctx.lineWidth = 0.5 / globalScale;
        ctx.strokeRect(lx - tw / 2 - px, ly - py, tw + px * 2, th + py * 2);

        // Label text
        ctx.fillStyle = isSelected
          ? "#ffd700"
          : typedNode.is_hub
            ? "rgba(220,235,255,0.97)"
            : "rgba(160,200,255,0.82)";
        ctx.fillText(label, lx, ly);
      }
      } catch {
        // Silently swallow canvas errors so a single bad node never crashes the page
      }
    },
    [selectedNodeId, hoveredNodeId],
  );

  // ── Zoom controls (keeps page scroll intact) ─────────────────────────────

  const handleZoomIn = useCallback(() => {
    if (graphRef.current) {
      const current = graphRef.current.zoom() ?? 1;
      const next = Math.min(current * 1.4, 12);
      graphRef.current.zoom(next, 350);
      setZoomLevel(next);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (graphRef.current) {
      const current = graphRef.current.zoom() ?? 1;
      const next = Math.max(current / 1.4, 0.2);
      graphRef.current.zoom(next, 350);
      setZoomLevel(next);
    }
  }, []);

  const handleZoomReset = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(450, 72);
      setZoomLevel(1);
    }
  }, []);

  // Prevent wheel events from scrolling the page ONLY when pointer is over canvas
  // and user is actively interacting (no modifier key needed)
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    // Allow page scroll when holding shift
    if (e.shiftKey) return;
    e.stopPropagation();
  }, []);

  // ── Event handlers ────────────────────────────────────────────────────────

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

  // ── Graph data ────────────────────────────────────────────────────────────

  const graphData = {
    nodes: nodes.map((n) => ({ ...n })),
    links: edges.map((e) => ({ ...e })),
  };

  if (!mounted) {
    return (
      <div
        className="sed-canvas-loading"
        style={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <span style={{ color: "rgba(120,160,220,0.5)", fontSize: "0.9rem" }}>
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
        // Link rendering
        linkWidth={(link: any) => edgeWidth(link as NetworkEdge)}
        linkColor={(link: any) =>
          edgeColor(link as NetworkEdge, selectedEdgeId, hoveredNodeId)
        }
        linkDirectionalParticles={(link: any) =>
          (() => {
            const sourceId = typeof link.source === "string" ? link.source : link.source?.id;
            const targetId = typeof link.target === "string" ? link.target : link.target?.id;
            const isHoveredLink = hoveredNodeId && (sourceId === hoveredNodeId || targetId === hoveredNodeId);
            if (link.id === selectedEdgeId) return 4;
            if (isHoveredLink && link.confidence >= 80) return 2;
            return 0;
          })()
        }
        linkDirectionalParticleSpeed={0.003}
        linkDirectionalParticleWidth={(link: any) =>
          (link as NetworkEdge).confidence >= 80 ? 2.5 : 1.5
        }
        linkLabel={() => ""}
        // Events
        onNodeClick={handleNodeClick}
        onLinkClick={handleEdgeClick}
        onNodeHover={handleNodeHover}
        onBackgroundClick={onBackgroundClick}
        onZoom={({ k }: { k: number }) => setZoomLevel(k)}
        onEngineStop={() => {
          if (!selectedNodeId && !autoFitRef.current && graphRef.current && nodes.length > 0) {
            autoFitRef.current = true;
            graphRef.current.zoomToFit(450, 72);
          }
        }}
        // Physics
        d3AlphaDecay={networkConfig.canvas.physics.alphaDecay}
        d3VelocityDecay={networkConfig.canvas.physics.velocityDecay}
        cooldownTicks={networkConfig.canvas.physics.cooldownTicks}
        // Interaction — keep wheel sensitivity low so page scroll is not hijacked
        // Performance
        autoPauseRedraw
        warmupTicks={30}
      />

      {/* Zoom controls — always visible overlay */}
      <div className="sed-canvas-controls" aria-label={lang === "es" ? "Controles de zoom" : "Zoom controls"}>
        <button className="sed-canvas-ctrl-btn" onClick={handleZoomIn} title={lang === "es" ? "Acercar" : "Zoom in"} aria-label={lang === "es" ? "Acercar" : "Zoom in"}>+</button>
        <button className="sed-canvas-ctrl-btn sed-canvas-ctrl-btn--reset" onClick={handleZoomReset} title={lang === "es" ? "Ajustar" : "Fit"} aria-label={lang === "es" ? "Ajustar" : "Fit"}>⤢</button>
        <button className="sed-canvas-ctrl-btn" onClick={handleZoomOut} title={lang === "es" ? "Alejar" : "Zoom out"} aria-label={lang === "es" ? "Alejar" : "Zoom out"}>−</button>
      </div>

      {/* Hint shown when zoom is near default */}
      {zoomLevel <= 1.05 && nodes.length > 0 && (
        <div className="sed-canvas-hint" aria-hidden="true">
          {lang === "es" ? "Arrastra para explorar · Usa + para acercar" : "Drag to explore · Use + to zoom"}
        </div>
      )}
    </div>
  );
}
