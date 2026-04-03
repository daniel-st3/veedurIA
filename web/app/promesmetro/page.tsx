import { PromisesView } from "@/components/promises-view";
import { fetchPromisesOverview } from "@/lib/api";
import { resolveLang } from "@/lib/copy";

export default async function PromesMetroPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  const initialPayload = await fetchPromisesOverview({
    lang,
    electionYear: 2026,
    limit: 18,
  }).catch(() => null);
  return <PromisesView lang={lang} initialPayload={initialPayload} />;
}
