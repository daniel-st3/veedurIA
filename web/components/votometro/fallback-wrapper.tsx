"use client";

import { VotometroView } from "@/components/votometro-view";
import type { Lang } from "@/lib/types";

export function VotometroFallback({
  lang,
  initialLiveCoverage,
}: {
  lang: Lang;
  initialLiveCoverage?: {
    activeLegislators: number | null;
    visibleParties: number | null;
    publicVotes: number | null;
    available: boolean;
  };
}) {
  return <VotometroView lang={lang} initialLiveCoverage={initialLiveCoverage} />;
}
