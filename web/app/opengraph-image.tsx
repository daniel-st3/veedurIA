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
      title="Contratos, promesas y redes en una sola plataforma"
      subtitle="Empieza por la contratación pública, compara promesas con evidencia y sigue el avance de la capa relacional."
      accent="#c62839"
    />,
    size,
  );
}
