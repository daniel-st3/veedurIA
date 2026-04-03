import { redirect } from "next/navigation";

export default async function PromesometroAlias({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = params.lang === "en" ? "en" : "es";
  redirect(`/promesmetro?lang=${lang}`);
}
