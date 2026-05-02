"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, FileSearch, Radar, Waypoints, Database, Shield, Eye, BarChart3, Users, Globe, Scale } from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { fetchGeoJson, fetchOverview } from "@/lib/api";
import { deptDisplayLabel } from "@/lib/colombia-departments";
import type { Lang, OverviewPayload } from "@/lib/types";
import type { VotometroLandingStats } from "@/lib/votometro-types";

// Heavy D3 geo stays out of the initial JS parse.
const ColombiaMap = dynamic(
  () => import("@/components/colombia-map").then((m) => ({ default: m.ColombiaMap })),
  { ssr: false },
);

const GLSLHills = dynamic(
  () => import("@/components/ui/glsl-hills").then((m) => ({ default: m.GLSLHills })),
  { ssr: false, loading: () => <span className="lp-hero__hills-static" /> },
);

gsap.registerPlugin(ScrollTrigger);

type FeatureTone = "yellow" | "blue" | "red";

const FEATURE_TEXT = {
  es: {
    contract: {
      title: "ContratoLimpio",
      kicker: "CONTRATOS PÚBLICOS",
      body: "Detecta anomalías en licitaciones y contratos directos. Filtra por entidad, departamento o modalidad y llega al expediente oficial en un clic.",
      cta: "Abrir ContratoLimpio",
      href: "/contrato-limpio?lang=es",
      icon: FileSearch,
      tone: "yellow" as FeatureTone,
      signal: "Expediente · Mapa · Análisis",
    },
    promises: {
      title: "Votómetro",
      kicker: "VOTACIONES DEL CONGRESO",
      body: "Cruza votos nominales con el perfil programático de cada legislador. Abre la gaceta y verifica coherencia tema por tema.",
      cta: "Abrir Votómetro",
      href: "/votometro?lang=es",
      icon: Radar,
      tone: "blue" as FeatureTone,
      signal: "Voto · Legislador · Gaceta",
    },
    money: {
      title: "SigueElDinero",
      kicker: "RED RELACIONAL",
      body: "Conecta contratistas, financiadores y señales repetidas. Visualiza la red de intereses detrás de los contratos públicos.",
      cta: "Próximamente",
      href: "/sigue-el-dinero?lang=es",
      icon: Waypoints,
      tone: "red" as FeatureTone,
      signal: "Red · Contratos · Trazabilidad",
    },
  },
  en: {
    contract: {
      title: "ContratoLimpio",
      kicker: "PUBLIC CONTRACTS",
      body: "Detect anomalies in tenders and direct awards. Filter by entity, department, or modality and reach the official record in one click.",
      cta: "Open ContratoLimpio",
      href: "/contrato-limpio?lang=en",
      icon: FileSearch,
      tone: "yellow" as FeatureTone,
      signal: "Record · Map · Analysis",
    },
    promises: {
      title: "Votómetro",
      kicker: "CONGRESSIONAL VOTES",
      body: "Cross nominal votes with each legislator's programmatic profile. Open the gazette and verify topic-by-topic coherence.",
      cta: "Open Votómetro",
      href: "/votometro?lang=en",
      icon: Radar,
      tone: "blue" as FeatureTone,
      signal: "Vote · Legislator · Gazette",
    },
    money: {
      title: "SigueElDinero",
      kicker: "RELATIONSHIP NETWORK",
      body: "Connect contractors, funders, and repeated signals. Visualize the network of interests behind public contracts.",
      cta: "Coming soon",
      href: "/sigue-el-dinero?lang=en",
      icon: Waypoints,
      tone: "red" as FeatureTone,
      signal: "Network · Contracts · Traceability",
    },
  },
};

const PROCESS_TEXT = {
  es: {
    eyebrow: "Cómo funciona",
    title: "De lo público, lo abierto",
    steps: [
      {
        icon: Database,
        number: "01",
        title: "Recolección oficial",
        body: "Conectamos directo con SECOP II, gacetas del Senado y fuentes de datos abiertos del Estado. Sin intermediarios, sin edición.",
      },
      {
        icon: Shield,
        number: "02",
        title: "Análisis y cruce",
        body: "Modelos de machine learning detectan anomalías, cruzan votos con promesas y mapean redes de financiación e intereses.",
      },
      {
        icon: Eye,
        number: "03",
        title: "Lectura pública",
        body: "Cada señal se presenta con su fuente verificable. Tú decides qué investigar, nosotros hacemos visible lo que ya es público.",
      },
    ],
  },
  en: {
    eyebrow: "How it works",
    title: "From public data, open insight",
    steps: [
      {
        icon: Database,
        number: "01",
        title: "Official collection",
        body: "We connect directly with SECOP II, Senate gazettes, and government open data. No intermediaries, no editing.",
      },
      {
        icon: Shield,
        number: "02",
        title: "Analysis & crossing",
        body: "ML models detect anomalies, cross votes with promises, and map financing and interest networks.",
      },
      {
        icon: Eye,
        number: "03",
        title: "Public reading",
        body: "Each signal comes with its verifiable source. You decide what to investigate, we make what's already public visible.",
      },
    ],
  },
};

const IMPACT_TEXT = {
  es: {
    eyebrow: "Impacto en cifras",
    title: "Radiografía del poder público",
    stats: [
      { icon: BarChart3, label: "Contratos procesados", sublabel: "desde SECOP II" },
      { icon: Users, label: "Votos nominales indexados", sublabel: "capa pública en sincronización" },
      { icon: Globe, label: "Territorios cubiertos", sublabel: "mapeo territorial visible" },
      { icon: Shield, label: "Alertas activas", sublabel: "priorizadas por ML" },
      { icon: Database, label: "Fuentes oficiales conectadas", sublabel: "SECOP · Senado · datos.gov.co" },
    ],
  },
  en: {
    eyebrow: "Impact numbers",
    title: "X-ray of public power",
    stats: [
      { icon: BarChart3, label: "Contracts processed", sublabel: "from SECOP II" },
      { icon: Users, label: "Roll-call votes indexed", sublabel: "public layer syncing" },
      { icon: Globe, label: "Territories covered", sublabel: "visible territorial mapping" },
      { icon: Shield, label: "Active alerts", sublabel: "ML‑prioritized" },
      { icon: Database, label: "Connected official sources", sublabel: "SECOP · Senate · datos.gov.co" },
    ],
  },
};

const SIGNAL_TEXT = {
  es: {
    eyebrow: "Ruta de una señal",
    title: "Tres capas. Una misma pista.",
    body: "La lectura no termina en un mapa o en una tabla. Una alerta empieza en un contrato, toma contexto en el voto y gana profundidad cuando aparece la red alrededor.",
    pulseLabel: "Cruce activo",
    pulseTitle: "Del expediente al patrón",
    pulseBody:
      "Cada módulo empuja al siguiente para que la investigación no se corte: primero ves el contrato, después el comportamiento político y luego la constelación de relaciones.",
    metrics: {
      contracts: "registros trazados",
      votes: "votos indexados",
      money: "Capa relacional en construcción",
    },
    cards: {
      contracts: {
        title: "El expediente abre la pista",
        body: "Empieza por el contrato, su entidad, su modalidad y la intensidad territorial para ubicar el primer desbalance visible.",
      },
      votes: {
        title: "El voto añade contexto político",
        body: "Cruza promesas, partidos y comportamiento legislativo para saber si la conducta pública sostiene el discurso.",
      },
      money: {
        title: "La red confirma la repetición",
        body: "Sigue nodos que vuelven a aparecer entre contratistas, financiadores y actores conectados.",
      },
    },
  },
  en: {
    eyebrow: "Signal route",
    title: "Three layers. One trail.",
    body: "The reading does not end in a map or a table. An alert starts in a contract, gains context in the vote, and gets depth once the surrounding network appears.",
    pulseLabel: "Active cross-check",
    pulseTitle: "From record to pattern",
    pulseBody:
      "Each module pushes into the next so the investigation does not break apart: first the contract, then the political behavior, then the constellation of relationships.",
    metrics: {
      contracts: "records traced",
      votes: "votes indexed",
      money: "Relationship layer in progress",
    },
    cards: {
      contracts: {
        title: "The record opens the trail",
        body: "Start with the contract, its entity, modality, and territorial intensity to locate the first visible imbalance.",
      },
      votes: {
        title: "The vote adds political context",
        body: "Cross promises, parties, and legislative behavior to see whether public conduct matches the stated agenda.",
      },
      money: {
        title: "The network confirms repetition",
        body: "Follow nodes that keep reappearing across contractors, funders, and connected actors.",
      },
    },
  },
};

function hasNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

type DeptRow = { geoName: string; label: string; avgRisk: number; contractCount: number };

export function pickHottestDepartment<T extends DeptRow>(rows: T[]): T | undefined {
  if (!rows || rows.length === 0) return undefined;
  return [...rows].sort((a, b) => {
    const aRisk = Number.isFinite(a.avgRisk) ? a.avgRisk : -Infinity;
    const bRisk = Number.isFinite(b.avgRisk) ? b.avgRisk : -Infinity;
    if (bRisk !== aRisk) return bRisk - aRisk;
    if ((b.contractCount ?? 0) !== (a.contractCount ?? 0)) {
      return (b.contractCount ?? 0) - (a.contractCount ?? 0);
    }
    return String(a.label ?? a.geoName).localeCompare(String(b.label ?? b.geoName));
  })[0];
}

function formatLandingNumber(value: number | null | undefined, lang: Lang) {
  if (!hasNumber(value)) {
    return lang === "es" ? "próximamente" : "coming soon";
  }

  return value.toLocaleString(lang === "es" ? "es-CO" : "en-US");
}

function normalizeVotometroLandingStats(value: unknown): VotometroLandingStats | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as {
    meta?: {
      activeLegislators?: unknown;
      indexedVotes?: unknown;
      averageCoherence?: unknown;
    };
    issue?: unknown;
  };

  return {
    activeLegislators: hasNumber(payload.meta?.activeLegislators) ? payload.meta.activeLegislators : null,
    indexedVotes: hasNumber(payload.meta?.indexedVotes) ? payload.meta.indexedVotes : null,
    averageCoherence:
      hasNumber(payload.meta?.averageCoherence) || payload.meta?.averageCoherence === null
        ? (payload.meta?.averageCoherence as number | null)
        : null,
    available: payload.issue == null,
  };
}

function scheduleLandingDataLoad(callback: () => void, timeout = 1400) {
  if (typeof window === "undefined") return () => {};
  const idleWindow = window as Window & typeof globalThis & {
    requestIdleCallback?: (cb: IdleRequestCallback, options?: IdleRequestOptions) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
  let idleId: number | null = null;

  if (idleWindow.requestIdleCallback) {
    idleId = idleWindow.requestIdleCallback(callback, { timeout });
  } else {
    timeoutId = globalThis.setTimeout(callback, timeout);
  }

  return () => {
    if (idleId !== null && idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(idleId);
    if (timeoutId !== null) globalThis.clearTimeout(timeoutId);
  };
}

function landingRiskStops(departments: OverviewPayload["map"]["departments"]) {
  const sorted = departments
    .map((department) => department.avgRisk)
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);

  if (!sorted.length) return { medium: 0.4, high: 0.7 };

  const pick = (ratio: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)))];
  return {
    medium: pick(0.34),
    high: pick(0.67),
  };
}

function landingRiskTone(value: number, stops: { medium: number; high: number }) {
  if (value <= 0) return "low";
  if (value >= stops.high) return "high";
  if (value >= stops.medium) return "mid";
  return "low";
}

export function LandingPage({
  lang,
  initialOverview,
  initialVotometroStats,
}: {
  lang: Lang;
  initialOverview: OverviewPayload;
  initialVotometroStats: VotometroLandingStats;
}) {
  const scope = useRef<HTMLDivElement | null>(null);
  const hillsWrapRef = useRef<HTMLDivElement | null>(null);
  const [overview, setOverview] = useState<OverviewPayload>(initialOverview);
  const [votometroStats, setVotometroStats] = useState<VotometroLandingStats>(initialVotometroStats);
  const [geojson, setGeojson] = useState<any | null>(null);
  const [activeDepartment, setActiveDepartment] = useState(
    pickHottestDepartment(initialOverview.map.departments)?.geoName,
  );
  const [hoveredDepartment, setHoveredDepartment] = useState<string | null>(null);
  const [showHeroCanvas, setShowHeroCanvas] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setTimeout(() => setShowHeroCanvas(true), 420);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    let alive = true;
    const cancel = scheduleLandingDataLoad(() => {
      fetchOverview({ lang, full: false })
        .then((data) => {
          if (!alive) return;
          setOverview(data);
          setActiveDepartment((current) => current ?? pickHottestDepartment(data.map.departments)?.geoName);
        })
        .catch(() => {});
    }, 2600);
    return () => {
      alive = false;
      cancel();
    };
  }, [lang]);

  useEffect(() => {
    let alive = true;
    const cancel = scheduleLandingDataLoad(() => {
      fetchGeoJson()
        .then((data) => { if (alive) setGeojson(data); })
        .catch(() => {});
    }, 3400);
    return () => {
      alive = false;
      cancel();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const cancel = scheduleLandingDataLoad(() => {
      fetch("/api/votometro/legislators?page=1&page_size=1", { cache: "no-store" })
        .then(async (response) => {
          const contentType = response.headers.get("content-type") ?? "";
          if (!response.ok || !contentType.includes("application/json")) {
            throw new Error("Votómetro summary unavailable");
          }
          return response.json();
        })
        .then((payload) => {
          if (!alive) return;
          const nextStats = normalizeVotometroLandingStats(payload);
          if (!nextStats) return;
          setVotometroStats((current) => {
            const nextHasCoverage =
              nextStats.available &&
              (hasNumber(nextStats.indexedVotes) ? nextStats.indexedVotes > 0 : nextStats.averageCoherence !== null);
            const currentHasCoverage =
              current.available &&
              (hasNumber(current.indexedVotes) ? current.indexedVotes > 0 : current.averageCoherence !== null);
            return !nextHasCoverage && currentHasCoverage ? current : nextStats;
          });
        })
        .catch(() => {});
    }, 3000);
    return () => {
      alive = false;
      cancel();
    };
  }, []);

  useEffect(() => {
    const root = scope.current;
    if (!root || typeof window === "undefined") return;

    const xTo = gsap.quickTo(root, "--pointer-x", { duration: 0.55, ease: "power3.out" });
    const yTo = gsap.quickTo(root, "--pointer-y", { duration: 0.55, ease: "power3.out" });

    const updatePointer = (clientX: number, clientY: number) => {
      xTo(Number((clientX / window.innerWidth - 0.5).toFixed(4)));
      yTo(Number((clientY / window.innerHeight - 0.5).toFixed(4)));
    };

    const handlePointerMove = (event: PointerEvent) => updatePointer(event.clientX, event.clientY);
    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) updatePointer(touch.clientX, touch.clientY);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  // Clear GSAP inline styles on page hide to prevent bfcache invisibility
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePageHide = () => {
      gsap.set(
        ".lp-hero__eyebrow, .lp-hero__flagbar, .lp-hero__title-line, .lp-hero__lead, .lp-hero__source-row, .lp-hero__scroll-cue, .lp-reveal, .lp-story-stat, .lp-map-grid, .lp-module-card, .lp-signal__frame, .lp-signal-card, .lp-portfolio-card, .lp-process-step, .lp-impact-stat",
        { clearProps: "all" },
      );
    };
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        gsap.set(
          ".lp-hero__eyebrow, .lp-hero__flagbar, .lp-hero__title-line, .lp-hero__lead, .lp-hero__source-row, .lp-hero__scroll-cue, .lp-reveal, .lp-story-stat, .lp-map-grid, .lp-module-card, .lp-signal__frame, .lp-signal-card, .lp-portfolio-card, .lp-process-step, .lp-impact-stat",
          { autoAlpha: 1, y: 0, rotateX: 0, scale: 1 },
        );
      }
    };
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  useGSAP(
    () => {
      const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduceMotion) {
        gsap.set(
          ".lp-hero__eyebrow, .lp-hero__flagbar, .lp-hero__title-line, .lp-hero__lead, .lp-hero__source-row, .lp-hero__scroll-cue, .lp-reveal, .lp-story-stat, .lp-map-grid, .lp-module-card, .lp-signal__frame, .lp-signal-card, .lp-portfolio-card, .lp-process-step, .lp-impact-stat",
          { autoAlpha: 1, y: 0, rotateX: 0, scale: 1 },
        );
        return;
      }

      /* ── HERO ENTRANCE (above fold, no ScrollTrigger) ── */
      gsap.fromTo(
        ".lp-hero__eyebrow, .lp-hero__flagbar",
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.06, ease: "power3.out", delay: 0.1,
          onComplete() { gsap.set(this.targets(), { clearProps: "opacity,visibility" }); } },
      );

      gsap.fromTo(
        ".lp-hero__title-line",
        { autoAlpha: 0, y: 54, rotateX: -58, transformOrigin: "center bottom" },
        { autoAlpha: 1, y: 0, rotateX: 0, duration: 0.82, stagger: 0.07, ease: "back.out(1.45)", delay: 0.22,
          onComplete() { gsap.set(this.targets(), { clearProps: "opacity,visibility,transform" }); } },
      );

      gsap.fromTo(
        ".lp-hero__lead, .lp-hero__source-row",
        { autoAlpha: 0, y: 22 },
        { autoAlpha: 1, y: 0, duration: 0.72, stagger: 0.09, ease: "power3.out", delay: 0.55,
          onComplete() { gsap.set(this.targets(), { clearProps: "opacity,visibility,transform" }); } },
      );

      if (document.querySelector(".lp-hero__story-panel")) {
        gsap.fromTo(
          ".lp-hero__story-panel",
          { autoAlpha: 0, y: -30, scale: 0.976 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 1.1,
            ease: "power4.out",
            delay: 0.85,
          },
        );

        /* ── STORY-PANEL: slide down on scroll to fill the gap above stats ── */
        const panelTravel = Math.min(220, Math.max(120, window.innerHeight * 0.18));
        gsap.to(".lp-hero__story-panel", {
          y: panelTravel,
          ease: "none",
          scrollTrigger: {
            trigger: ".lp-hero",
            start: "top top",
            end: "bottom top",
            scrub: 0.8,
          },
        });
      }

      gsap.fromTo(
        ".lp-hero__scroll-cue",
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 1.2, ease: "power2.out", delay: 1.2 },
      );

      /* ── HERO SCROLL STAGE: gentle parallax without hiding primary context ── */
      const heroTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: ".lp-hero",
          start: "top top",
          end: "bottom bottom",
          scrub: 1.1,
        },
      });

      heroTimeline
        .to(
          ".lp-hero__hills-wrap",
          {
            yPercent: 12,
            scale: 1.08,
            ease: "none",
          },
          0,
        )
        .to(
          ".lp-hero__content",
          {
            yPercent: -10,
            ease: "none",
          },
          0,
        )
        .to(
          ".lp-hero__title-group",
          {
            yPercent: -15,
            scale: 0.972,
            ease: "none",
          },
          0,
        )
        .to(
          ".lp-hero__eyebrow, .lp-hero__flagbar",
          {
            yPercent: -10,
            autoAlpha: 0.45,
            ease: "none",
          },
          0,
        )
        .to(
          ".lp-hero__scroll-cue",
          {
            autoAlpha: 0,
            y: -16,
            ease: "none",
          },
          0.08,
        )
        ;

      /* ── SCROLL-REVEAL SECTIONS ── */
      gsap.utils.toArray<HTMLElement>(".lp-reveal").forEach((el) => {
        gsap.fromTo(
          el,
          { autoAlpha: 0, y: 72 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.95,
            ease: "power3.out",
            onComplete() { gsap.set(el, { clearProps: "opacity,visibility" }); },
            scrollTrigger: { trigger: el, start: "top 88%" },
          },
        );
      });

      gsap.fromTo(
        ".lp-story-stat",
        { autoAlpha: 0, y: 86, rotateX: -18, scale: 0.92, transformOrigin: "50% 100%" },
        { autoAlpha: 1, y: 0, rotateX: 0, scale: 1, duration: 0.95, stagger: 0.12, ease: "back.out(1.35)",
          onComplete() { gsap.set(this.targets(), { clearProps: "opacity,visibility,transform" }); },
          scrollTrigger: { trigger: ".lp-story__stats", start: "top 86%" } },
      );

      gsap.to(".lp-story-stat", {
        yPercent: (index) => [-10, 7, -5][index % 3],
        ease: "none",
        scrollTrigger: { trigger: ".lp-story", start: "top bottom", end: "bottom top", scrub: 1.15 },
      });

      gsap.fromTo(
        ".lp-map-grid",
        { autoAlpha: 0, y: 86, scale: 0.965 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 1.05, ease: "power4.out",
          onComplete() { gsap.set(this.targets(), { clearProps: "opacity,visibility,transform" }); },
          scrollTrigger: { trigger: ".lp-map-grid", start: "top 84%" } },
      );

      gsap.fromTo(
        ".lp-module-card",
        { autoAlpha: 0, y: 34 },
        {
          autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.1, ease: "power3.out",
          onComplete() { gsap.set(this.targets(), { clearProps: "opacity,visibility,transform" }); },
          scrollTrigger: { trigger: ".lp-map-grid__modules", start: "top 84%" },
        },
      );

      gsap.fromTo(
        ".lp-signal__frame",
        { autoAlpha: 0, y: 28, scale: 0.985 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.8,
          ease: "power3.out",
          onComplete() {
            gsap.set(this.targets(), { clearProps: "opacity,visibility,transform" });
          },
          scrollTrigger: { trigger: ".lp-signal", start: "top 82%" },
        },
      );

      gsap.fromTo(
        ".lp-signal",
        { clipPath: "inset(13% 0% 0% 0%)", y: 90 },
        {
          clipPath: "inset(0% 0% 0% 0%)",
          y: 0,
          duration: 1.15,
          ease: "power4.out",
          scrollTrigger: { trigger: ".lp-signal", start: "top 90%" },
        },
      );

      gsap.fromTo(
        ".lp-signal-card",
        { autoAlpha: 0, y: 26 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.65,
          stagger: 0.1,
          ease: "power3.out",
          onComplete() {
            gsap.set(this.targets(), { clearProps: "opacity,visibility,transform" });
          },
          scrollTrigger: { trigger: ".lp-signal__grid", start: "top 86%" },
        },
      );

      if (document.querySelector(".lp-signal__pulse")) {
        gsap.to(".lp-signal__pulse", {
          yPercent: 16,
          ease: "none",
          scrollTrigger: { trigger: ".lp-signal__frame", start: "top 72%", end: "bottom 28%", scrub: true },
        });
      }

      /* ── PROCESS STEPS ── */
      gsap.utils.toArray<HTMLElement>(".lp-process-step").forEach((step) => {
        gsap.fromTo(
          step,
          { autoAlpha: 0, y: 92, scale: 0.965, clipPath: "inset(12% 0% 0% 0%)" },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            clipPath: "inset(0% 0% 0% 0%)",
            duration: 1,
            ease: "power4.out",
            onComplete() { gsap.set(step, { clearProps: "opacity,visibility,transform,clipPath" }); },
            scrollTrigger: { trigger: step, start: "top 78%" },
          },
        );
      });

      /* ── IMPACT STATS ── */
      gsap.fromTo(
        ".lp-impact-stat",
        { autoAlpha: 0, y: 54, scale: 0.94, rotateX: -8 },
        {
          autoAlpha: 1, y: 0, scale: 1, rotateX: 0, duration: 0.8, stagger: 0.1, ease: "power4.out",
          onComplete() { gsap.set(this.targets(), { clearProps: "opacity,visibility,transform" }); },
          scrollTrigger: { trigger: ".lp-impact", start: "top 82%" },
        },
      );

      gsap.fromTo(
        ".lp-impact__grid",
        { clipPath: "inset(12% 0% 0% 0%)", y: 64 },
        {
          clipPath: "inset(0% 0% 0% 0%)",
          y: 0,
          duration: 1.05,
          ease: "power4.out",
          onComplete() { gsap.set(".lp-impact__grid", { clearProps: "clipPath,transform" }); },
          scrollTrigger: { trigger: ".lp-impact", start: "top 78%" },
        },
      );

      gsap.fromTo(
        ".lp-portfolio-card",
        { autoAlpha: 0, y: 28 },
        {
          autoAlpha: 1, y: 0, duration: 0.74, ease: "power3.out",
          onComplete() { gsap.set(this.targets(), { clearProps: "opacity,visibility" }); },
          scrollTrigger: { trigger: ".lp-portfolio", start: "top 82%" },
        },
      );

      /* ── GLOW PARALLAX ── */
      gsap.to(".lp-hero__glow--yellow", {
        yPercent: -16, xPercent: 6, ease: "none",
        scrollTrigger: { trigger: ".lp-hero", start: "top bottom", end: "bottom top", scrub: true },
      });
      gsap.to(".lp-hero__glow--blue", {
        yPercent: 10, xPercent: -5, ease: "none",
        scrollTrigger: { trigger: ".lp-hero", start: "top bottom", end: "bottom top", scrub: true },
      });
      gsap.to(".lp-hero__glow--red", {
        yPercent: -8, xPercent: 4, ease: "none",
        scrollTrigger: { trigger: ".lp-hero", start: "top bottom", end: "bottom top", scrub: true },
      });
    },
    { scope, dependencies: [lang, overview.meta.sourceRows, overview.slice.redAlerts] },
  );

  const totalContracts = overview.meta.sourceRows || overview.meta.totalRows || overview.slice.totalContracts;
  const latestDate =
    overview.meta.sourceLatestContractDate ??
    overview.meta.latestContractDate ??
    (lang === "es" ? "sin fecha visible" : "no visible date");
  const hottestDepartment = pickHottestDepartment(overview.map.departments);
  const currentDepartmentData =
    overview.map.departments.find((item) => item.geoName === activeDepartment) ?? hottestDepartment;
  const focusedDepartment = hoveredDepartment ?? activeDepartment ?? hottestDepartment?.geoName ?? null;
  const focusedDepartmentData =
    overview.map.departments.find((item) => item.geoName === focusedDepartment) ??
    (focusedDepartment
      ? { geoName: focusedDepartment, label: deptDisplayLabel(focusedDepartment), avgRisk: 0, contractCount: 0 }
      : currentDepartmentData);
  const mapRiskStops = landingRiskStops(overview.map.departments);
  const featureSet = FEATURE_TEXT[lang];
  const features = [featureSet.contract, featureSet.promises, featureSet.money];
  const contratoHref = `/contrato-limpio?lang=${lang}`;

  const focusTone = landingRiskTone(focusedDepartmentData?.avgRisk ?? 0, mapRiskStops);

  const handleDeptSelect = (geoName: string) => {
    setActiveDepartment((prev) => prev === geoName ? prev : geoName);
  };

  const processData = PROCESS_TEXT[lang];
  const impactData = IMPACT_TEXT[lang];
  const signalData = SIGNAL_TEXT[lang];
  const hasOverviewData =
    overview.map.departments.length > 0 ||
    hasNumber(overview.meta.sourceRows) ||
    overview.meta.totalRows > 0 ||
    overview.slice.totalContracts > 0;
  const totalContractsValue = hasOverviewData && hasNumber(totalContracts) ? totalContracts : null;
  const redAlertsValue = hasOverviewData && hasNumber(overview.slice.redAlerts) ? overview.slice.redAlerts : null;
  const territoryCoverageCount = overview.map.departments.length;
  const territoryCoverageValue = territoryCoverageCount > 0 ? territoryCoverageCount : null;
  const hasTotalContracts = totalContractsValue !== null;
  const hasRedAlerts = redAlertsValue !== null;
  const territoryCoverageSubLabel =
    territoryCoverageCount === 33
      ? lang === "es"
        ? "32 departamentos + Bogotá D.C."
        : "32 departments + Bogotá D.C."
      : lang === "es"
        ? "mapeo territorial visible"
        : "visible territorial mapping";
  const votometroCoverageSubLabel =
    votometroStats.available && hasNumber(votometroStats.activeLegislators)
      ? lang === "es"
        ? `${formatLandingNumber(votometroStats.activeLegislators, lang)} perfiles sincronizados`
        : `${formatLandingNumber(votometroStats.activeLegislators, lang)} synced profiles`
      : impactData.stats[1].sublabel;
  const votometroIndexedValue =
    votometroStats.available && hasNumber(votometroStats.indexedVotes) && votometroStats.indexedVotes > 0
      ? votometroStats.indexedVotes
      : null;
  const votometroPrimaryValue =
    votometroIndexedValue ??
    (votometroStats.available && hasNumber(votometroStats.activeLegislators) ? votometroStats.activeLegislators : null);
  const votometroPrimaryMetric =
    votometroIndexedValue !== null
      ? signalData.metrics.votes
      : lang === "es"
        ? "perfiles sincronizados"
        : "synced profiles";
  const impactStats = [
    {
      ...impactData.stats[0],
      value: formatLandingNumber(totalContractsValue, lang),
    },
    {
      ...impactData.stats[1],
      label:
        votometroIndexedValue !== null
          ? impactData.stats[1].label
          : lang === "es"
            ? "Perfiles legislativos sincronizados"
            : "Synced legislative profiles",
      value: formatLandingNumber(votometroPrimaryValue, lang),
      sublabel: votometroCoverageSubLabel,
    },
    {
      ...impactData.stats[2],
      value: formatLandingNumber(territoryCoverageValue, lang),
      sublabel: territoryCoverageSubLabel,
    },
    {
      ...impactData.stats[3],
      value: formatLandingNumber(redAlertsValue, lang),
    },
    {
      ...impactData.stats[4],
      // Three live source families wired to the platform: SECOP II contracts,
      // Senado abierto roll-call votes, datos.gov.co reference catalogues.
      value: "3",
    },
  ];
  const signalCards = [
    {
      href: featureSet.contract.href,
      kicker: featureSet.contract.title,
      icon: FileSearch,
      tone: "yellow" as FeatureTone,
      value: formatLandingNumber(totalContractsValue, lang),
      metric: signalData.metrics.contracts,
      title: signalData.cards.contracts.title,
      body: signalData.cards.contracts.body,
    },
    {
      href: featureSet.promises.href,
      kicker: featureSet.promises.title,
      icon: Radar,
      tone: "blue" as FeatureTone,
      value: formatLandingNumber(votometroPrimaryValue, lang),
      metric: votometroPrimaryMetric,
      title: signalData.cards.votes.title,
      body: signalData.cards.votes.body,
    },
    {
      href: featureSet.money.href,
      kicker: featureSet.money.title,
      icon: Waypoints,
      tone: "red" as FeatureTone,
      value: formatLandingNumber(redAlertsValue, lang),
      metric: signalData.metrics.money,
      title: signalData.cards.money.title,
      body: signalData.cards.money.body,
    },
  ];
  const legalHref = `/etica-y-privacidad?lang=${lang}`;
  const legalBlock = {
    eyebrow: lang === "es" ? "Uso responsable" : "Responsible use",
    title:
      lang === "es"
        ? "Señales públicas, no acusaciones"
        : "Public signals, not accusations",
    body:
      lang === "es"
        ? "VeedurIA prioriza revisión ciudadana con fuentes oficiales. No emite asesoría legal, financiera o judicial; cada usuario debe verificar expedientes primarios antes de actuar."
        : "VeedurIA prioritizes civic review with official sources. It does not provide legal, financial, or judicial advice; each user must verify primary records before acting.",
    cta: lang === "es" ? "Leer límites legales" : "Read legal limits",
  };

  return (
    <div className="shell" ref={scope}>
      <SiteNav
        lang={lang}
        links={[
          { href: `/contrato-limpio?lang=${lang}`, label: "ContratoLimpio" },
          { href: `/votometro?lang=${lang}`, label: "Votómetro" },
        ]}
      />

      <main className="page lp-page">

        {/* ══════════════════════════════════════════════════════
            HERO — Full viewport with title on the hills horizon
            ══════════════════════════════════════════════════════ */}
        <section className="lp-hero">
          <div className="lp-hero__stage">
            {/* Andes hills — full bleed behind the hero */}
            <div ref={hillsWrapRef} className="lp-hero__hills-wrap" aria-hidden="true">
              <span className="lp-hero__hills-static" />
              {showHeroCanvas ? (
                <GLSLHills speed={0.18} cameraZ={118} planeSize={256} />
              ) : null}
            </div>

            <div className="lp-hero__backdrop" aria-hidden="true">
              <span className="lp-hero__glow lp-hero__glow--yellow" />
              <span className="lp-hero__glow lp-hero__glow--blue" />
              <span className="lp-hero__glow lp-hero__glow--red" />
            </div>

            <div className="lp-hero__inner">
              <div className="lp-hero__content">
                <p className="eyebrow lp-hero__eyebrow">
                  {lang === "es"
                    ? "VeedurIA · inteligencia cívica para Colombia"
                    : "VeedurIA · civic intelligence for Colombia"}
                </p>

                <div className="lp-hero__title-group">
                  <h1
                    className="lp-hero__title"
                    aria-label={
                      lang === "es"
                        ? "El poder público, visible y auditable"
                        : "Public power, visible and auditable"
                    }
                  >
                    <span className="lp-hero__title-line">
                      {lang === "es" ? "El poder público," : "Public power,"}
                    </span>
                    <span className="lp-hero__title-line">
                      <span className="lp-hero__title-accent lp-hero__title-accent--letters" aria-label="visible">
                        <span className="lp-hero__title-letter is-yellow">v</span>
                        <span className="lp-hero__title-letter is-yellow">i</span>
                        <span className="lp-hero__title-letter is-blue">s</span>
                        <span className="lp-hero__title-letter is-red">i</span>
                        <span className="lp-hero__title-letter is-red">b</span>
                        <span className="lp-hero__title-letter is-red">l</span>
                        <span className="lp-hero__title-letter is-red">e</span>
                      </span>
                      {lang === "es" ? " y auditable" : " and auditable"}
                    </span>
                  </h1>
                </div>

                <p className="lp-hero__lead">
                  {lang === "es"
                    ? "Una lectura pública de contratos, votos y redes de influencia. Datos oficiales, capas cruzadas y señales listas para investigar sin convertir la vigilancia ciudadana en una hoja de cálculo."
                    : "A public reading of contracts, votes, and influence networks. Official data, crossed layers, and signals ready to investigate without turning civic oversight into a spreadsheet."}
                </p>

                <div className="lp-hero__source-row" aria-label={lang === "es" ? "Fuentes principales" : "Primary sources"}>
                  <span>SECOP II</span>
                  <span>{lang === "es" ? "Senado abierto" : "Open Senate"}</span>
                  <span>datos.gov.co</span>
                </div>

                <p className="lp-hero__credit">
                  {lang === "es"
                    ? "Creado por Daniel Steven Rodríguez Sandoval"
                    : "Created by Daniel Steven Rodríguez Sandoval"}
                </p>
              </div>
            </div>



            {/* Scroll cue at the bottom of the hero viewport */}
            <div className="lp-hero__scroll-cue" aria-hidden="true">
              <span className="lp-hero__scroll-line" />
              <span className="lp-hero__scroll-label">
                {lang === "es" ? "Desliza" : "Scroll"}
              </span>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
            STORY — Revealed content after scrolling past hero
            ══════════════════════════════════════════════════════ */}
        <section className="lp-story">
          <div className="lp-story__inner">
            {/* KPI stats row */}
            <div className="lp-story__stats">
              <article className="lp-story-stat lp-story-stat--yellow">
                <span>{lang === "es" ? "Registros en fuente oficial" : "Records in official source"}</span>
                {hasTotalContracts ? (
                  <strong>{formatLandingNumber(totalContractsValue, lang)}</strong>
                ) : (
                  <div className="lp-stat-skeleton" aria-hidden="true" />
                )}
                <p>{lang === "es" ? `fuente al ${latestDate}` : `source through ${latestDate}`}</p>
              </article>
              <article className="lp-story-stat lp-story-stat--blue">
                <span>{lang === "es" ? "Alertas listas" : "Alerts ready"}</span>
                {hasRedAlerts ? (
                  <strong>{formatLandingNumber(redAlertsValue, lang)}</strong>
                ) : (
                  <div className="lp-stat-skeleton" aria-hidden="true" />
                )}
                <p>{lang === "es" ? "priorizados para abrir primero" : "prioritized for first review"}</p>
              </article>
              <article className="lp-story-stat lp-story-stat--red">
                <span>{lang === "es" ? "Territorio más encendido" : "Most active territory"}</span>
                <strong>{currentDepartmentData?.label ?? "Colombia"}</strong>
                <p>
                  {currentDepartmentData
                    ? `${Math.round(currentDepartmentData.avgRisk * 100)}/100 intensidad`
                    : lang === "es"
                      ? "sin dato visible"
                      : "no visible data"}
                </p>
              </article>
            </div>

            {/* ── MAP + MODULES (2-column) ────────────────────── */}
            <div className="lp-map-grid">

              {/* Left: Colombia map + info box */}
              <div className="lp-map-grid__left">
                <div className="lp-map-grid__head">
                  <p className="eyebrow">{lang === "es" ? "Mapa de riesgo territorial" : "Territorial risk map"}</p>
                  <p className="lp-map-grid__hint">
                    {lang === "es"
                      ? "Cada departamento muestra el volumen de contratos y la intensidad de riesgo calculada por el modelo. Haz clic para filtrar en ContratoLimpio."
                      : "Each department shows contract volume and model-computed risk intensity. Click to filter in ContratoLimpio."}
                  </p>
                </div>

                <div className="lp-map-grid__canvas">
                  {geojson ? (
                    <ColombiaMap
                      geojson={geojson}
                      departments={overview.map.departments}
                      activeDepartment={activeDepartment}
                      onHoverChange={setHoveredDepartment}
                      onSelect={handleDeptSelect}
                      mode="hero"
                      showCaption={false}
                      showTooltip={false}
                      className="lp-map-grid__visual"
                    />
                  ) : (
                    <div className="cv-map-placeholder">
                      <span className="cv-spinner" aria-hidden="true" />
                      <span className="label">{lang === "es" ? "Cargando territorio" : "Loading territory"}</span>
                    </div>
                  )}
                </div>

                {/* Static info box, updates on hover or click with no floating tooltip */}
                <div className={`lp-map-info lp-map-info--${focusTone}`} aria-live="polite">
                  <div className="lp-map-info__body">
                    <p className="lp-map-info__label">
                      {hoveredDepartment
                        ? (lang === "es" ? "En foco" : "In focus")
                        : (lang === "es" ? "Departamento activo" : "Active department")}
                    </p>
                    <strong className="lp-map-info__name">
                      {focusedDepartmentData?.label ?? "Colombia"}
                    </strong>
                    <p className="lp-map-info__meta">
                      {(focusedDepartmentData?.contractCount ?? 0).toLocaleString(lang === "es" ? "es-CO" : "en-US")}
                      {" "}{lang === "es" ? "contratos" : "contracts"}
                      {" · "}
                      {Math.round((focusedDepartmentData?.avgRisk ?? 0) * 100)}/100{" "}
                      {lang === "es" ? "intensidad" : "intensity"}
                    </p>
                  </div>
                  <div className="lp-map-info__legend">
                    <span className="lp-map-legend__item"><i className="is-high" />{lang === "es" ? "Alto" : "High"}</span>
                    <span className="lp-map-legend__item"><i className="is-mid" />{lang === "es" ? "Ámbar" : "Amber"}</span>
                    <span className="lp-map-legend__item"><i className="is-low" />{lang === "es" ? "Bajo" : "Low"}</span>
                  </div>
                  <Link href={contratoHref} className="lp-map-info__cta">
                    {lang === "es" ? "Abrir ContratoLimpio" : "Open ContratoLimpio"}
                    <ArrowRight size={14} aria-hidden={true} />
                  </Link>
                </div>
              </div>

              {/* Right: Module cards */}
              <div className="lp-map-grid__modules">
                <div className="lp-map-grid__modules-head">
                  <p className="eyebrow lp-map-grid__modules-eyebrow">
                    {lang === "es" ? "Herramientas de análisis" : "Analysis tools"}
                  </p>
                  <strong>{lang === "es" ? "Tres capas conectadas" : "Three connected layers"}</strong>
                  <span>{lang === "es" ? "Abre cada módulo desde una acción clara." : "Open each module from a clear action."}</span>
                </div>
                {features.map((feature) => {
                  const Icon = feature.icon;
                  const isMoneyGated = feature.title === "SigueElDinero";
                  const cardClass = `lp-module-card lp-module-card--${feature.tone}${isMoneyGated ? " lp-module-card--gated" : ""}`;
                  const inner = (
                    <>
                      <div className="lp-module-card__top">
                        <span className={`lp-module-card__icon lp-module-card__icon--${feature.tone}`}>
                          <Icon size={16} />
                        </span>
                        <span className="lp-module-card__kicker">{feature.kicker}</span>
                        {isMoneyGated ? (
                          <span className="lp-module-card__pill" aria-label={lang === "es" ? "En construcción" : "In progress"}>
                            {lang === "es" ? "En construcción" : "In progress"}
                          </span>
                        ) : null}
                      </div>
                      <strong className="lp-module-card__title">{feature.title}</strong>
                      <p className="lp-module-card__body">{feature.body}</p>
                      <span className="lp-module-card__footer">
                        <span className={`lp-module-card__signal lp-module-card__signal--${feature.tone}`}>
                          {feature.signal.split(" · ").map((part) => (
                            <span key={part} className="lp-module-card__signal-part">
                              {part}
                            </span>
                          ))}
                        </span>
                        <span className="lp-module-card__cta">
                          {isMoneyGated ? (lang === "es" ? "Próximamente" : "Coming soon") : feature.cta}
                          {isMoneyGated ? null : <ArrowRight size={13} aria-hidden={true} />}
                        </span>
                      </span>
                    </>
                  );
                  if (isMoneyGated) {
                    return (
                      <div
                        key={feature.title}
                        className={cardClass}
                        role="group"
                        aria-disabled="true"
                      >
                        {inner}
                      </div>
                    );
                  }
                  return (
                    <Link key={feature.title} href={feature.href} className={cardClass}>
                      {inner}
                    </Link>
                  );
                })}
              </div>
            </div>

          </div>
        </section>

        <section className="lp-signal">
          <div className="lp-signal__inner">
            <div className="lp-signal__header lp-reveal">
              <p className="eyebrow">{signalData.eyebrow}</p>
              <h2 className="lp-signal__title">{signalData.title}</h2>
              <p className="lp-signal__body">{signalData.body}</p>
            </div>

            <div className="lp-signal__frame">
              <span className="lp-signal__rail" aria-hidden="true" />
              <div className="lp-signal__grid">
                {signalCards.map((card) => {
                  const CardIcon = card.icon;
                  const isMoneyGated = card.kicker === "SigueElDinero";
                  const cardClass = `lp-signal-card lp-signal-card--${card.tone}${isMoneyGated ? " lp-signal-card--gated" : ""}`;
                  const inner = (
                    <>
                      <div className="lp-signal-card__top">
                        <span className={`lp-signal-card__icon lp-signal-card__icon--${card.tone}`}>
                          <CardIcon size={18} />
                        </span>
                        <span className="lp-signal-card__kicker">{card.kicker}</span>
                      </div>
                      <strong className="lp-signal-card__title">{card.title}</strong>
                      <p className="lp-signal-card__body">{card.body}</p>
                      <div className="lp-signal-card__metric">
                        {isMoneyGated ? (
                          <strong>{lang === "es" ? "Próximamente" : "Coming soon"}</strong>
                        ) : (
                          <strong>{card.value}</strong>
                        )}
                        <span>{card.metric}</span>
                      </div>
                      <span className="lp-signal-card__cta">
                        {isMoneyGated
                          ? lang === "es" ? "Próximamente" : "Coming soon"
                          : lang === "es" ? "Seguir capa" : "Follow layer"}
                        {isMoneyGated ? null : <ArrowRight size={14} aria-hidden={true} />}
                      </span>
                    </>
                  );
                  if (isMoneyGated) {
                    return (
                      <div key={card.kicker} className={cardClass} role="group" aria-disabled="true">
                        {inner}
                      </div>
                    );
                  }
                  return (
                    <Link key={card.kicker} href={card.href} className={cardClass}>
                      {inner}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
            PROCESS — "How it works" 3-step flow
            ══════════════════════════════════════════════════════ */}
        <section className="lp-process">
          <div className="lp-process__inner">
            <div className="lp-process__header lp-reveal">
              <p className="eyebrow">{processData.eyebrow}</p>
              <h2 className="lp-process__title">{processData.title}</h2>
            </div>

            <div className="lp-process__grid">
              {processData.steps.map((step, i) => {
                const StepIcon = step.icon;
                return (
                  <div key={step.number} className="lp-process-step" style={{ "--step-delay": `${i * 0.12}s` } as React.CSSProperties}>
                    <div className="lp-process-step__number-row">
                      <span className="lp-process-step__number">{step.number}</span>
                      {i < processData.steps.length - 1 && (
                        <span className="lp-process-step__connector" aria-hidden="true" />
                      )}
                    </div>
                    <div className="lp-process-step__icon">
                      <StepIcon size={22} />
                    </div>
                    <h3 className="lp-process-step__title">{step.title}</h3>
                    <p className="lp-process-step__body">{step.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
            IMPACT — Stats grid
            ══════════════════════════════════════════════════════ */}
        <section className="lp-impact">
          <div className="lp-impact__inner">
            <div className="lp-impact__header lp-reveal">
              <p className="eyebrow">{impactData.eyebrow}</p>
              <h2 className="lp-impact__title">{impactData.title}</h2>
            </div>

            <div className="lp-impact__grid">
              {impactStats.map((stat) => {
                const StatIcon = stat.icon;
                return (
                  <div key={stat.label} className="lp-impact-stat">
                    <span className="lp-impact-stat__icon">
                      <StatIcon size={20} />
                    </span>
                    <strong className="lp-impact-stat__value">{stat.value}</strong>
                    <span className="lp-impact-stat__label">{stat.label}</span>
                    <span className="lp-impact-stat__sub">{stat.sublabel}</span>
                  </div>
                );
              })}
              <Link href={legalHref} className="lp-impact-legal">
                <span className="lp-impact-legal__icon">
                  <Scale size={20} aria-hidden={true} />
                </span>
                <span className="eyebrow">{legalBlock.eyebrow}</span>
                <strong>{legalBlock.title}</strong>
                <p>{legalBlock.body}</p>
                <span className="lp-impact-legal__cta">
                  {legalBlock.cta}
                  <ArrowRight size={14} aria-hidden={true} />
                </span>
              </Link>
            </div>
          </div>
        </section>

        {/* ── PORTFOLIO ───────────────────────────────────────── */}
        <section className="lp-portfolio">
          <div className="lp-portfolio-card">
            <div>
              <p className="eyebrow">{lang === "es" ? "Más trabajo" : "More work"}</p>
              <h2>{lang === "es" ? "Explora más proyectos del creador" : "Explore more work from the creator"}</h2>
              <p>
                {lang === "es"
                  ? "Visualización de datos, civic-tech y producto público con la misma obsesión por claridad, fuente y diseño."
                  : "Data visualization, civic tech, and public product work with the same obsession for clarity, source, and design."}
              </p>
            </div>
            <a
              href="https://daniel-data.vercel.app/"
              className="lp-portfolio-card__link"
              target="_blank"
              rel="noopener noreferrer"
            >
              {lang === "es" ? "Ver más proyectos" : "See more projects"}
              <ArrowRight size={16} aria-hidden={true} />
            </a>
          </div>
        </section>
      </main>

      <SiteFooter lang={lang} />
    </div>
  );
}
