"use client";

import { useMemo, useRef, useState } from "react";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";

import type { DepartmentDatum } from "@/lib/types";

type Feature = {
  type: string;
  properties: { NOMBRE_DPT?: string };
  geometry: { type: string; coordinates: any };
};

type TooltipDatum = {
  label?: string;
  contractCount?: number;
  intensity?: number;
  alerts?: string[];
  clickHint?: string;
};

type Props = {
  geojson: { features?: Feature[] } | null;
  departments?: DepartmentDatum[];
  activeDepartment?: string;
  onSelect?: (department: string) => void;
  onHoverChange?: (department: string | null) => void;
  mode?: "dashboard" | "hero";
  className?: string;
  captionTitle?: string;
  captionBody?: string;
  emptyCaptionBody?: string;
  showCaption?: boolean;
  tooltipData?: Record<string, TooltipDatum>;
  showTooltip?: boolean;
};

type ProjectedFeature = {
  key: string;
  label: string;
  path: string;
  centerX: number;
  centerY: number;
};

const VIEWBOX_WIDTH = 540;
const VIEWBOX_HEIGHT = 640;
const PAD = 2;
const MAP_TONES = {
  low: "rgba(39, 166, 71, 0.76)",
  medium: "rgba(212, 128, 10, 0.76)",
  high: "rgba(192, 57, 43, 0.8)",
  neutral: "rgba(1, 95, 101, 0.12)",
  activeGlow: "rgba(1, 95, 101, 0.18)",
  activeDot: "#015f65",
};

function readPoints(value: any, bucket: [number, number][]) {
  if (!Array.isArray(value) || !value.length) return;
  if (typeof value[0] === "number") {
    bucket.push([value[0], value[1]]);
    return;
  }
  value.forEach((entry) => readPoints(entry, bucket));
}

function toRings(geometry: Feature["geometry"]): [number, number][][] {
  if (geometry.type === "Polygon") {
    return geometry.coordinates as [number, number][][];
  }
  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates as [number, number][][][]).flat();
  }
  return [];
}

function buildProjectedFeatures(geojson: Props["geojson"]): ProjectedFeature[] {
  if (!geojson?.features?.length) return [];

  const points: [number, number][] = [];
  geojson.features.forEach((feature) => {
    readPoints(feature.geometry.coordinates, points);
  });

  const xs = points.map(([lon]) => lon);
  const ys = points.map(([, lat]) => lat);
  const minLon = Math.min(...xs);
  const maxLon = Math.max(...xs);
  const minLat = Math.min(...ys);
  const maxLat = Math.max(...ys);
  const scale = Math.min(
    (VIEWBOX_WIDTH - PAD * 2) / Math.max(maxLon - minLon, 1),
    (VIEWBOX_HEIGHT - PAD * 2) / Math.max(maxLat - minLat, 1),
  );

  const project = ([lon, lat]: [number, number]) => [
    (lon - minLon) * scale + PAD,
    (maxLat - lat) * scale + PAD,
  ];

  return geojson.features.map((feature) => {
    const rings = toRings(feature.geometry);
    let centerX = 0;
    let centerY = 0;
    let centerCount = 0;
    const path = rings
      .map((ring) => {
        const projected = ring.map((point) => {
          const [x, y] = project(point);
          centerX += x;
          centerY += y;
          centerCount += 1;
          return [x, y];
        });
        return projected
          .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
          .join(" ")
          .concat(" Z");
      })
      .join(" ");

    return {
      key: feature.properties?.NOMBRE_DPT ?? "",
      label: feature.properties?.NOMBRE_DPT ?? "",
      path,
      centerX: centerCount ? centerX / centerCount : VIEWBOX_WIDTH / 2,
      centerY: centerCount ? centerY / centerCount : VIEWBOX_HEIGHT / 2,
    };
  });
}

function buildRiskStops(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  if (!sorted.length) {
    return { medium: 0.4, high: 0.7, peak: 0.82 };
  }

  const pick = (ratio: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)))];
  const medium = pick(0.33);
  const high = pick(0.66);
  const peak = pick(0.84);

  return {
    medium,
    high: Math.max(high, medium + 0.02),
    peak: Math.max(peak, high + 0.02),
  };
}

function toneForRisk(value: number, stops: { medium: number; high: number; peak: number }) {
  if (value >= stops.peak) return "rgba(192, 57, 43, 0.92)";
  if (value >= stops.high) return MAP_TONES.high;
  if (value >= stops.medium) return MAP_TONES.medium;
  return MAP_TONES.low;
}

function randomPoint(range: number, offset: number) {
  return Math.round(Math.random() * range + offset);
}

export function ColombiaMap({
  geojson,
  departments = [],
  activeDepartment,
  onSelect,
  mode = "dashboard",
  className,
  captionTitle,
  captionBody,
  emptyCaptionBody,
  showCaption = true,
  tooltipData,
  showTooltip = true,
  onHoverChange,
}: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [introReady, setIntroReady] = useState(false);
  const scope = useRef<HTMLDivElement>(null);
  const features = useMemo(() => buildProjectedFeatures(geojson), [geojson]);
  const summary = useMemo(
    () => new Map(departments.map((item) => [item.geoName, item])),
    [departments],
  );
  const stops = useMemo(
    () => buildRiskStops(departments.map((item) => item.avgRisk).filter((value) => Number.isFinite(value))),
    [departments],
  );

  const currentDepartment = hovered || activeDepartment || departments[0]?.geoName || null;
  const currentDatum = currentDepartment ? summary.get(currentDepartment) : undefined;
  const currentFeature = currentDepartment ? features.find((feature) => feature.key === currentDepartment) : null;
  const currentTooltip = currentDepartment ? tooltipData?.[currentDepartment] : undefined;
  const viewportScale = mode === "hero" ? 1.28 : 1;
  const viewportTranslateX = ((1 - viewportScale) * VIEWBOX_WIDTH) / 2;
  const viewportTranslateY = ((1 - viewportScale) * VIEWBOX_HEIGHT) / 2 - (mode === "hero" ? 26 : 0);

  useGSAP(
    () => {
      if (!features.length) return;

      const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const dots = gsap.utils.toArray<SVGCircleElement>(".colombia-map__intro-dot");
      const shapes = gsap.utils.toArray<SVGPathElement>(".colombia-map__shape");
      const marker = scope.current?.querySelector(".colombia-map__marker");

      if (reduceMotion) {
        gsap.set(shapes, { autoAlpha: 1, scale: 1 });
        gsap.set(dots, { autoAlpha: 0 });
        if (marker) gsap.set(marker, { autoAlpha: 1 });
        setIntroReady(true);
        return;
      }

      if (mode === "hero") {
        gsap.set(dots, { autoAlpha: 0 });
        gsap.set(shapes, { autoAlpha: 0, scale: 0.96, transformBox: "fill-box", transformOrigin: "50% 50%" });
        if (marker) gsap.set(marker, { autoAlpha: 0, scale: 0.82, transformOrigin: "50% 50%" });

        gsap.to(shapes, {
          autoAlpha: 1,
          scale: 1,
          duration: 0.56,
          stagger: 0.012,
          ease: "power2.out",
          onComplete: () => setIntroReady(true),
        });

        if (marker) {
          gsap.to(marker, {
            autoAlpha: 1,
            scale: 1,
            duration: 0.3,
            delay: 0.18,
            ease: "back.out(1.6)",
          });
        }

        return;
      }

      gsap.set(shapes, { autoAlpha: 0, scale: 0.88, transformBox: "fill-box", transformOrigin: "50% 50%" });
      if (marker) gsap.set(marker, { autoAlpha: 0, scale: 0.6, transformOrigin: "50% 50%" });

      const timeline = gsap.timeline({
        defaults: { ease: "power3.out" },
        onComplete: () => setIntroReady(true),
      });

      timeline.fromTo(
        dots,
        {
          autoAlpha: 0,
          scale: 0,
          x: () => randomPoint(240, -120),
          y: () => randomPoint(260, -130),
        },
        {
          autoAlpha: 1,
          scale: 1.12,
          x: 0,
          y: 0,
          duration: 0.68,
          stagger: 0.02,
        },
        0,
      );

      timeline.to(
        dots,
        {
          autoAlpha: 0,
          scale: 0.18,
          duration: 0.42,
          stagger: 0.01,
        },
        0.72,
      );
      timeline.to(
        shapes,
        {
          autoAlpha: 1,
          scale: 1,
          duration: 0.72,
          stagger: 0.024,
        },
        0.48,
      );
      if (marker) timeline.to(marker, { autoAlpha: 1, scale: 1, duration: 0.5 }, 1.08);
    },
    { scope, dependencies: [features.length, mode] },
  );

  useGSAP(
    () => {
      if (!currentDepartment || !scope.current) return;
      const escaped = currentDepartment.replaceAll('"', '\\"');
      const featureNode = scope.current.querySelector<SVGPathElement>(`[data-feature="${escaped}"]`);
      const marker = scope.current.querySelector(".colombia-map__marker");
      if (featureNode) {
        gsap.fromTo(
          featureNode,
          { scale: 0.96, transformBox: "fill-box", transformOrigin: "50% 50%" },
          { scale: 1.02, duration: 0.42, yoyo: true, repeat: 1, ease: "power2.out" },
        );
      }
      if (marker && introReady) {
        gsap.fromTo(marker, { scale: 0.82 }, { scale: 1, duration: 0.38, ease: "back.out(1.7)" });
      }
    },
    { scope, dependencies: [currentDepartment, introReady] },
  );

  if (!features.length) {
    return <div className={`colombia-map ${className ?? ""}`} />;
  }

  const hoveredSummary = hovered ? summary.get(hovered) : null;
  const hoveredTooltip = hovered ? tooltipData?.[hovered] : null;

  return (
    <div
      className={`colombia-map colombia-map--${mode} ${className ?? ""}`}
      ref={scope}
      onMouseMove={(event) => {
        const rect = scope.current?.getBoundingClientRect();
        if (!rect) return;
        setMousePos({ x: event.clientX - rect.left, y: event.clientY - rect.top });
      }}
      style={{ position: "relative" }}
    >
      <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} className="colombia-map__svg" aria-label="Mapa de Colombia">
        <defs>
          <radialGradient id={`map-glow-${mode}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(1, 95, 101, 0.18)" />
            <stop offset="100%" stopColor="rgba(1, 95, 101, 0)" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="rgba(255,255,255,0.02)" />
        <circle cx={VIEWBOX_WIDTH / 2} cy={VIEWBOX_HEIGHT / 2} r="180" fill={`url(#map-glow-${mode})`} />

        <g
          className={`colombia-map__viewport colombia-map__viewport--${mode}`}
          transform={`translate(${viewportTranslateX} ${viewportTranslateY}) scale(${viewportScale})`}
        >
        {!introReady ? (
          <g className="colombia-map__intro">
            {features.map((feature, index) => (
              <circle
                key={`${feature.key}-dot`}
                className="colombia-map__intro-dot"
                data-cx={feature.centerX}
                data-cy={feature.centerY}
                cx={feature.centerX}
                cy={feature.centerY}
                r={mode === "hero" ? 6 : 4.5}
                fill={index % 3 === 0 ? MAP_TONES.low : index % 3 === 1 ? MAP_TONES.medium : MAP_TONES.high}
                opacity="0"
              />
            ))}
          </g>
        ) : null}

        <g className="colombia-map__group">
          {features.map((feature, index) => {
            const datum = summary.get(feature.key);
            const isActive = currentDepartment === feature.key;
            const isHot = (datum?.avgRisk ?? 0) >= 0.7;
            const fill =
              datum
                ? toneForRisk(datum.avgRisk, stops)
                : mode === "hero"
                  ? index % 3 === 0
                    ? "rgba(39, 166, 71, 0.14)"
                    : index % 3 === 1
                      ? "rgba(1, 95, 101, 0.12)"
                      : "rgba(122, 106, 85, 0.12)"
                  : MAP_TONES.neutral;

            return (
              <path
                key={feature.key}
                d={feature.path}
                data-feature={feature.key}
                fill={fill}
                fillRule="evenodd"
                className={`colombia-map__shape ${isActive ? "is-active" : ""} ${isHot ? "is-hot" : ""}`}
                stroke={isActive ? "rgba(1, 95, 101, 0.7)" : undefined}
                style={{ animationDelay: `${index * 18}ms` }}
                onMouseEnter={() => {
                  setHovered(feature.key);
                  onHoverChange?.(feature.key);
                }}
                onMouseLeave={() => {
                  setHovered(null);
                  onHoverChange?.(null);
                }}
                onClick={() => onSelect?.(feature.key)}
              />
            );
          })}
        </g>

        {currentFeature ? (
          <g className="colombia-map__marker">
            <circle
              cx={currentFeature.centerX}
              cy={currentFeature.centerY}
              r={mode === "hero" ? 15 : 11}
              fill={MAP_TONES.activeGlow}
            />
            <circle cx={currentFeature.centerX} cy={currentFeature.centerY} r={mode === "hero" ? 7 : 5} fill={MAP_TONES.activeDot} />
          </g>
        ) : null}
        </g>
      </svg>

      {showCaption ? (
        <div className="colombia-map__caption surface-soft">
          <div className="label" style={{ marginBottom: "0.35rem" }}>
            {captionTitle ?? (mode === "hero" ? "Colombia" : "Territorio activo")}
          </div>
          <strong>{currentTooltip?.label ?? currentDatum?.label ?? currentDepartment ?? "Colombia"}</strong>
          <div className="body-copy" style={{ marginTop: "0.2rem", fontSize: "0.8rem" }}>
            {currentDatum
              ? captionBody ??
                `${currentDatum.contractCount.toLocaleString("es-CO")} contratos · ${Math.round((currentTooltip?.intensity ?? currentDatum.avgRisk * 100))}/100 de intensidad`
              : emptyCaptionBody ?? "Selecciona un departamento para reorganizar la lectura."}
          </div>
        </div>
      ) : null}

      {hovered && showTooltip ? (
        <div
          className="map-tooltip"
          style={{
            left: mousePos.x + 18,
            top: mousePos.y - 10,
          }}
        >
          <div className="map-tooltip__title">{hoveredTooltip?.label ?? hoveredSummary?.label ?? hovered}</div>
          <div className="map-tooltip__metric">
            <span>📊</span>
            <span>
              {(hoveredTooltip?.contractCount ?? hoveredSummary?.contractCount ?? 0).toLocaleString("es-CO")} contratos visibles
            </span>
          </div>
          <div className="map-tooltip__metric">
            <span>⚠️</span>
            <span>{Math.round(hoveredTooltip?.intensity ?? ((hoveredSummary?.avgRisk ?? 0) * 100))}/100 de intensidad</span>
          </div>
          {(hoveredTooltip?.alerts ?? []).slice(0, 3).map((alert) => (
            <div key={alert} className="map-tooltip__alert">
              <span>•</span>
              <span>{alert}</span>
            </div>
          ))}
          <div className="map-tooltip__hint">{hoveredTooltip?.clickHint ?? "Haz clic para filtrar"}</div>
        </div>
      ) : null}
    </div>
  );
}
