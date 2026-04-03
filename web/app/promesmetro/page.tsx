import { PromisesView } from "@/components/promises-view";
import { resolveLang } from "@/lib/copy";

export default async function PromesMetroPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  return <PromisesView lang={lang} initialPayload={null} />;
}
