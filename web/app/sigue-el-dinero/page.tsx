import { SigueElDineroView } from "@/components/sigue-el-dinero-view";
import { resolveLang } from "@/lib/copy";
import { buildPageMetadata } from "@/lib/metadata";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
        ? "Explora quién contrata con quién, cómo se concentra el gasto público y qué relaciones se repiten."
        : "Explore who contracts with whom, how public spending concentrates, and which relationships repeat.",
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
  return <SigueElDineroView lang={lang} />;
}
