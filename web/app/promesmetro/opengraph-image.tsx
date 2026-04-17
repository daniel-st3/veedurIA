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
      title="Votómetro"
      subtitle="Votaciones nominales del Congreso frente al perfil programático de cada legislador."
      accent="#015f65"
    />,
    size,
  );
}
