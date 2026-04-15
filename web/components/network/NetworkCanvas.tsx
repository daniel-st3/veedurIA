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

/** Convert a 6-digit hex color (#rrggbb) to rgba() */
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
  height = 640,
}: Props) {
  const graphRef = useRef<any>(null);
  const autoFitRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Center on selected node
  useEffect(() => {
    if (!selectedNodeId || !graphRef.current) return;
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (node && typeof node.x === "number" && typeof node.y === "number") {
      graphRef.current.centerAt(node.x, node.y, 600);
      graphRef.current.zoom(2.4, 600);
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

        // Outer glow ring
        if (isSelected) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(typedNode.x, typedNode.y, r + 7, 0, 2 * Math.PI);
          const glowGrad = ctx.createRadialGradient(
            typedNode.x, typedNode.y, r,
            typedNode.x, typedNode.y, r + 14,
          );
          glowGrad.addColorStop(0, "rgba(252,209,22,0.55)");
          glowGrad.addColorStop(1, "rgba(252,209,22,0)");
          ctx.fillStyle = glowGrad;
          ctx.fill();
          ctx.restore();
        } else if (isHovered) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(typedNode.x, typedNode.y, r + 5, 0, 2 * Math.PI);
          const hoverGrad = ctx.createRadialGradient(
            typedNode.x, typedNode.y, r * 0.5,
            typedNode.x, typedNode.y, r + 8,
          );
          hoverGrad.addColorStop(0, hexToRgba(color, 0.35));
          hoverGrad.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = hoverGrad;
          ctx.fill();
          ctx.restore();
        } else if (typedNode.is_hub) {
          // Subtle ambient glow for hub nodes
          ctx.save();
          ctx.beginPath();
          ctx.arc(typedNode.x, typedNode.y, r + 4, 0, 2 * Math.PI);
          const hubGrad = ctx.createRadialGradient(
            typedNode.x, typedNode.y, r * 0.6,
            typedNode.x, typedNode.y, r + 6,
          );
          hubGrad.addColorStop(0, hexToRgba(color, 0.22));
          hubGrad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = hubGrad;
          ctx.fill();
          ctx.restore();
        }

        // Node fill — radial gradient for depth
        const grad = ctx.createRadialGradient(
          typedNode.x - r * 0.3, typedNode.y - r * 0.3, r * 0.05,
          typedNode.x, typedNode.y, r * 1.1,
        );
        if (isSelected) {
          grad.addColorStop(0, "#fff5b0");
          grad.addColorStop(0.5, "#FCD116");
          grad.addColorStop(1, "#c89800");
        } else {
          grad.addColorStop(0, hexToRgba(color, 0.95));
          grad.addColorStop(0.65, color);
          grad.addColorStop(1, hexToRgba(color, 0.78));
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(typedNode.x, typedNode.y, r, 0, 2 * Math.PI);
        ctx.fill();

        // Border ring
        ctx.strokeStyle = isSelected
          ? "rgba(252,225,80,0.95)"
          : isHovered
            ? "rgba(255,255,255,0.55)"
            : typedNode.is_hub
              ? hexToRgba(color, 0.55)
              : hexToRgba(color, 0.28);
        ctx.lineWidth = isSelected ? 2 : isHovered ? 1.5 : 0.9;
        ctx.stroke();

        // ── Label rendering ──────────────────────────────────────────────
        // Labels appear only when:
        //   • node is selected or hovered  (always)
        //   • hub node + zoom > hubLabelZoomThreshold
        //   • any node + zoom > labelZoomThreshold
        const forceShow = isSelected || isHovered;
        const hubThreshold = (networkConfig.canvas as any).hubLabelZoomThreshold ?? 1.6;
        const showLabel =
          forceShow ||
          (typedNode.is_hub && globalScale >= hubThreshold) ||
          globalScale >= networkConfig.canvas.labelZoomThreshold;

        if (showLabel) {
          const targetPx = isSelected ? 13 : typedNode.is_hub ? 11 : 10;
          const fontSize = Math.max(targetPx / globalScale, 5);
          const isBold = isSelected || typedNode.is_hub;
          ctx.font = `${isBold ? "600 " : ""}${fontSize}px Inter,ui-sans-serif,sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";

          const maxLen = forceShow
            ? networkConfig.canvas.labelMaxLength + 8
            : typedNode.is_hub
              ? networkConfig.canvas.labelMaxLength
              : 12;
          const label =
            typedNode.label.length > maxLen
              ? typedNode.label.slice(0, maxLen - 1) + "…"
              : typedNode.label;

          const metrics = ctx.measureText(label);
          const tw = metrics.width;
          const th = fontSize * 1.2;
          const px = isSelected ? 5.5 : 3.5;
          const py = 2;
          const lx = typedNode.x;
          const ly = typedNode.y + r + 4;

          // Pill background — frosted glass effect
          const pillAlpha = isSelected ? 0.94 : typedNode.is_hub ? 0.84 : 0.72;
          const pillRadius = (th + py * 2) / 2;
          const pillX = lx - tw / 2 - px;
          const pillY = ly - py;
          const pillW = tw + px * 2;
          const pillH = th + py * 2;

          ctx.fillStyle = `rgba(5,10,22,${pillAlpha})`;
          // Rounded pill
          ctx.beginPath();
          ctx.moveTo(pillX + pillRadius, pillY);
          ctx.lineTo(pillX + pillW - pillRadius, pillY);
          ctx.quadraticCurveTo(pillX + pillW, pillY, pillX + pillW, pillY + pillRadius);
          ctx.lineTo(pillX + pillW, pillY + pillH - pillRadius);
          ctx.quadraticCurveTo(pillX + pillW, pillY + pillH, pillX + pillW - pillRadius, pillY + pillH);
          ctx.lineTo(pillX + pillRadius, pillY + pillH);
          ctx.quadraticCurveTo(pillX, pillY + pillH, pillX, pillY + pillH - pillRadius);
          ctx.lineTo(pillX, pillY + pillRadius);
          ctx.quadraticCurveTo(pillX, pillY, pillX + pillRadius, pillY);
          ctx.closePath();
          ctx.fill();

          // Pill border
          ctx.strokeStyle = isSelected
            ? "rgba(252,209,22,0.55)"
            : typedNode.is_hub
              ? hexToRgba(color, 0.4)
              : "rgba(100,160,255,0.18)";
          ctx.lineWidth = 0.5 / globalScale;
          ctx.stroke();

          // Label text
          ctx.fillStyle = isSelected
            ? "#FCD116"
            : typedNode.is_hub
              ? "rgba(225,240,255,0.96)"
              : "rgba(170,210,255,0.85)";
          ctx.fillText(label, lx, ly);
        }
      } catch {
        // Silently swallow canvas errors
      }
    },
    [selectedNodeId, hoveredNodeId],
  );

  // ── Pointer hit area (must match visual radius so clicks register) ────────
  const paintPointerArea = useCallback(
    (node: any, color: string, ctx: CanvasRenderingContext2D) => {
      try {
        const typedNode = node as NetworkNode & { x: number; y: number };
        const r = nodeRadius(typedNode);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(typedNode.x, typedNode.y, r + 4, 0, 2 * Math.PI);
        ctx.fill();
      } catch { /* ignore */ }
    },
    [],
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
      graphRef.current.zoomToFit(450, 80);
      setZoomLevel(1);
    }
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
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
        nodePointerAreaPaint={paintPointerArea}
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
            if (link.id === selectedEdgeId) return 5;
            if (isHoveredLink && link.confidence >= 80) return 3;
            return 0;
          })()
        }
        linkDirectionalParticleSpeed={0.004}
        linkDirectionalParticleWidth={(link: any) =>
          (link as NetworkEdge).confidence >= 80 ? 3 : 2
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
            graphRef.current.zoomToFit(500, 80);
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
        <button className="sed-canvas-ctrl-btn" onClick={handleZoomIn} title={lang === "es" ? "Acercar" : "Zoom in"} aria-label={lang === "es" ? "Acercar" : "Zoom in"}>+</button>
        <button className="sed-canvas-ctrl-btn sed-canvas-ctrl-btn--reset" onClick={handleZoomReset} title={lang === "es" ? "Ajustar" : "Fit"} aria-label={lang === "es" ? "Ajustar" : "Fit"}>⤢</button>
        <button className="sed-canvas-ctrl-btn" onClick={handleZoomOut} title={lang === "es" ? "Alejar" : "Zoom out"} aria-label={lang === "es" ? "Alejar" : "Zoom out"}>−</button>
      </div>

      {/* Hover hint */}
      {zoomLevel <= 1.05 && nodes.length > 0 && (
        <div className="sed-canvas-hint" aria-hidden="true">
          {lang === "es"
            ? "Arrastra · Haz clic en un nodo · Usa + para acercar"
            : "Drag · Click a node · Use + to zoom in"}
        </div>
      )}
    </div>
  );
}
