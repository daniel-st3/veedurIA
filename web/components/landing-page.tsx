"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, FileSearch, Radar, Waypoints } from "lucide-react";

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

export function LandingPage({
  lang,
  initialOverview,
}: {
  lang: Lang;
  initialOverview: OverviewPayload;
}) {
  const scope = useRef<HTMLDivElement | null>(null);
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
        ".lp-story__eyebrow, .lp-story__flagbar, .lp-story__body, .lp-story__stats, .lp-story__title-line, .lp-story-stat, .lp-map-grid, .lp-module-card, .lp-portfolio-card",
        { clearProps: "all" },
      );
    };
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        gsap.set(
          ".lp-story__eyebrow, .lp-story__flagbar, .lp-story__body, .lp-story__stats, .lp-story__title-line, .lp-story-stat, .lp-map-grid, .lp-module-card, .lp-portfolio-card",
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
          ".lp-story__eyebrow, .lp-story__flagbar, .lp-story__body, .lp-story__stats, .lp-story__title-line, .lp-story-stat, .lp-map-grid, .lp-module-card, .lp-portfolio-card",
          { autoAlpha: 1, y: 0, rotateX: 0, scale: 1 },
        );
        return;
      }

      gsap.fromTo(
        ".lp-story__eyebrow, .lp-story__flagbar, .lp-story__body, .lp-story__stats",
        { autoAlpha: 0, y: 18 },
        { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.04, ease: "power3.out",
          onComplete() { gsap.set(this.targets(), { clearProps: "opacity,visibility" }); } },
      );

      gsap.fromTo(
        ".lp-story__title-line",
        { autoAlpha: 0, y: 52, rotateX: -60, transformOrigin: "left bottom" },
        { autoAlpha: 1, y: 0, rotateX: 0, duration: 0.82, stagger: 0.07, ease: "back.out(1.45)",
          onComplete() { gsap.set(this.targets(), { clearProps: "opacity,visibility,transform" }); } },
      );

      gsap.fromTo(
        ".lp-story-stat",
        { autoAlpha: 0, y: 20 },
        { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.07, ease: "power3.out",
          onComplete() { gsap.set(this.targets(), { clearProps: "opacity,visibility" }); } },
      );

      gsap.fromTo(
        ".lp-map-grid",
        { autoAlpha: 0, y: 28, scale: 0.985 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.8, ease: "power3.out", delay: 0.1,
          onComplete() { gsap.set(this.targets(), { clearProps: "opacity,visibility,transform" }); } },
      );

      gsap.fromTo(
        ".lp-module-card",
        { autoAlpha: 0, x: 24 },
        {
          autoAlpha: 1,
          x: 0,
          duration: 0.62,
          stagger: 0.09,
          ease: "power3.out",
          delay: 0.18,
          onComplete() { gsap.set(this.targets(), { clearProps: "opacity,visibility,transform" }); },
        },
      );

      gsap.fromTo(
        ".lp-portfolio-card",
        { autoAlpha: 0, y: 28 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.74,
          ease: "power3.out",
          onComplete() { gsap.set(this.targets(), { clearProps: "opacity,visibility" }); },
          scrollTrigger: { trigger: ".lp-portfolio", start: "top 82%" },
        },
      );

      gsap.to(".lp-story__glow--yellow", {
        yPercent: -16, xPercent: 6, ease: "none",
        scrollTrigger: { trigger: ".lp-story", start: "top bottom", end: "bottom top", scrub: true },
      });
      gsap.to(".lp-story__glow--blue", {
        yPercent: 10, xPercent: -5, ease: "none",
        scrollTrigger: { trigger: ".lp-story", start: "top bottom", end: "bottom top", scrub: true },
      });
      gsap.to(".lp-story__glow--red", {
        yPercent: -8, xPercent: 4, ease: "none",
        scrollTrigger: { trigger: ".lp-story", start: "top bottom", end: "bottom top", scrub: true },
      });

      // ── Andes hills — full-width parallax ──────────────
      gsap.to(".lp-story__hills-wrap", {
        yPercent: 28,
        ease: "none",
        scrollTrigger: {
          trigger: ".lp-story",
          start: "top top",
          end: "55% top",
          scrub: true,
        },
      });

      // ── Title scroll animation ──────────────────────────
      // Title lines drift upward at different rates → layered depth
      gsap.to(".lp-story__title", {
        yPercent: -18,
        ease: "none",
        scrollTrigger: {
          trigger: ".lp-story__intro",
          start: "top top",
          end: "bottom top",
          scrub: 1.2,
        },
      });
      // Supporting elements drift at half the speed
      gsap.to(".lp-story__eyebrow, .lp-story__live, .lp-story__flagbar", {
        yPercent: -8,
        ease: "none",
        scrollTrigger: {
          trigger: ".lp-story__intro",
          start: "top top",
          end: "bottom top",
          scrub: 1.2,
        },
      });
    },
    { scope, dependencies: [lang, overview.meta.sourceRows, overview.slice.redAlerts] },
  );

  const totalContracts = overview.meta.sourceRows || overview.meta.totalRows || overview.slice.totalContracts;
  const latestDate = overview.meta.sourceLatestContractDate ?? overview.meta.latestContractDate ?? "—";
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
        <section className="lp-story">
          {/* Andes hills — full-width behind the entire hero section */}
          <div className="lp-story__hills-wrap" aria-hidden="true">
            <GLSLHills />
          </div>

          <div className="lp-story__backdrop" aria-hidden="true">
            <span className="lp-story__glow lp-story__glow--yellow" />
            <span className="lp-story__glow lp-story__glow--blue" />
            <span className="lp-story__glow lp-story__glow--red" />
          </div>

          <div className="lp-story__inner">

            {/* ── HERO INTRO ─────────────────────────────────── */}
            <header className="lp-story__intro">
              <p className="eyebrow lp-story__eyebrow">
                {lang === "es"
                  ? "VeedurIA · inteligencia cívica para Colombia"
                  : "VeedurIA · civic intelligence for Colombia"}
              </p>

              <div className="lp-story__flagbar" aria-hidden="true">
                <span className="is-yellow" />
                <span className="is-blue" />
                <span className="is-red" />
              </div>

              <div className="lp-story__live" aria-label={lang === "es" ? "Datos en vivo" : "Live data"}>
                <span className="lp-story__live-dot" aria-hidden="true" />
                {lang === "es" ? "Datos públicos en tiempo real" : "Live public data"}
              </div>

              <h1 className="lp-story__title">
                <span className="lp-story__title-line">
                  {lang === "es" ? "El poder público," : "Public power,"}
                </span>
                <span className="lp-story__title-line">
                  <span className="lp-story__title-accent lp-story__title-accent--tricolor">
                    {lang === "es" ? "visible" : "visible"}
                  </span>
                  {lang === "es" ? " y auditable" : " and auditable"}
                </span>
              </h1>

              <p className="lp-story__body">
                {lang === "es"
                  ? "Contratos con señales de riesgo, votos cruzados con programas legislativos y redes de financiación — todo trazado desde la fuente oficial. Sin intermediarios."
                  : "Contracts with risk signals, votes crossed with legislative programmes, and financing networks — all traced from the official source. No intermediaries."}
              </p>

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
                  <p>{currentDepartmentData ? `${Math.round(currentDepartmentData.avgRisk * 100)}/100 intensidad` : "—"}</p>
                </article>
              </div>
            </header>

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

                {/* Static info box — updates on hover/click, no floating tooltip */}
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
