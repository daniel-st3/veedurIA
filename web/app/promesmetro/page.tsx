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
  
  const payload = await fetchPromisesOverview({ lang, limit: 48 });

  return <PromisesView lang={lang} initialPayload={payload} />;
}
