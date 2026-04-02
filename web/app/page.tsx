import { LandingPage } from "@/components/landing-page";
import { resolveLang } from "@/lib/copy";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  return <LandingPage lang={lang} />;
}
