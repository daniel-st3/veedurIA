import { VotometroProfilePage } from "@/components/votometro/profile-page";
import { resolveLang } from "@/lib/copy";
import { buildPageMetadata } from "@/lib/metadata";
import { getVotometroProfileResult } from "@/lib/votometro-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const lang = resolveLang(Array.isArray(query.lang) ? query.lang[0] : query.lang);
  const { profile, issue } = await getVotometroProfileResult(slug, lang);

  if (!profile) {
    const description = issue
      ? issue.message
      : lang === "es"
        ? "El perfil solicitado no está disponible en este corte de Votómetro."
        : "The requested profile is not available in this Votometer slice.";
    return buildPageMetadata({
      lang,
      path: `/votometro/legislador/${slug}?lang=${lang}`,
      title: lang === "es" ? "Legislador no encontrado — Votómetro" : "Legislator not found — Votometer",
      description,
      imagePath: "/votometro/opengraph-image",
    });
  }

  return buildPageMetadata({
    lang,
    path: `/votometro/legislador/${slug}?lang=${lang}`,
    title: `${profile.canonicalName} — ${lang === "es" ? "Votómetro" : "Votometer"}`,
    description:
      lang === "es"
        ? `${profile.roleLabel} de ${profile.party} con ${profile.votesIndexed} votos indexados y ${profile.coherenceScore == null ? "sin coherencia revisada aún" : `${Math.round(profile.coherenceScore)}% de coherencia revisada`}.`
        : `${profile.roleLabel} from ${profile.party} with ${profile.votesIndexed} indexed votes and ${profile.coherenceScore == null ? "no reviewed coherence yet" : `${Math.round(profile.coherenceScore)}% reviewed coherence`}.`,
    imagePath: "/votometro/opengraph-image",
  });
}

export default async function VotometroLegislatorPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const lang = resolveLang(Array.isArray(query.lang) ? query.lang[0] : query.lang);
  const { profile, issue } = await getVotometroProfileResult(slug, lang);

  return <VotometroProfilePage lang={lang} profile={profile} issue={issue} />;
}
