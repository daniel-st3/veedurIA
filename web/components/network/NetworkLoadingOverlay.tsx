"use client";

import { LoadingStage } from "@/components/loading-stage";

type Props = {
  visible: boolean;
  lang?: "es" | "en";
};

export function NetworkLoadingOverlay({ visible, lang = "es" }: Props) {
  if (!visible) return null;

  return (
    <div className="sed-canvas-overlay" aria-live="polite">
      <LoadingStage lang={lang} context="network" compact inline />
    </div>
  );
}
