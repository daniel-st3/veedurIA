"use client";

import { useMemo, useState, useRef } from "react";

import type { DepartmentDatum } from "@/lib/types";

type Feature = {
  type: string;
  properties: { NOMBRE_DPT?: string };
  geometry: { type: string; coordinates: any };
};

type Props = {
  geojson: { features?: Feature[] } | null;
  departments?: DepartmentDatum[];
  activeDepartment?: string;
  onSelect?: (department: string) => void;
  mode?: "dashboard" | "hero";
  className?: string;
  captionTitle?: string;
  captionBody?: string;
  emptyCaptionBody?: string;
  showCaption?: boolean;
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
    return { medium: 0.44, high: 0.62, peak: 0.75 };
  }

  const pick = (ratio: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)))];
  const medium = pick(0.35);
  const high = pick(0.65);
  const peak = pick(0.85);

  return {
    medium,
    high: Math.max(high, medium + 0.02),
    peak: Math.max(peak, high + 0.02),
  };
}

function toneForRisk(value: number, stops: { medium: number; high: number; peak: number }) {
  if (value >= stops.peak) return "rgba(198, 40, 57, 0.92)";
  if (value >= stops.high) return "rgba(198, 40, 57, 0.62)";
  if (value >= stops.medium) return "rgba(211, 162, 26, 0.86)";
  return "rgba(13, 91, 215, 0.22)";
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
}: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
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

  const mapRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  if (!features.length) {
    return <div className={`colombia-map ${className ?? ""}`} />;
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (mapRef.current) {
      const rect = mapRef.current.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  return (
    <div 
      className={`colombia-map colombia-map--${mode} ${className ?? ""}`}
      ref={mapRef}
      onMouseMove={handleMouseMove}
      style={{ position: "relative" }}
    >
      <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} className="colombia-map__svg" aria-label="Mapa de Colombia">
        <defs>
          <linearGradient id={`flag-gradient-${mode}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--yellow)" stopOpacity="0.94" />
            <stop offset="52%" stopColor="var(--blue)" stopOpacity="0.88" />
            <stop offset="100%" stopColor="var(--red)" stopOpacity="0.86" />
          </linearGradient>
          <radialGradient id={`map-glow-${mode}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(13,91,215,0.28)" />
            <stop offset="100%" stopColor="rgba(13,91,215,0)" />
          </radialGradient>
        </defs>

        {mode === "hero" ? (
          <>
            <rect x="0" y="0" width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="rgba(255,255,255,0.04)" />
            <circle cx={VIEWBOX_WIDTH / 2} cy={VIEWBOX_HEIGHT / 2} r="180" fill={`url(#map-glow-${mode})`} />
          </>
        ) : null}

        <g className="colombia-map__group">
          {features.map((feature, index) => {
            const datum = summary.get(feature.key);
            const isActive = currentDepartment === feature.key;
            const fill =
              mode === "hero"
                ? isActive
                  ? `url(#flag-gradient-${mode})`
                  : index % 3 === 0
                    ? "rgba(211,162,26,0.16)"
                    : index % 3 === 1
                      ? "rgba(13,91,215,0.12)"
                      : "rgba(198,40,57,0.1)"
                : isActive
                  ? `url(#flag-gradient-${mode})`
                  : datum
                    ? toneForRisk(datum.avgRisk, stops)
                    : "rgba(23,32,51,0.08)";

            return (
              <path
                key={feature.key}
                d={feature.path}
                fill={fill}
                fillRule="evenodd"
                className={`colombia-map__shape ${isActive ? "is-active" : ""}`}
                style={{ animationDelay: `${index * 34}ms` }}
                onMouseEnter={() => setHovered(feature.key)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onSelect?.(feature.key)}
              />
            );
          })}
        </g>

        {currentDepartment ? (
          <g className="colombia-map__marker">
            <circle
              cx={features.find((feature) => feature.key === currentDepartment)?.centerX ?? VIEWBOX_WIDTH / 2}
              cy={features.find((feature) => feature.key === currentDepartment)?.centerY ?? VIEWBOX_HEIGHT / 2}
              r={mode === "hero" ? 13 : 10}
              fill="rgba(13,91,215,0.18)"
            />
            <circle
              cx={features.find((feature) => feature.key === currentDepartment)?.centerX ?? VIEWBOX_WIDTH / 2}
              cy={features.find((feature) => feature.key === currentDepartment)?.centerY ?? VIEWBOX_HEIGHT / 2}
              r={mode === "hero" ? 5 : 4}
              fill="var(--blue)"
            />
          </g>
        ) : null}
      </svg>

      {showCaption ? (
        <div className="colombia-map__caption surface-soft">
          <div className="label" style={{ marginBottom: "0.35rem" }}>
            {captionTitle ?? (mode === "hero" ? "Colombia" : "Territorio activo")}
          </div>
          <strong>{currentDatum?.label ?? currentDepartment ?? "Colombia"}</strong>
          <div className="body-copy" style={{ marginTop: "0.2rem", fontSize: "0.8rem" }}>
            {currentDatum
              ? captionBody ?? `${currentDatum.contractCount.toLocaleString()} contratos · ${(currentDatum.avgRisk * 100).toFixed(0)}/100 de intensidad`
              : emptyCaptionBody ?? "Selecciona un departamento para reorganizar la lectura."}
          </div>
        </div>
      ) : null}

      {hovered && (
        <div
          className="map-tooltip"
          style={{
            position: "absolute",
            left: mousePos.x + 15,
            top: mousePos.y + 15,
            pointerEvents: "none",
            background: "rgba(10, 15, 25, 0.85)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.1)",
            padding: "0.6rem 0.8rem",
            borderRadius: "12px",
            color: "white",
            zIndex: 100,
            transform: "translate(-50%, -100%)",
            marginTop: "-25px",
            whiteSpace: "nowrap",
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            transition: "opacity 0.2s ease, transform 0.1s ease-out",
          }}
        >
          <div style={{ fontSize: "0.95rem", fontWeight: 600, letterSpacing: "-0.02em" }}>
            {summary.get(hovered)?.label ?? hovered}
          </div>
          {summary.get(hovered) && (
            <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.7)", marginTop: "0.2rem" }}>
              {(summary.get(hovered)!.avgRisk * 100).toFixed(0)} señal
            </div>
          )}
        </div>
      )}
    </div>
  );
}
