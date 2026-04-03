import { ContractsView } from "@/components/contracts-view";
import { resolveLang } from "@/lib/copy";

export default async function ContratoLimpioPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  return <ContractsView lang={lang} initialOverview={null} initialTable={null} initialGeojson={null} />;
}
