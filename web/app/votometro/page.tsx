import { VotometroDirectoryPage } from "@/components/votometro/directory-page";
import { resolveLang } from "@/lib/copy";
import { buildPageMetadata } from "@/lib/metadata";
import { getPartySummaries, getVotometroDirectory } from "@/lib/votometro-server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const lang = resolveLang(Array.isArray(params.lang) ? params.lang[0] : params.lang);

  return buildPageMetadata({
    lang,
    path: `/votometro?lang=${lang}`,
    title: "VotóMeter — VeedurIA",
    description: "Directorio vivo de legisladores colombianos con votos, asistencia y coherencia visible solo cuando hay promesas revisadas.",
    imagePath: "/votometro/opengraph-image",
  });
}

export default async function VotometroPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const lang = resolveLang(Array.isArray(params.lang) ? params.lang[0] : params.lang);
  const [payload, parties] = await Promise.all([
    getVotometroDirectory(params),
    getPartySummaries(),
  ]);

  return <VotometroDirectoryPage lang={lang} payload={payload} parties={parties} />;
}
