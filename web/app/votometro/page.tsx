import { VotometroDirectoryPage } from "@/components/votometro/directory-page";
import { VotometroFallback } from "@/components/votometro/fallback-wrapper";
import { resolveLang } from "@/lib/copy";
import { buildPageMetadata } from "@/lib/metadata";
import { getPartySummariesPayload, getVotometroDirectory } from "@/lib/votometro-server";

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

  try {
    const [payload, parties] = await Promise.all([
      getVotometroDirectory(params),
      getPartySummariesPayload(),
    ]);

    // If there's real data from Supabase (items with votes), use the SSR directory
    const hasRealData =
      payload.items.length > 0 &&
      !payload.issue &&
      payload.items.some((item) => item.votesIndexed > 0);

    if (hasRealData) {
      return <VotometroDirectoryPage lang={lang} payload={payload} parties={parties.items} />;
    }
  } catch {
    // Fall through to the fallback view
  }

  // Fall back to the rich client-side view with populated static data
  return <VotometroFallback lang={lang} />;
}
