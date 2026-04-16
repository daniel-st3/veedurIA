import { notFound } from "next/navigation";

import { VotometroProfilePage } from "@/components/votometro/profile-page";
import { resolveLang } from "@/lib/copy";
import { buildPageMetadata } from "@/lib/metadata";
import { getVotometroProfile } from "@/lib/votometro-server";

export const revalidate = 3600;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const lang = resolveLang(Array.isArray(query.lang) ? query.lang[0] : query.lang);
  const profile = await getVotometroProfile(slug);

  if (!profile) {
    return buildPageMetadata({
      lang,
      path: `/votometro/legislador/${slug}?lang=${lang}`,
      title: "Legislador no encontrado — VotóMeter",
      description: "El perfil solicitado no está disponible en este corte de VotóMeter.",
      imagePath: "/votometro/opengraph-image",
    });
  }

  return buildPageMetadata({
    lang,
    path: `/votometro/legislador/${slug}?lang=${lang}`,
    title: `${profile.canonicalName} — VotóMeter`,
    description: `${profile.roleLabel} de ${profile.party} con ${profile.votesIndexed} votos indexados y ${profile.coherenceScore == null ? "sin" : `${Math.round(profile.coherenceScore)}% de`} coherencia revisada.`,
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
  const profile = await getVotometroProfile(slug);

  if (!profile) notFound();

  return <VotometroProfilePage lang={lang} profile={profile} />;
}
