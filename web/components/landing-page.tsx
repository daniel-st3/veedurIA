"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, FileSearch, Radar, Waypoints, Database, Shield, Eye, BarChart3, Users, Globe } from "lucide-react";

import { ColombiaMap } from "@/components/colombia-map";
import { GLSLHills } from "@/components/ui/glsl-hills";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { fetchGeoJson, fetchOverview } from "@/lib/api";
import { deptDisplayLabel } from "@/lib/colombia-departments";
import type { Lang, OverviewPayload } from "@/lib/types";

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
      title: "VotóMeter",
      kicker: "VOTACIONES DEL CONGRESO",
      body: "Cruza votos nominales con el perfil programático de cada legislador. Abre la gaceta y verifica coherencia tema por tema.",
      cta: "Abrir VotóMeter",
      href: "/votometro?lang=es",
      icon: Radar,
      tone: "blue" as FeatureTone,
      signal: "Voto · Legislador · Gaceta",
    },
    money: {
      title: "SigueElDinero",
      kicker: "RED RELACIONAL",
      body: "Conecta contratistas, financiadores y señales repetidas. Visualiza la red de intereses detrás de los contratos públicos.",
      cta: "Ver la red",
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
      title: "VotóMeter",
      kicker: "CONGRESSIONAL VOTES",
      body: "Cross nominal votes with each legislator's programmatic profile. Open the gazette and verify topic-by-topic coherence.",
      cta: "Open VotóMeter",
      href: "/votometro?lang=en",
      icon: Radar,
      tone: "blue" as FeatureTone,
      signal: "Vote · Legislator · Gazette",
    },
    money: {
      title: "SigueElDinero",
      kicker: "RELATIONSHIP NETWORK",
      body: "Connect contractors, funders, and repeated signals. Visualize the network of interests behind public contracts.",
      cta: "See the network",
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
      { icon: BarChart3, value: "5.6M+", label: "Contratos procesados", sublabel: "desde SECOP II" },
      { icon: Users, value: "1.774", label: "Votos nominales indexados", sublabel: "con coherencia verificada" },
      { icon: Globe, value: "32", label: "Departamentos cubiertos", sublabel: "mapeo territorial completo" },
      { icon: Shield, value: "22.8K", label: "Alertas activas", sublabel: "priorizadas por ML" },
    ],
  },
  en: {
    eyebrow: "Impact numbers",
    title: "X-ray of public power",
    stats: [
      { icon: BarChart3, value: "5.6M+", label: "Contracts processed", sublabel: "from SECOP II" },
      { icon: Users, value: "1,774", label: "Roll-call votes indexed", sublabel: "with verified coherence" },
      { icon: Globe, value: "32", label: "Departments covered", sublabel: "full territorial mapping" },
      { icon: Shield, value: "22.8K", label: "Active alerts", sublabel: "ML‑prioritized" },
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
      money: "alertas enlazadas",
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
      money: "linked alerts",
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

export function LandingPage({
  lang,
  initialOverview,
}: {
  lang: Lang;
  initialOverview: OverviewPayload;
}) {
  const scope = useRef<HTMLDivElement | null>(null);
  const hillsWrapRef = useRef<HTMLDivElement | null>(null);
  const [overview, setOverview] = useState<OverviewPayload>(initialOverview);
  const [geojson, setGeojson] = useState<any | null>(null);
  const [activeDepartment, setActiveDepartment] = useState(initialOverview.map.departments[0]?.geoName);
  const [hoveredDepartment, setHoveredDepartment] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchOverview({ lang, full: false })
      .then((data) => {
        if (!alive) return;
        setOverview(data);
        setActiveDepartment((current) => current ?? data.map.departments[0]?.geoName);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [lang]);

  useEffect(() => {
    let alive = true;
    fetchGeoJson()
      .then((data) => { if (alive) setGeojson(data); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Clear GSAP inline styles on page hide to prevent bfcache invisibility
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePageHide = () => {
      gsap.set(
        ".lp-hero__eyebrow, .lp-hero__flagbar, .lp-hero__title-line, .lp-hero__story-panel, .lp-hero__scroll-cue, .lp-reveal, .lp-story-stat, .lp-map-grid, .lp-module-card, .lp-signal__frame, .lp-signal-card, .lp-portfolio-card, .lp-process-step, .lp-impact-stat",
        { clearProps: "all" },
      );
    };
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        gsap.set(
          ".lp-hero__eyebrow, .lp-hero__flagbar, .lp-hero__title-line, .lp-hero__story-panel, .lp-hero__scroll-cue, .lp-reveal, .lp-story-stat, .lp-map-grid, .lp-module-card, .lp-signal__frame, .lp-signal-card, .lp-portfolio-card, .lp-process-step, .lp-impact-stat",
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
          ".lp-hero__eyebrow, .lp-hero__flagbar, .lp-hero__title-line, .lp-hero__story-panel, .lp-hero__scroll-cue, .lp-reveal, .lp-story-stat, .lp-map-grid, .lp-module-card, .lp-signal__frame, .lp-signal-card, .lp-portfolio-card, .lp-process-step, .lp-impact-stat",
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
        { autoAlpha: 0, y: 52, rotateX: -60, transformOrigin: "left bottom" },
        { autoAlpha: 1, y: 0, rotateX: 0, duration: 0.82, stagger: 0.07, ease: "back.out(1.45)", delay: 0.22,
          onComplete() { gsap.set(this.targets(), { clearProps: "opacity,visibility,transform" }); } },
      );

      gsap.fromTo(
        ".lp-hero__scroll-cue",
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 1.2, ease: "power2.out", delay: 1.2 },
      );

      gsap.set(".lp-hero__story-panel", { autoAlpha: 0, y: 54, scale: 0.965 });

      /* ── HERO SCROLL STAGE: title on the horizon, story rises after scroll ── */
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
            yPercent: 20,
            scale: 1.045,
            ease: "none",
          },
          0,
        )
        .to(
          ".lp-hero__content",
          {
            yPercent: -16,
            ease: "none",
          },
          0,
        )
        .to(
          ".lp-hero__title-group",
          {
            yPercent: -24,
            scale: 0.95,
            ease: "none",
          },
          0,
        )
        .to(
          ".lp-hero__eyebrow, .lp-hero__flagbar",
          {
            yPercent: -10,
            autoAlpha: 0.32,
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
        .to(
          ".lp-hero__story-panel",
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            ease: "none",
          },
          0.18,
        );

      /* ── SCROLL-REVEAL SECTIONS ── */
      gsap.utils.toArray<HTMLElement>(".lp-reveal").forEach((el) => {
        gsap.fromTo(
          el,
          { autoAlpha: 0, y: 36 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.75,
            ease: "power3.out",
            onComplete() { gsap.set(el, { clearProps: "opacity,visibility" }); },
            scrollTrigger: { trigger: el, start: "top 86%" },
          },
        );
      });

      gsap.fromTo(
        ".lp-story-stat",
        { autoAlpha: 0, y: 22 },
        { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.08, ease: "power3.out",
          onComplete() { gsap.set(this.targets(), { clearProps: "opacity,visibility" }); },
          scrollTrigger: { trigger: ".lp-story__stats", start: "top 86%" } },
      );

      gsap.fromTo(
        ".lp-map-grid",
        { autoAlpha: 0, y: 28, scale: 0.985 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.8, ease: "power3.out",
          onComplete() { gsap.set(this.targets(), { clearProps: "opacity,visibility,transform" }); },
          scrollTrigger: { trigger: ".lp-map-grid", start: "top 84%" } },
      );

      gsap.fromTo(
        ".lp-module-card",
        { autoAlpha: 0, x: 24 },
        {
          autoAlpha: 1, x: 0, duration: 0.62, stagger: 0.09, ease: "power3.out",
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

      /* ── PROCESS STEPS ── */
      gsap.fromTo(
        ".lp-process-step",
        { autoAlpha: 0, y: 32 },
        {
          autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.12, ease: "power3.out",
          onComplete() { gsap.set(this.targets(), { clearProps: "opacity,visibility" }); },
          scrollTrigger: { trigger: ".lp-process", start: "top 82%" },
        },
      );

      /* ── IMPACT STATS ── */
      gsap.fromTo(
        ".lp-impact-stat",
        { autoAlpha: 0, y: 24, scale: 0.96 },
        {
          autoAlpha: 1, y: 0, scale: 1, duration: 0.65, stagger: 0.09, ease: "power3.out",
          onComplete() { gsap.set(this.targets(), { clearProps: "opacity,visibility,transform" }); },
          scrollTrigger: { trigger: ".lp-impact", start: "top 82%" },
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
  const currentDepartmentData =
    overview.map.departments.find((item) => item.geoName === activeDepartment) ?? overview.map.departments[0];
  const focusedDepartment = hoveredDepartment ?? activeDepartment ?? overview.map.departments[0]?.geoName ?? null;
  const focusedDepartmentData =
    overview.map.departments.find((item) => item.geoName === focusedDepartment) ??
    (focusedDepartment
      ? { geoName: focusedDepartment, label: deptDisplayLabel(focusedDepartment), avgRisk: 0, contractCount: 0 }
      : currentDepartmentData);
  const featureSet = FEATURE_TEXT[lang];
  const features = [featureSet.contract, featureSet.promises, featureSet.money];
  const contratoHref = `/contrato-limpio?lang=${lang}`;

  const focusTone =
    (focusedDepartmentData?.avgRisk ?? 0) >= 0.7
      ? "high"
      : (focusedDepartmentData?.avgRisk ?? 0) >= 0.4
        ? "mid"
        : "low";

  const handleDeptSelect = (geoName: string) => {
    setActiveDepartment((prev) => prev === geoName ? prev : geoName);
  };

  const processData = PROCESS_TEXT[lang];
  const impactData = IMPACT_TEXT[lang];
  const signalData = SIGNAL_TEXT[lang];
  const signalCards = [
    {
      href: featureSet.contract.href,
      kicker: featureSet.contract.title,
      icon: FileSearch,
      tone: "yellow" as FeatureTone,
      value: totalContracts
        ? totalContracts.toLocaleString(lang === "es" ? "es-CO" : "en-US")
        : impactData.stats[0]?.value ?? "5.6M+",
      metric: signalData.metrics.contracts,
      title: signalData.cards.contracts.title,
      body: signalData.cards.contracts.body,
    },
    {
      href: featureSet.promises.href,
      kicker: featureSet.promises.title,
      icon: Radar,
      tone: "blue" as FeatureTone,
      value: impactData.stats[1]?.value ?? (lang === "es" ? "1.774" : "1,774"),
      metric: signalData.metrics.votes,
      title: signalData.cards.votes.title,
      body: signalData.cards.votes.body,
    },
    {
      href: featureSet.money.href,
      kicker: featureSet.money.title,
      icon: Waypoints,
      tone: "red" as FeatureTone,
      value:
        overview.slice.redAlerts > 0
          ? overview.slice.redAlerts.toLocaleString(lang === "es" ? "es-CO" : "en-US")
          : impactData.stats[3]?.value ?? "22.8K",
      metric: signalData.metrics.money,
      title: signalData.cards.money.title,
      body: signalData.cards.money.body,
    },
  ];

  return (
    <div className="shell" ref={scope}>
      <SiteNav
        lang={lang}
        links={[
          { href: `/contrato-limpio?lang=${lang}`, label: "ContratoLimpio" },
          { href: `/votometro?lang=${lang}`, label: "VotóMeter" },
          { href: `/sigue-el-dinero?lang=${lang}`, label: "SigueElDinero" },
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
              <GLSLHills speed={0.3} cameraZ={102} planeSize={288} />
            </div>

            <div className="lp-hero__backdrop" aria-hidden="true">
              <span className="lp-hero__glow lp-hero__glow--yellow" />
              <span className="lp-hero__glow lp-hero__glow--blue" />
              <span className="lp-hero__glow lp-hero__glow--red" />
            </div>

            <div className="lp-hero__content">
              <p className="eyebrow lp-hero__eyebrow">
                {lang === "es"
                  ? "VeedurIA · inteligencia cívica para Colombia"
                  : "VeedurIA · civic intelligence for Colombia"}
              </p>

              <div className="lp-hero__flagbar" aria-hidden="true">
                <span className="is-yellow" />
                <span className="is-blue" />
                <span className="is-red" />
              </div>

              <div className="lp-hero__title-group">
                <h1 className="lp-hero__title">
                  <span className="lp-hero__title-line">
                    {lang === "es" ? "El poder público," : "Public power,"}
                  </span>
                  <span className="lp-hero__title-line">
                    <span className="lp-hero__title-accent lp-hero__title-accent--tricolor">
                      {lang === "es" ? "visible" : "visible"}
                    </span>
                    {lang === "es" ? " y auditable" : " and auditable"}
                  </span>
                </h1>
              </div>
            </div>

            <div className="lp-hero__story-panel">
              <div className="lp-story__live" aria-label={lang === "es" ? "Datos en vivo" : "Live data"}>
                <span className="lp-story__live-dot" aria-hidden="true" />
                {lang === "es" ? "Datos públicos en tiempo real" : "Live public data"}
              </div>

              <p className="lp-hero__story-body">
                {lang === "es"
                  ? "Contratos con señales de riesgo, votos cruzados con programas legislativos y redes de financiación, todo trazado desde la fuente oficial. Sin intermediarios."
                  : "Contracts with risk signals, votes crossed with legislative programmes, and financing networks, all traced from the official source. No intermediaries."}
              </p>

              <div className="lp-hero__story-actions">
                {features.map((feature) => (
                  <Link
                    key={`hero-${feature.title}`}
                    href={feature.href}
                    className={`lp-hero__story-chip lp-hero__story-chip--${feature.tone}`}
                  >
                    <span className="lp-hero__story-chip-copy">
                      <strong>{feature.title}</strong>
                      <span>{feature.kicker}</span>
                    </span>
                    <ArrowRight size={14} aria-hidden={true} />
                  </Link>
                ))}
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
                <span>{lang === "es" ? "Registros oficiales hoy" : "Official records today"}</span>
                {totalContracts ? (
                  <strong>{totalContracts.toLocaleString(lang === "es" ? "es-CO" : "en-US")}</strong>
                ) : (
                  <div className="lp-stat-skeleton" aria-hidden="true" />
                )}
                <p>{lang === "es" ? `fuente al ${latestDate}` : `source through ${latestDate}`}</p>
              </article>
              <article className="lp-story-stat lp-story-stat--blue">
                <span>{lang === "es" ? "Alertas listas" : "Alerts ready"}</span>
                {overview.slice.redAlerts ? (
                  <strong>{overview.slice.redAlerts.toLocaleString(lang === "es" ? "es-CO" : "en-US")}</strong>
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
                    <span className="lp-map-legend__item"><i className="is-mid" />{lang === "es" ? "Medio" : "Med"}</span>
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
                <p className="eyebrow lp-map-grid__modules-eyebrow">
                  {lang === "es" ? "Herramientas de análisis" : "Analysis tools"}
                </p>
                {features.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <Link
                      key={feature.title}
                      href={feature.href}
                      className={`lp-module-card lp-module-card--${feature.tone}`}
                    >
                      <div className="lp-module-card__top">
                        <span className={`lp-module-card__icon lp-module-card__icon--${feature.tone}`}>
                          <Icon size={16} />
                        </span>
                        <span className="lp-module-card__kicker">{feature.kicker}</span>
                      </div>
                      <strong className="lp-module-card__title">{feature.title}</strong>
                      <p className="lp-module-card__body">{feature.body}</p>
                      <span className="lp-module-card__footer">
                        <span className={`lp-module-card__signal lp-module-card__signal--${feature.tone}`}>
                          {feature.signal}
                        </span>
                        <span className="lp-module-card__cta">
                          {feature.cta}
                          <ArrowRight size={13} aria-hidden={true} />
                        </span>
                      </span>
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
                  return (
                    <Link key={card.kicker} href={card.href} className={`lp-signal-card lp-signal-card--${card.tone}`}>
                      <div className="lp-signal-card__top">
                        <span className={`lp-signal-card__icon lp-signal-card__icon--${card.tone}`}>
                          <CardIcon size={18} />
                        </span>
                        <span className="lp-signal-card__kicker">{card.kicker}</span>
                      </div>
                      <strong className="lp-signal-card__title">{card.title}</strong>
                      <p className="lp-signal-card__body">{card.body}</p>
                      <div className="lp-signal-card__metric">
                        <strong>{card.value}</strong>
                        <span>{card.metric}</span>
                      </div>
                      <span className="lp-signal-card__cta">
                        {lang === "es" ? "Seguir capa" : "Follow layer"}
                        <ArrowRight size={14} aria-hidden={true} />
                      </span>
                    </Link>
                  );
                })}
              </div>

              <div className="lp-signal__pulse">
                <span>{signalData.pulseLabel}</span>
                <strong>{signalData.pulseTitle}</strong>
                <p>{signalData.pulseBody}</p>
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
              {impactData.stats.map((stat) => {
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
