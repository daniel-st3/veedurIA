import { VotometroView } from "@/components/votometro-view";
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
    path: `/votometro?lang=${lang}`,
    title: "VotóMeter — VeedurIA",
    description: "Cruza votaciones nominales del Congreso con el perfil programático de cada legislador y abre la gaceta exacta detrás de cada voto.",
    imagePath: "/votometro/opengraph-image",
  });
}

export default async function VotometroPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);

  return <VotometroView lang={lang} />;
}
