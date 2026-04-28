import { redirect } from "next/navigation";
import { resolveLang } from "@/lib/copy";

export default async function LegalRedirect({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  redirect(`/etica-y-privacidad?lang=${lang}`);
}
