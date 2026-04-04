import { ModulePlaceholder } from "@/components/module-placeholder";
import { resolveLang } from "@/lib/copy";
import { buildPageMetadata } from "@/lib/metadata";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  return buildPageMetadata({
    lang,
    path: `/sigue-el-dinero?lang=${lang}`,
    title: lang === "es" ? "SigueElDinero — VeedurIA" : "SigueElDinero — VeedurIA",
    description:
      lang === "es"
        ? "Sigue el avance del módulo relacional para conectar contratistas, donantes y señales repetidas."
        : "Track the progress of the relationship module that connects contractors, donors, and repeated signals.",
    imagePath: "/sigue-el-dinero/opengraph-image",
  });
}

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
      phase={lang === "es" ? "Fase 3" : "Phase 3"}
      title="SigueElDinero"
      body={
        lang === "es"
          ? "Este módulo conectará contratistas, donantes, funcionarios y señales repetidas para pasar del caso aislado al patrón de relación. Por ahora muestra el avance del frente relacional y mantiene claro que todavía no está listo para auditoría completa."
          : "This module will connect contractors, donors, public officials, and repeated signals to move from isolated cases to relationship patterns. For now it shows module progress and makes it explicit that the relational layer is not ready for full audit use yet."
      }
    />
  );
}
