"use client";

import { VotometroView } from "@/components/votometro-view";
import type { Lang } from "@/lib/types";

export function VotometroFallback({ lang }: { lang: Lang }) {
  return <VotometroView lang={lang} />;
}
