"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, FileSearch, Radar, Waypoints } from "lucide-react";

import { ColombiaMap } from "@/components/colombia-map";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { fetchGeoJson, fetchOverview } from "@/lib/api";
import type { Lang, OverviewPayload } from "@/lib/types";

gsap.registerPlugin(ScrollTrigger);

type FeatureTone = "yellow" | "blue" | "red";

const FEATURE_TEXT = {
  es: {
    contract: {
      title: "ContratoLimpio",
      kicker: "EXPLORAR CONTRATOS",
      body: "Filtra por entidad, departamento, fechas y modalidad. El mapa reorganiza la lectura y el caso principal te lleva al expediente oficial.",
      cta: "Abrir ContratoLimpio",
      href: "/contrato-limpio?lang=es",
      icon: FileSearch,
      tone: "yellow" as FeatureTone,
    },
    promises: {
      title: "VotóMeter",
      kicker: "VER VOTACIONES",
      body: "Cruza votaciones nominales del Congreso con el perfil programático de cada legislador. Baja a la tabla, abre la gaceta y revisa coherencia real por tema.",
      cta: "Abrir VotóMeter",
      href: "/votometro?lang=es",
      icon: Radar,
      tone: "blue" as FeatureTone,
    },
    money: {
      title: "SigueElDinero",
      kicker: "MAPA RELACIONAL",
      body: "La siguiente capa conectará contratistas, financiadores y señales repetidas. Ya puedes ver el frente abierto y lo que viene.",
      cta: "Ver avance del módulo",
      href: "/sigue-el-dinero?lang=es",
      icon: Waypoints,
      tone: "red" as FeatureTone,
    },
  },
  en: {
    contract: {
      title: "ContratoLimpio",
      kicker: "EXPLORE CONTRACTS",
      body: "Filter by entity, department, dates, and modality. The map reorganizes the readout and the lead case takes you back to the official record.",
      cta: "Open ContratoLimpio",
      href: "/contrato-limpio?lang=en",
      icon: FileSearch,
      tone: "yellow" as FeatureTone,
    },
    promises: {
      title: "VotóMeter",
      kicker: "VIEW VOTES",
      body: "Cross nominal congressional votes with each legislator's programmatic profile. Drop into the table, open the gazette, and review topic-by-topic coherence.",
      cta: "Open VotóMeter",
      href: "/votometro?lang=en",
      icon: Radar,
      tone: "blue" as FeatureTone,
    },
    money: {
      title: "SigueElDinero",
      kicker: "RELATIONSHIP MAP",
      body: "The next layer will connect contractors, funders, and repeated signals. You can already see the open workfront and what comes next.",
      cta: "View module progress",
      href: "/sigue-el-dinero?lang=en",
      icon: Waypoints,
      tone: "red" as FeatureTone,
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
    return () => {
      alive = false;
    };
  }, [lang]);

  useEffect(() => {
    let alive = true;
    fetchGeoJson()
      .then((data) => {
        if (alive) setGeojson(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useGSAP(
    () => {
      const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduceMotion) return;

      gsap.fromTo(
        ".lp-story__eyebrow, .lp-story__flagbar, .lp-story__body, .lp-story__actions, .lp-story__stats",
        { autoAlpha: 0, y: 18 },
        { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.05, ease: "power3.out" },
      );

      gsap.fromTo(
        ".lp-story__title-line",
        { autoAlpha: 0, y: 68, rotateX: -70, transformOrigin: "left bottom" },
        { autoAlpha: 1, y: 0, rotateX: 0, duration: 0.96, stagger: 0.08, ease: "back.out(1.45)" },
      );

      gsap.fromTo(
        ".lp-story-stat",
        { autoAlpha: 0, y: 20 },
        { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08, ease: "power3.out" },
      );

      gsap.fromTo(
        ".lp-story-map",
        { autoAlpha: 0, y: 34, scale: 0.985 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.9, ease: "power3.out", delay: 0.12 },
      );

      gsap.fromTo(
        ".lp-module-link",
        { autoAlpha: 0, y: 28 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.78,
          stagger: 0.1,
          ease: "power3.out",
          delay: 0.2,
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
          scrollTrigger: {
            trigger: ".lp-portfolio",
            start: "top 82%",
          },
        },
      );

      gsap.to(".lp-story__glow--yellow", {
        yPercent: -16,
        xPercent: 6,
        ease: "none",
        scrollTrigger: {
          trigger: ".lp-story",
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });

      gsap.to(".lp-story__glow--blue", {
        yPercent: 10,
        xPercent: -5,
        ease: "none",
        scrollTrigger: {
          trigger: ".lp-story",
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });

      gsap.to(".lp-story__glow--red", {
        yPercent: -8,
        xPercent: 4,
        ease: "none",
        scrollTrigger: {
          trigger: ".lp-story",
          start: "top bottom",
          end: "bottom top",
          scrub: true,
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
    overview.map.departments.find((item) => item.geoName === focusedDepartment) ?? currentDepartmentData;
  const featureSet = FEATURE_TEXT[lang];
  const features = [featureSet.contract, featureSet.promises, featureSet.money];
  const contratoHref = `/contrato-limpio?lang=${lang}`;

  const focusTone =
    (focusedDepartmentData?.avgRisk ?? 0) >= 0.7
      ? "high"
      : (focusedDepartmentData?.avgRisk ?? 0) >= 0.4
        ? "mid"
        : "low";

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
          <div className="lp-story__backdrop" aria-hidden="true">
            <span className="lp-story__glow lp-story__glow--yellow" />
            <span className="lp-story__glow lp-story__glow--blue" />
            <span className="lp-story__glow lp-story__glow--red" />
            <span className="lp-story__gridline lp-story__gridline--left" />
            <span className="lp-story__gridline lp-story__gridline--right" />
          </div>

          <div className="lp-story__inner">
            <header className="lp-story__intro">
              <p className="eyebrow lp-story__eyebrow">
                {lang === "es"
                  ? "VeedurIA · contratos, promesas y redes públicas"
                  : "VeedurIA · contracts, promises, and public networks"}
              </p>

              <div className="lp-story__flagbar" aria-hidden="true">
                <span className="is-yellow" />
                <span className="is-blue" />
                <span className="is-red" />
              </div>

              <h1 className="lp-story__title">
                <span className="lp-story__title-line">
                  {lang === "es" ? "Detecta" : "Detect"}
                </span>
                <span className="lp-story__title-line">
                  <span className="lp-story__title-accent lp-story__title-accent--tricolor">
                    {lang === "es" ? "la señal" : "the signal"}
                  </span>
                </span>
                <span className="lp-story__title-line">{lang === "es" ? "antes de que" : "before it"}</span>
                <span className="lp-story__title-line">
                  <span className="lp-story__title-accent lp-story__title-accent--primary">
                    {lang === "es" ? "se pierda" : "fades"}
                  </span>
                </span>
              </h1>

              <p className="lp-story__body">
                {lang === "es" ? "Empieza por " : "Start with "}
                <Link href={`/contrato-limpio?lang=${lang}`} className="lp-inline-link">
                  ContratoLimpio
                </Link>
                {lang === "es" ? " para abrir contratación, sigue con " : " to open procurement, move to "}
                <Link href={`/votometro?lang=${lang}`} className="lp-inline-link">
                  VotóMeter
                </Link>
                {lang === "es" ? " para contrastar votos y programas, y entra a " : " to contrast votes and programmes, and enter "}
                <Link href={`/sigue-el-dinero?lang=${lang}`} className="lp-inline-link">
                  SigueElDinero
                </Link>
                {lang === "es"
                  ? " para seguir la capa relacional. Cada módulo te deja llegar rápido a la fuente que importa."
                  : " to follow the relationship layer. Each module gets you quickly into the source that matters."}
              </p>

              <div className="lp-story__actions">
                {features.map((feature) => (
                  <Link key={feature.title} href={feature.href} className={`lp-story__chip lp-story__chip--${feature.tone}`}>
                    <span>{feature.title}</span>
                    <ArrowRight size={14} />
                  </Link>
                ))}
              </div>

              <div className="lp-story__stats">
                <article className="lp-story-stat lp-story-stat--yellow">
                  <span title={lang === "es" ? "Cantidad de registros visibles desde la fuente oficial" : "Visible records coming from the official source"}>
                    {lang === "es" ? "Registros oficiales hoy" : "Official records today"}
                  </span>
                  {totalContracts ? (
                    <strong>{totalContracts.toLocaleString(lang === "es" ? "es-CO" : "en-US")}</strong>
                  ) : (
                    <div className="lp-stat-skeleton" aria-hidden="true" />
                  )}
                  <p>{lang === "es" ? `fuente visible al ${latestDate}` : `source visible through ${latestDate}`}</p>
                </article>
                <article className="lp-story-stat lp-story-stat--blue">
                  <span title={lang === "es" ? "Casos priorizados para abrir primero" : "Cases prioritized for first review"}>
                    {lang === "es" ? "Alertas listas" : "Alerts ready"}
                  </span>
                  {overview.slice.redAlerts ? (
                    <strong>{overview.slice.redAlerts.toLocaleString(lang === "es" ? "es-CO" : "en-US")}</strong>
                  ) : (
                    <div className="lp-stat-skeleton" aria-hidden="true" />
                  )}
                  <p>{lang === "es" ? "casos priorizados para abrir primero" : "cases prioritized for first review"}</p>
                </article>
                <article className="lp-story-stat lp-story-stat--red">
                  <span title={lang === "es" ? "Departamento con mayor intensidad visible" : "Department with the strongest visible intensity"}>
                    {lang === "es" ? "Territorio más encendido" : "Most active territory"}
                  </span>
                  <strong>{currentDepartmentData?.label ?? "Colombia"}</strong>
                  <p>{currentDepartmentData ? `${Math.round(currentDepartmentData.avgRisk * 100)}/100` : "—"}</p>
                </article>
              </div>

            </header>

            <section className="lp-story-map">
              <div className="lp-story-map__head">
                <div>
                  <p className="eyebrow">{lang === "es" ? "Mapa de riesgo" : "Risk map"}</p>
                  <h2>{lang === "es" ? "Pulso territorial del corte" : "Territorial pulse of the slice"}</h2>
                </div>
                <p className="lp-story-map__description">
                  {lang === "es"
                    ? "Este bloque es una entrada directa a ContratoLimpio. Resume el territorio y te lleva al módulo completo sin depender de hover."
                    : "This block is a direct entry into ContratoLimpio. It summarizes the territory and opens the full module without relying on hover."}
                </p>
              </div>

              <Link
                href={contratoHref}
                className="lp-story-map__frame lp-story-map__frame--link"
                aria-label={lang === "es" ? "Abrir ContratoLimpio" : "Open ContratoLimpio"}
              >
                <div className="lp-story-map__launch-copy surface-soft">
                  <span className="lp-story-map__launch-kicker">{lang === "es" ? "Entrada rápida" : "Quick entry"}</span>
                  <strong>{lang === "es" ? "Ir directo a ContratoLimpio" : "Go straight to ContratoLimpio"}</strong>
                  <p>
                    {lang === "es"
                      ? "Mapa nacional, filtros, alertas y tabla priorizada en una sola vista."
                      : "National map, filters, alerts, and a prioritized table in one view."}
                  </p>
                  <span className="lp-story-map__launch-cta">
                    {lang === "es" ? "Abrir módulo" : "Open module"}
                    <ArrowRight size={15} />
                  </span>
                </div>
                {geojson ? (
                  <ColombiaMap
                    geojson={geojson}
                    departments={overview.map.departments}
                    activeDepartment={activeDepartment}
                    onHoverChange={setHoveredDepartment}
                    mode="hero"
                    showCaption={false}
                    showTooltip={false}
                    className="lp-story-map__visual"
                  />
                ) : (
                  <div className="cv-map-placeholder">
                    <span className="cv-spinner" aria-hidden="true" />
                    <span className="label">{lang === "es" ? "Cargando territorio" : "Loading territory"}</span>
                  </div>
                )}
              </Link>

              <div className="lp-story-map__footer">
                <div className={`lp-story-map__status lp-story-map__status--${focusTone}`}>
                  <span>{hoveredDepartment ? (lang === "es" ? "En foco" : "In focus") : lang === "es" ? "Departamento activo" : "Active department"}</span>
                  <strong>{focusedDepartmentData?.label ?? "Colombia"}</strong>
                  <p>
                    {(focusedDepartmentData?.contractCount ?? 0).toLocaleString(lang === "es" ? "es-CO" : "en-US")}{" "}
                    {lang === "es" ? "contratos visibles" : "visible contracts"} ·{" "}
                    {Math.round((focusedDepartmentData?.avgRisk ?? 0) * 100)}/100
                  </p>
                </div>

                <div className="lp-story-map__aside">
                  <div className="lp-map-legend" aria-label={lang === "es" ? "Leyenda del mapa" : "Map legend"}>
                    <span className="lp-map-legend__item">
                      <i className="is-high" />
                      {lang === "es" ? "Alto riesgo" : "High risk"}
                    </span>
                    <span className="lp-map-legend__item">
                      <i className="is-mid" />
                      {lang === "es" ? "Riesgo medio" : "Medium risk"}
                    </span>
                    <span className="lp-map-legend__item">
                      <i className="is-low" />
                      {lang === "es" ? "Riesgo bajo" : "Low risk"}
                    </span>
                  </div>
                  <p className="lp-story-map__hint">
                    {lang === "es"
                      ? "Toca el recuadro para abrir ContratoLimpio."
                      : "Tap the card to open ContratoLimpio."}
                  </p>
                </div>
              </div>
            </section>

            <p className="lp-story__legend lp-kpi-legend">
                {lang === "es"
                  ? "Fuente oficial, alertas listas y territorio más encendido en una sola lectura."
                  : "Official source, ready alerts, and the most active territory in one readout."}
              </p>

            <div className="lp-module-list">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Link key={feature.title} href={feature.href} className={`lp-module-link lp-module-link--${feature.tone}`}>
                  <div className="lp-module-link__identity">
                    <div className="lp-module-link__top">
                      <span className={`lp-module-link__icon lp-module-link__icon--${feature.tone}`}>
                        <Icon size={18} />
                      </span>
                      <span className="lp-module-link__kicker">{feature.kicker}</span>
                    </div>
                    <strong>{feature.title}</strong>
                  </div>
                  <div className="lp-module-link__body">
                    <p>{feature.body}</p>
                  </div>
                  <div className="lp-module-link__cta">
                    <span className={`lp-module-link__signal lp-module-link__signal--${feature.tone}`}>
                      {feature.tone === "yellow"
                        ? lang === "es"
                          ? "Expediente, mapa y corte"
                          : "Record, map, and slice"
                        : feature.tone === "blue"
                          ? lang === "es"
                            ? "Voto, tema y gaceta"
                            : "Vote, topic, and gazette"
                          : lang === "es"
                            ? "Red, rastro y avance"
                            : "Graph, trail, and progress"}
                    </span>
                    <span className="lp-module-link__arrow">
                      {feature.cta}
                      <ArrowRight size={16} />
                    </span>
                  </div>
                </Link>
              );
            })}
            </div>
          </div>
        </section>

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
              <ArrowRight size={16} />
            </a>
          </div>
        </section>
      </main>

      <SiteFooter lang={lang} />
    </div>
  );
}
