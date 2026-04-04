import { LandingPage } from "@/components/landing-page";
import { fetchOverview } from "@/lib/api";
import { resolveLang } from "@/lib/copy";
import { buildPageMetadata } from "@/lib/metadata";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  return buildPageMetadata({
    lang,
    path: `/?lang=${lang}`,
    title:
      lang === "es"
        ? "VeedurIA — Radar ciudadano de contratos públicos"
        : "VeedurIA — Citizen radar for public contracts",
    description:
      lang === "es"
        ? "Explora contratación pública, promesas políticas y redes de poder desde una sola plataforma cívica."
        : "Explore public procurement, political promises, and power networks from one civic platform.",
    imagePath: "/opengraph-image",
  });
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  const overview = await fetchOverview({ lang, full: false });
  return <LandingPage lang={lang} initialOverview={overview} />;
}
