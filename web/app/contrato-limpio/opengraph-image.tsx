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
      title="ContratoLimpio"
      subtitle="Filtra contratos, revisa señales prioritarias y abre la evidencia oficial de SECOP II."
      accent="#f3c322"
    />,
    size,
  );
}
