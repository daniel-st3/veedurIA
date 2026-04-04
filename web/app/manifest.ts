import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VeedurIA",
    short_name: "VeedurIA",
    description: "Radar ciudadano para revisar contratos públicos, promesas políticas y relaciones de poder con fuentes verificables.",
    start_url: "/",
    display: "standalone",
    background_color: "#08111F",
    theme_color: "#08111F",
    icons: [
      {
        src: "/favicon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
