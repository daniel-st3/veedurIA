import { ModulePlaceholder } from "@/components/module-placeholder";
import { resolveLang } from "@/lib/copy";

export default async function PromesMetroPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  return (
    <ModulePlaceholder
      lang={lang}
      phase="Phase 2"
      title="PromesMetro"
      body="Comparará promesas públicas, discursos y programas con acción legislativa real. La fase queda lista dentro de la nueva arquitectura web, sin depender de una multipágina de Streamlit."
    />
  );
}
