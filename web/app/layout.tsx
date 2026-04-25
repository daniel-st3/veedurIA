import type { Metadata } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";

import { getSiteUrl } from "@/lib/metadata";

import "./globals.css";

const FONTSHARE_URL =
  "https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@400,500,700&f[]=satoshi@400,500,700&display=swap";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  manifest: "/manifest.webmanifest",
  title: {
    default: "VeedurIA — Radar ciudadano de contratos públicos",
    template: "%s",
  },
  description: "Radar ciudadano para revisar contratación pública, votaciones legislativas y redes de poder con fuentes verificables.",
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
    description: "Radar ciudadano para revisar contratación pública, votaciones legislativas y redes de poder con fuentes verificables.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "VeedurIA" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VeedurIA — Radar ciudadano de contratos públicos",
    description: "Radar ciudadano para revisar contratación pública, votaciones legislativas y redes de poder con fuentes verificables.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://api.fontshare.com" />
        <noscript>
          <link rel="stylesheet" href={FONTSHARE_URL} />
        </noscript>
      </head>
      <body>
        {children}
        <Analytics />
        <Script
          id="fontshare-loader"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){var l=document.createElement('link');l.rel='stylesheet';l.href='${FONTSHARE_URL}';document.head.appendChild(l);})();`,
          }}
        />
      </body>
    </html>
  );
}
