import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VeedurIA",
  description: "Civic-tech AI platform for Colombian public procurement accountability.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
