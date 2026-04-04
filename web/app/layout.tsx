import type { Metadata } from "next";

import { getSiteUrl } from "@/lib/metadata";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  manifest: "/manifest.webmanifest",
  title: {
    default: "VeedurIA — Radar ciudadano de contratos públicos",
    template: "%s",
  },
  description: "Radar ciudadano para revisar contratación pública, promesas políticas y redes de poder con fuentes verificables.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-192x192.png", type: "image/png", sizes: "192x192" },
      { url: "/android-chrome-512x512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon-32x32.png"],
  },
  openGraph: {
    title: "VeedurIA — Radar ciudadano de contratos públicos",
    description: "Radar ciudadano para revisar contratación pública, promesas políticas y redes de poder con fuentes verificables.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "VeedurIA" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VeedurIA — Radar ciudadano de contratos públicos",
    description: "Radar ciudadano para revisar contratación pública, promesas políticas y redes de poder con fuentes verificables.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
