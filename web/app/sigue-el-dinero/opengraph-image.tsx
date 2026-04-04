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
      title="SigueElDinero"
      subtitle="Sigue el avance del módulo relacional que conectará contratistas, donantes y redes de poder."
      accent="#c62839"
    />,
    size,
  );
}
