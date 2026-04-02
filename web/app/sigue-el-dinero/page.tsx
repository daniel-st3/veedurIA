import { ModulePlaceholder } from "@/components/module-placeholder";
import { resolveLang } from "@/lib/copy";

export default async function SigueElDineroPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  return (
    <ModulePlaceholder
      lang={lang}
      phase="Phase 3"
      title="SigueElDinero"
      body="Conectará donantes, contratistas, funcionarios y sanciones en una superficie de red diseñada para rastrear captura, concentración y posibles patrones de pay-to-play."
    />
  );
}
