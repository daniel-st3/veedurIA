import { PromisesView } from "@/components/promises-view";
import { fetchPromisesOverview } from "@/lib/api";
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
    path: `/promesmetro?lang=${lang}`,
    title: lang === "es" ? "Promesómetro — VeedurIA" : "Promesómetro — VeedurIA",
    description:
      lang === "es"
        ? "Contrasta promesas públicas con evidencia legislativa y ejecutiva por ciclo político."
        : "Contrast public promises with legislative and executive evidence by political cycle.",
    imagePath: "/promesmetro/opengraph-image",
  });
}

export default async function PromesMetroPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  
  const payload = await fetchPromisesOverview({ lang, limit: 48 });

  return <PromisesView lang={lang} initialPayload={payload} />;
}
