"use client";

import { useMemo, useState } from "react";

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
const PAD = 22;

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

function toneForRisk(value: number) {
  if (value >= 0.7) return "var(--red)";
  if (value >= 0.42) return "var(--yellow)";
  return "rgba(13, 91, 215, 0.18)";
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

  const currentDepartment = hovered || activeDepartment || departments[0]?.geoName || null;
  const currentDatum = currentDepartment ? summary.get(currentDepartment) : undefined;

  if (!features.length) {
    return <div className={`colombia-map ${className ?? ""}`} />;
  }

  return (
    <div className={`colombia-map colombia-map--${mode} ${className ?? ""}`}>
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
                    ? toneForRisk(datum.avgRisk)
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
              ? captionBody ?? `${currentDatum.contractCount.toLocaleString()} contratos · ${(currentDatum.avgRisk * 100).toFixed(0)} de señal media`
              : emptyCaptionBody ?? "Selecciona un departamento para reorganizar la lectura."}
          </div>
        </div>
      ) : null}
    </div>
  );
}
