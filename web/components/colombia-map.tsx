"use client";

import dynamic from "next/dynamic";

import type { DepartmentDatum } from "@/lib/types";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export function ColombiaMap({
  geojson,
  departments,
  activeDepartment,
  onSelect,
}: {
  geojson: any;
  departments: DepartmentDatum[];
  activeDepartment?: string;
  onSelect: (department: string) => void;
}) {
  const locations = departments.map((item) => item.geoName);
  const z = departments.map((item) => item.avgRisk);
  const text = departments.map(
    (item) => `${item.label}<br>Riesgo medio: ${(item.avgRisk * 100).toFixed(1)}<br>Contratos: ${item.contractCount.toLocaleString()}`,
  );

  return (
    <Plot
      data={[
        {
          type: "choropleth",
          geojson,
          locations,
          z,
          text,
          featureidkey: "properties.NOMBRE_DPT",
          colorscale: [
            [0, "#f8edd0"],
            [0.38, "#ebc96b"],
            [0.7, "#e37a66"],
            [1, "#c62839"],
          ],
          marker: {
            line: {
              color: "#fffdf8",
              width: 1.1,
            },
          },
          showscale: false,
          hovertemplate: "%{text}<extra></extra>",
        },
      ]}
      layout={{
        margin: { t: 0, r: 0, b: 0, l: 0 },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        dragmode: false,
        transition: {
          duration: 450,
          easing: "cubic-in-out",
        },
        geo: {
          scope: "south america",
          visible: false,
          projection: { type: "mercator" },
          fitbounds: "locations",
          bgcolor: "rgba(0,0,0,0)",
          showland: true,
          landcolor: "#fff9f2",
          showcountries: false,
          showlakes: false,
        },
        shapes: activeDepartment
          ? [
              {
                type: "rect",
                xref: "paper",
                yref: "paper",
                x0: 0,
                y0: 0,
                x1: 1,
                y1: 1,
                line: { color: "rgba(13,91,215,0.18)", width: 1 },
              },
            ]
          : [],
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: "100%", height: 420 }}
      onClick={(event: any) => {
        const location = event.points?.[0]?.location;
        if (location) {
          onSelect(String(location));
        }
      }}
    />
  );
}
