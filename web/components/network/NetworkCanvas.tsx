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
      const typedNode = node as NetworkNode & { x: number; y: number };
      const r = nodeRadius(typedNode);
      const isSelected = typedNode.id === selectedNodeId;
      const isHovered = typedNode.id === hoveredNodeId;
      const color = resolveNodeColor(typedNode, selectedNodeId, hoveredNodeId);

      // Glow effect on selected node
      if (isSelected) {
        ctx.save();
        ctx.shadowBlur = 22;
        ctx.shadowColor = "#ffd700";
        ctx.fillStyle = "#ffd700";
        ctx.beginPath();
        ctx.arc(typedNode.x, typedNode.y, r + 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
      }

      // Node circle
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(typedNode.x, typedNode.y, r, 0, 2 * Math.PI);
      ctx.fill();

      // Hub ring
      if (typedNode.is_hub && !isSelected) {
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(typedNode.x, typedNode.y, r + 2, 0, 2 * Math.PI);
        ctx.stroke();
      }

      // Label: only for hubs or selected node, only when zoomed in enough
      const showLabel =
        (typedNode.is_hub || isSelected || isHovered) &&
        globalScale > networkConfig.canvas.labelZoomThreshold;

      if (showLabel) {
        const fontSize = Math.min(12, 9 / globalScale + 2);
        ctx.font = `${isSelected ? "bold " : ""}${fontSize}px Inter,sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const maxLen = networkConfig.canvas.labelMaxLength;
        const label =
          typedNode.label.length > maxLen
            ? typedNode.label.slice(0, maxLen - 1) + "…"
            : typedNode.label;

        // Label shadow for readability
        ctx.fillStyle = "rgba(8,15,30,0.7)";
        ctx.fillText(label, typedNode.x, typedNode.y + r + 3.5);
        ctx.fillStyle = isSelected ? "#ffd700" : "rgba(224,236,255,0.9)";
        ctx.fillText(label, typedNode.x, typedNode.y + r + 3);
      }
    },
    [selectedNodeId, hoveredNodeId],
  );

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
    <div className="sed-canvas-inner" style={{ height }}>
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
            if (isHoveredLink && link.confidence >= 80) return 1;
            return 0;
          })()
        }
        linkDirectionalParticleSpeed={0.0022}
        linkDirectionalParticleWidth={(link: any) =>
          (link as NetworkEdge).confidence >= 80 ? 2 : 1
        }
        linkLabel={() => ""}
        // Events
        onNodeClick={handleNodeClick}
        onLinkClick={handleEdgeClick}
        onNodeHover={handleNodeHover}
        onBackgroundClick={onBackgroundClick}
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
        // Performance
        autoPauseRedraw
        warmupTicks={20}
      />
    </div>
  );
}
