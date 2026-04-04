import { ImageResponse } from "next/og";

import { OgCard } from "@/lib/og-card";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <OgCard
      title="Promesómetro"
      subtitle="Contrasta promesas públicas con evidencia legislativa y ejecutiva por periodo político."
      accent="#0d5bd7"
    />,
    size,
  );
}
