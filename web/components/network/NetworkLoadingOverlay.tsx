"use client";

import { useEffect, useState } from "react";

type Props = {
  visible: boolean;
  lang?: "es" | "en";
};

const STEPS_ES = ["Cargando datos…", "Construyendo relaciones…", "Calculando confianza…"];
const STEPS_EN = ["Loading data…", "Building relationships…", "Verifying confidence…"];

export function NetworkLoadingOverlay({ visible, lang = "es" }: Props) {
  const steps = lang === "en" ? STEPS_EN : STEPS_ES;
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!visible) { setStep(0); return; }
    const id = setInterval(() => setStep((s) => (s + 1) % steps.length), 900);
    return () => clearInterval(id);
  }, [visible, steps.length]);

  if (!visible) return null;

  return (
    <div className="sed-canvas-overlay" aria-live="polite">
      <span className="sed-spinner" aria-hidden="true" />
      <span>{steps[step]}</span>
    </div>
  );
}
