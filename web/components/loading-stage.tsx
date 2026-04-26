"use client";

import { useEffect, useMemo, useState } from "react";

import type { Lang } from "@/lib/types";

export type LoadingStageContext =
  | "page"
  | "landing"
  | "contracts"
  | "table"
  | "network"
  | "node"
  | "votometro"
  | "promises";

type LoadingStageProps = {
  lang?: Lang;
  context?: LoadingStageContext;
  compact?: boolean;
  inline?: boolean;
  title?: string;
};

const PHRASES: Record<LoadingStageContext, Record<Lang, string[]>> = {
  page: {
    es: ["Abriendo fuentes públicas", "Preparando capas de lectura", "Trazando señales verificables"],
    en: ["Opening public sources", "Preparing reading layers", "Tracing verifiable signals"],
  },
  landing: {
    es: ["Dibujando el mapa público", "Sincronizando señales iniciales", "Preparando la lectura territorial"],
    en: ["Drawing the public map", "Syncing initial signals", "Preparing territorial reading"],
  },
  contracts: {
    es: ["Consultando SECOP II", "Cruzando filtros territoriales", "Priorizando contratos atípicos"],
    en: ["Checking SECOP II", "Crossing territorial filters", "Prioritizing unusual contracts"],
  },
  table: {
    es: ["Ordenando expedientes", "Aplicando filtros visibles", "Preparando registros analizables"],
    en: ["Sorting records", "Applying visible filters", "Preparing analyzable rows"],
  },
  network: {
    es: ["Construyendo red", "Calculando relaciones", "Detectando nodos repetidos"],
    en: ["Building the network", "Calculating relationships", "Detecting repeated nodes"],
  },
  node: {
    es: ["Leyendo vecindario del nodo", "Buscando conexiones fuertes", "Resumiendo evidencia cercana"],
    en: ["Reading node neighborhood", "Finding strong connections", "Summarizing nearby evidence"],
  },
  votometro: {
    es: ["Leyendo votaciones nominales", "Cruzando legisladores y temas", "Preparando coherencia pública"],
    en: ["Reading roll-call votes", "Crossing legislators and topics", "Preparing public coherence"],
  },
  promises: {
    es: ["Buscando promesas", "Contrastando evidencia", "Agrupando compromisos visibles"],
    en: ["Finding promises", "Checking evidence", "Grouping visible commitments"],
  },
};

const DEFAULT_TITLE: Record<Lang, string> = {
  es: "Preparando lectura pública",
  en: "Preparing public reading",
};

export function LoadingStage({
  lang = "es",
  context = "page",
  compact = false,
  inline = false,
  title,
}: LoadingStageProps) {
  const phrases = useMemo(() => PHRASES[context][lang], [context, lang]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % phrases.length);
    }, 1100);
    return () => window.clearInterval(id);
  }, [phrases]);

  return (
    <div
      className={`loading-stage${compact ? " loading-stage--compact" : ""}${inline ? " loading-stage--inline" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="loading-stage__mark" aria-hidden="true">
        <span />
      </span>
      <span className="loading-stage__copy">
        <strong>{title ?? DEFAULT_TITLE[lang]}</strong>
        <span>{phrases[index]}</span>
      </span>
      <span className="loading-stage__rail" aria-hidden="true">
        <span />
      </span>
    </div>
  );
}
