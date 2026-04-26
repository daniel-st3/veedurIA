"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { forceCollide, forceX, forceY } from "d3-force-3d";
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

type LabelBox = {
  x: number;
  y: number;
  w: number;
  h: number;
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
  const renderedLabelBoxesRef = useRef<LabelBox[]>([]);
  const hoveredNodeIdRef = useRef<string | null>(null);
  const focusedNodeIdRef = useRef<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Sync volatile hover state into refs so renderNode never needs to be recreated on hover
  hoveredNodeIdRef.current = hoveredNodeId;
  focusedNodeIdRef.current = hoveredNodeId ?? selectedNodeId;

  const iconsRef = useRef<Record<string, HTMLImageElement>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  const adjacencyMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    edges.forEach((edge) => {
      const sourceId = resolveLinkEndId(edge.source);
      const targetId = resolveLinkEndId(edge.target);
      if (!sourceId || !targetId) return;
      if (!map.has(sourceId)) map.set(sourceId, new Set());
      if (!map.has(targetId)) map.set(targetId, new Set());
      map.get(sourceId)?.add(targetId);
      map.get(targetId)?.add(sourceId);
    });
    return map;
  }, [edges]);

  const focusedNodeId = hoveredNodeId ?? selectedNodeId;

  const selectedNeighborhoodIds = useMemo(() => {
    const ids = new Set<string>();
    if (!selectedNodeId) return ids;
    ids.add(selectedNodeId);
    adjacencyMap.get(selectedNodeId)?.forEach((id) => ids.add(id));
    return ids;
  }, [adjacencyMap, selectedNodeId]);

  const visibleNodes = useMemo(() => {
    if (!selectedNodeId) return nodes;
    return nodes.filter((node) => selectedNeighborhoodIds.has(node.id));
  }, [nodes, selectedNeighborhoodIds, selectedNodeId]);

  const visibleEdges = useMemo(() => {
    if (!selectedNodeId) return edges;
    return edges.filter((edge) => {
      const sourceId = resolveLinkEndId(edge.source);
      const targetId = resolveLinkEndId(edge.target);
      return selectedNeighborhoodIds.has(sourceId) && selectedNeighborhoodIds.has(targetId);
    });
  }, [edges, selectedNeighborhoodIds, selectedNodeId]);

  const graphData = useMemo(() => ({
    nodes: visibleNodes.map((node) => ({ ...node })),
    links: visibleEdges.map((edge) => ({ ...edge })),
  }), [visibleEdges, visibleNodes]);

  const prioritizedLabelIds = useMemo(() => {
    const limit = selectedNodeId ? Math.min(visibleNodes.length, 14) : 12;
    return [...visibleNodes]
      .sort((left, right) => {
        if (Number(right.is_hub) !== Number(left.is_hub)) {
          return Number(right.is_hub) - Number(left.is_hub);
        }
        if (right.connection_count !== left.connection_count) {
          return right.connection_count - left.connection_count;
        }
        return right.total_value - left.total_value;
      })
      .slice(0, limit)
      .map((node) => node.id);
  }, [selectedNodeId, visibleNodes]);

  const layoutTargetMap = useMemo(() => {
    return selectedNodeId
      ? buildFocusTargetMap(visibleNodes, selectedNodeId)
      : buildOverviewTargetMap(visibleNodes);
  }, [selectedNodeId, visibleNodes]);

  useEffect(() => {
    if (!selectedNodeId || !graphRef.current) return;
    const node = graphData.nodes.find((item) => item.id === selectedNodeId);
    if (node && typeof node.x === "number" && typeof node.y === "number") {
      graphRef.current.centerAt(node.x, node.y, 650);
      graphRef.current.zoom(4.8, 650);
    }
  }, [graphData.nodes, selectedNodeId]);

  useEffect(() => {
    autoFitRef.current = false;
    if (!graphRef.current) return;

    const chargeForce = graphRef.current.d3Force("charge");
    if (chargeForce) {
      chargeForce.strength(
        selectedNodeId
          ? networkConfig.canvas.physics.chargeStrength * 0.7
          : networkConfig.canvas.physics.chargeStrength,
      );
    }

    const linkForce = graphRef.current.d3Force("link");
    if (linkForce) {
      linkForce.distance(selectedNodeId ? 186 : networkConfig.canvas.physics.linkDistance);
    }

    graphRef.current.d3Force(
      "x",
      forceX((node: NetworkNode) => layoutTargetMap.get(node.id)?.x ?? 0).strength(selectedNodeId ? 0.30 : 0.075),
    );
    graphRef.current.d3Force(
      "y",
      // Y force is weaker than X — pushes the layout to spread horizontally
      forceY((node: NetworkNode) => layoutTargetMap.get(node.id)?.y ?? 0).strength(selectedNodeId ? 0.18 : 0.042),
    );
    graphRef.current.d3Force(
      "collision",
      forceCollide((node: NetworkNode) => nodeRadius(node) + networkConfig.canvas.physics.collisionPadding)
        .strength(1)
        .iterations(4),
    );

    graphRef.current.d3ReheatSimulation();
  }, [graphData.links.length, graphData.nodes.length, layoutTargetMap, selectedNodeId]);

  const renderNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      try {
        const typedNode = node as NetworkNode & { x: number; y: number };
        if (typedNode.id === graphData.nodes[0]?.id) {
          renderedLabelBoxesRef.current = [];
        }

        // Read from refs — these are always current without requiring closure recreation
        const hoveredId = hoveredNodeIdRef.current;
        const focusedId = focusedNodeIdRef.current;

        const radius = nodeRadius(typedNode);
        const isSelected = typedNode.id === selectedNodeId;
        const isHovered = typedNode.id === hoveredId;
        const neighbors = focusedId ? adjacencyMap.get(focusedId) : null;
        const isNeighbor = !selectedNodeId && (neighbors?.has(typedNode.id) ?? false);
        const isDimmed = !selectedNodeId && !!focusedId && !isSelected && !isHovered && !isNeighbor;
        const isPrioritized = prioritizedLabelIds.includes(typedNode.id);
        const color = resolveNodeColor(typedNode, selectedNodeId, hoveredId);

        ctx.save();
        ctx.globalAlpha = isDimmed ? 0.14 : 1;

        if (isSelected) {
          // Gradient glow only for selected node (max 1 at a time — GC safe)
          ctx.beginPath();
          ctx.arc(typedNode.x, typedNode.y, radius + 12, 0, 2 * Math.PI);
          const glow = ctx.createRadialGradient(typedNode.x, typedNode.y, radius, typedNode.x, typedNode.y, radius + 16);
          glow.addColorStop(0, "rgba(198,40,57,0.30)");
          glow.addColorStop(1, "rgba(198,40,57,0)");
          ctx.fillStyle = glow;
          ctx.fill();
        } else if (isHovered || isNeighbor || (selectedNodeId && typedNode.id !== selectedNodeId)) {
          // Flat ring — no gradient, fast fill
          ctx.beginPath();
          ctx.arc(typedNode.x, typedNode.y, radius + 5, 0, 2 * Math.PI);
          ctx.fillStyle = `${color}26`;
          ctx.fill();
        }

        ctx.shadowColor = isSelected
          ? "rgba(198,40,57,0.22)"
          : isHovered || isNeighbor
            ? `${color}44`
            : "rgba(23,32,51,0.08)";
        ctx.shadowBlur = isSelected ? 18 : isHovered || isNeighbor ? 14 : 8;
        ctx.shadowOffsetY = 3;
        ctx.fillStyle = isSelected ? "#c62839" : color;
        ctx.beginPath();
        ctx.arc(typedNode.x, typedNode.y, radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        ctx.strokeStyle = isSelected
          ? "rgba(255,255,255,0.96)"
          : isHovered || isNeighbor || (selectedNodeId && typedNode.id !== selectedNodeId)
            ? "rgba(255,255,255,0.92)"
            : typedNode.is_hub
              ? "rgba(255,255,255,0.86)"
              : "rgba(255,255,255,0.72)";
        ctx.lineWidth = isSelected ? 2.8 : isHovered ? 2.1 : 1.5;
        ctx.stroke();

        if (radius > 5) {
          ctx.beginPath();
          // Inner core dot to signify data
          ctx.arc(typedNode.x, typedNode.y, radius * 0.35, 0, 2 * Math.PI);
          ctx.fillStyle = isSelected ? "#fff" : "rgba(255,255,255,0.92)";
          ctx.fill();
        }

        const showLabel =
          !isDimmed && (
            isSelected ||
            isHovered ||
            isPrioritized ||
            (selectedNodeId ? false : isNeighbor) ||
            (typedNode.is_hub && globalScale >= networkConfig.canvas.hubLabelZoomThreshold) ||
            globalScale >= networkConfig.canvas.labelZoomThreshold
          );

        if (showLabel) {
          const fontPx = isSelected ? 13.5 : isHovered ? 11.5 : 10.0;
          const fontSize = Math.max(fontPx / globalScale, 5.5);
          ctx.font = `${isSelected || isHovered || typedNode.is_hub ? "700 " : "600 "}${fontSize}px Sora, ui-sans-serif, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          const maxLabelChars = isSelected || isHovered ? 46 : typedNode.is_hub ? 34 : 28;
          const label =
            typedNode.label.length > maxLabelChars
              ? `${typedNode.label.slice(0, Math.max(8, maxLabelChars - 3)).trim()}...`
              : typedNode.label;

          const metrics = ctx.measureText(label);
          const textWidth = metrics.width;
          const textHeight = fontSize * 1.18;
          const paddingX = isSelected ? 6 : 4;
          const paddingY = 2;
          const offset = isSelected ? radius + 18 : radius + 13;
          const labelDirection = typedNode.y > height * 0.58 ? -1 : 1;
          const labelY = typedNode.y + labelDirection * offset;
          const labelBox = {
            x: typedNode.x - textWidth / 2 - paddingX - 4,
            y: labelY - textHeight / 2 - paddingY - 3,
            w: textWidth + paddingX * 2 + 8,
            h: textHeight + paddingY * 2 + 6,
          };

          const collides = renderedLabelBoxesRef.current.some((box) =>
            !(
              labelBox.x + labelBox.w < box.x ||
              box.x + box.w < labelBox.x ||
              labelBox.y + labelBox.h < box.y ||
              box.y + box.h < labelBox.y
            ),
          );

          if (collides && !isSelected && !isHovered) {
            ctx.restore();
            return;
          }

          const pillRadius = (textHeight + paddingY * 2) / 2;
          ctx.fillStyle = isSelected
            ? "rgba(255,255,255,0.98)"
            : "rgba(255,255,255,0.95)";
          roundedPill(
            ctx,
            typedNode.x - textWidth / 2 - paddingX,
            labelY - textHeight / 2 - paddingY,
            textWidth + paddingX * 2,
            textHeight + paddingY * 2,
            pillRadius,
          );
          ctx.fill();

          ctx.strokeStyle = isSelected
            ? "rgba(198,40,57,0.34)"
            : "rgba(13,91,215,0.16)";
          ctx.lineWidth = 0.7 / globalScale;
          ctx.stroke();

          ctx.fillStyle = isSelected ? "#c62839" : "#172033";
          ctx.fillText(label, typedNode.x, labelY);
          renderedLabelBoxesRef.current.push(labelBox);
        }

        ctx.restore();
      } catch {
        // Canvas exceptions should never take down the page.
      }
    },
    // hoveredNodeId / focusedNodeId intentionally excluded — read via refs to avoid
    // recreating this callback (and triggering a ForceGraph prop flush) on every hover.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [adjacencyMap, graphData.nodes, height, prioritizedLabelIds, selectedNodeId],
  );

  // When hover changes, signal a single canvas repaint without re-running physics
  useEffect(() => {
    graphRef.current?.refresh?.();
  }, [hoveredNodeId]);

  const paintPointerArea = useCallback(
    (node: any, color: string, ctx: CanvasRenderingContext2D) => {
      try {
        const typedNode = node as NetworkNode & { x: number; y: number };
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(typedNode.x, typedNode.y, nodeRadius(typedNode) + 6, 0, 2 * Math.PI);
        ctx.fill();
      } catch {
        // Ignore pointer paint failures.
      }
    },
    [],
  );

  const getLinkColor = useCallback(
    (link: any) => {
      const sourceId = resolveLinkEndId(link.source);
      const targetId = resolveLinkEndId(link.target);
      const isSelectedEdge = link.id === selectedEdgeId;
      const touchesFocusedNode = focusedNodeId && (sourceId === focusedNodeId || targetId === focusedNodeId);

      if (isSelectedEdge) return "#c62839";
      if (selectedNodeId) {
        return touchesFocusedNode ? "rgba(13,91,215,0.55)" : "rgba(23,32,51,0.08)";
      }
      if (focusedNodeId) {
        return touchesFocusedNode ? "rgba(13,91,215,0.55)" : "rgba(23,32,51,0.06)";
      }
      // Reference-image style: monochrome thin grey edges.
      // Confidence bumps the alpha rather than swapping hue — keeps the canvas calm.
      if (link.confidence >= 80) return "rgba(23,32,51,0.32)";
      if (link.confidence >= 60) return "rgba(23,32,51,0.22)";
      return "rgba(23,32,51,0.14)";
    },
    [focusedNodeId, selectedEdgeId, selectedNodeId],
  );

  const handleZoomIn = useCallback(() => {
    if (!graphRef.current) return;
    const next = Math.min((graphRef.current.zoom() ?? 1) * 1.35, 12);
    graphRef.current.zoom(next, 320);
    setZoomLevel(next);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!graphRef.current) return;
    const next = Math.max((graphRef.current.zoom() ?? 1) / 1.35, 0.15);
    graphRef.current.zoom(next, 320);
    setZoomLevel(next);
  }, []);

  const handleZoomReset = useCallback(() => {
    if (!graphRef.current) return;
    graphRef.current.zoomToFit(450, selectedNodeId ? 120 : 96);
    setZoomLevel(1);
  }, [selectedNodeId]);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (event.shiftKey) return;
    event.stopPropagation();
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
      onWheel={handleWheel}
    >
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        width={width}
        height={height}
        backgroundColor={networkConfig.canvas.backgroundColor}
        nodeLabel={() => ""}
        nodeCanvasObject={renderNode}
        nodeCanvasObjectMode={() => "replace"}
        nodePointerAreaPaint={paintPointerArea}
        linkWidth={(link: any) => {
          const baseWidth = edgeWidth(link as NetworkEdge);
          // Thin lines by default to match the reference network look;
          // selected/focused edges still stand out via colour.
          return selectedNodeId
            ? Math.min(baseWidth * 1.1, 2.4)
            : Math.max(baseWidth * 0.55, 0.45);
        }}
        linkColor={getLinkColor}
        linkCurvature={() => (selectedNodeId ? 0.08 : 0.03)}
        linkDirectionalParticles={(link: any) => {
          const sourceId = resolveLinkEndId(link.source);
          const targetId = resolveLinkEndId(link.target);
          const touchesFocusedNode = focusedNodeId && (sourceId === focusedNodeId || targetId === focusedNodeId);
          if (link.id === selectedEdgeId) return 4;
          if (touchesFocusedNode && link.confidence >= 80) return selectedNodeId ? 3 : 2;
          return 0;
        }}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleWidth={2.5}
        linkDirectionalParticleColor={(link: any) => (link.id === selectedEdgeId ? "#c62839" : "#0d5bd7")}
        onNodeClick={handleNodeClick}
        onLinkClick={handleEdgeClick}
        onNodeHover={handleNodeHover}
        onBackgroundClick={onBackgroundClick}
        onZoom={({ k }: { k: number }) => setZoomLevel(k)}
        enableNodeDrag={false}
        onEngineStop={() => {
          if (!selectedNodeId && !autoFitRef.current && graphRef.current && graphData.nodes.length > 0) {
            autoFitRef.current = true;
            graphRef.current.zoomToFit(240, 0);
            window.setTimeout(() => {
              if (!graphRef.current || selectedNodeId) return;
              const positionedNodes = graphData.nodes.filter(
                (node: any) => Number.isFinite(node.x) && Number.isFinite(node.y),
              );
              const center = positionedNodes.reduce(
                (acc: { x: number; y: number }, node: any) => ({
                  x: acc.x + node.x,
                  y: acc.y + node.y,
                }),
                { x: 0, y: 0 },
              );
              const divisor = Math.max(positionedNodes.length, 1);
              const nextZoom = width && width < 520 ? 1.85 : 2.85;
              graphRef.current.centerAt(center.x / divisor, center.y / divisor, 320);
              graphRef.current.zoom(nextZoom, 360);
              setZoomLevel(nextZoom);
            }, 440);
          }
        }}
        d3AlphaDecay={networkConfig.canvas.physics.alphaDecay}
        d3VelocityDecay={networkConfig.canvas.physics.velocityDecay}
        cooldownTicks={networkConfig.canvas.physics.cooldownTicks}
        autoPauseRedraw
        warmupTicks={80}
      />

      <div className="sed-canvas-controls" aria-label={lang === "es" ? "Controles de zoom" : "Zoom controls"}>
        <button className="sed-canvas-ctrl-btn" onClick={handleZoomIn} title={lang === "es" ? "Acercar" : "Zoom in"}>+</button>
        <button className="sed-canvas-ctrl-btn sed-canvas-ctrl-btn--reset" onClick={handleZoomReset} title={lang === "es" ? "Ajustar" : "Fit"}>⤢</button>
        <button className="sed-canvas-ctrl-btn" onClick={handleZoomOut} title={lang === "es" ? "Alejar" : "Zoom out"}>−</button>
      </div>

      {zoomLevel <= 1.02 && !selectedNodeId && graphData.nodes.length > 0 && (
        <div className="sed-canvas-hint" aria-hidden="true">
          {lang === "es"
            ? "Explora el panorama · haz clic para abrir una red más clara"
            : "Scan the overview · click to open a clearer local network"}
        </div>
      )}
    </div>
  );
}

function buildOverviewTargetMap(nodes: NetworkNode[]): Map<string, { x: number; y: number }> {
  const map = new Map<string, { x: number; y: number }>();
  const sorted = [...nodes].sort((left, right) => {
    if (Number(right.is_hub) !== Number(left.is_hub)) {
      return Number(right.is_hub) - Number(left.is_hub);
    }
    if (right.connection_count !== left.connection_count) {
      return right.connection_count - left.connection_count;
    }
    return right.total_value - left.total_value;
  });

  const hubs = sorted.filter((node) => node.is_hub);
  const clusters = sorted.filter((node) => !node.is_hub && node.type === "cluster");
  const entities = sorted.filter((node) => !node.is_hub && node.type === "entity");
  const providers = sorted.filter((node) => !node.is_hub && node.type === "provider");
  const remainder = sorted.filter(
    (node) => !node.is_hub && node.type !== "cluster" && node.type !== "entity" && node.type !== "provider",
  );

  placeNodesOnRings(map, hubs, {
    baseRadius: 150,
    ringStep: 105,
    baseCountPerRing: 4,
    yScale: 0.62,
    angleOffset: -Math.PI / 2,
  });
  placeNodesOnRings(map, clusters, {
    baseRadius: 280,
    ringStep: 120,
    baseCountPerRing: 5,
    yScale: 0.58,
    angleOffset: Math.PI / 5,
  });
  placeNodesOnRings(map, entities, {
    baseRadius: 410,
    ringStep: 135,
    baseCountPerRing: 7,
    yScale: 0.64,
    angleOffset: -Math.PI / 3,
  });
  placeNodesOnRings(map, providers, {
    baseRadius: 560,
    ringStep: 150,
    baseCountPerRing: 10,
    yScale: 0.68,
    angleOffset: Math.PI / 9,
  });
  placeNodesOnRings(map, remainder, {
    baseRadius: 700,
    ringStep: 155,
    baseCountPerRing: 12,
    yScale: 0.72,
    angleOffset: -Math.PI / 8,
  });

  return map;
}

function buildFocusTargetMap(
  nodes: NetworkNode[],
  selectedNodeId: string,
): Map<string, { x: number; y: number }> {
  const map = new Map<string, { x: number; y: number }>();
  map.set(selectedNodeId, { x: 0, y: 0 });

  const neighbors = nodes
    .filter((node) => node.id !== selectedNodeId)
    .sort((left, right) => {
      if (right.connection_count !== left.connection_count) {
        return right.connection_count - left.connection_count;
      }
      return right.total_value - left.total_value;
    });

  placeNodesOnRings(map, neighbors, {
    baseRadius: 160,
    ringStep: 85,
    baseCountPerRing: 7,
    yScale: 0.82,
    angleOffset: -Math.PI / 2,
  });

  return map;
}

function placeNodesOnRings(
  map: Map<string, { x: number; y: number }>,
  nodes: NetworkNode[],
  options: {
    baseRadius: number;
    ringStep: number;
    baseCountPerRing: number;
    yScale: number;
    angleOffset: number;
  },
) {
  let ringIndex = 0;
  let cursor = 0;

  while (cursor < nodes.length) {
    const radius = options.baseRadius + ringIndex * options.ringStep;
    const ringCount = Math.min(
      nodes.length - cursor,
      options.baseCountPerRing + ringIndex * Math.max(2, Math.round(options.baseCountPerRing * 0.35)),
    );

    for (let i = 0; i < ringCount; i += 1) {
      const node = nodes[cursor + i];
      const angle =
        options.angleOffset +
        (i / Math.max(ringCount, 1)) * Math.PI * 2 +
        seededAngleOffset(node.id) * 0.08;
      map.set(node.id, {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * (radius * options.yScale),
      });
    }

    cursor += ringCount;
    ringIndex += 1;
  }
}

function resolveLinkEndId(value: string | { id?: string } | undefined): string {
  if (typeof value === "string") return value;
  return value?.id ?? "";
}

function seededAngleOffset(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) % 360;
  }
  return (hash / 360) * Math.PI * 2;
}

function roundedPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

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
