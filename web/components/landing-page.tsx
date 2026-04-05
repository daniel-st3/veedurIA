"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [overview, setOverview] = useState<OverviewPayload>(initialOverview);
  const [geojson, setGeojson] = useState<any | null>(null);
  const [activeDepartment, setActiveDepartment] = useState(initialOverview.map.departments[0]?.geoName);
  const [hoveredDepartment, setHoveredDepartment] = useState<string | null>(null);
  const [showStickyCta, setShowStickyCta] = useState(false);

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

  useEffect(() => {
    const handleScroll = () => {
      setShowStickyCta(window.scrollY > window.innerHeight * 0.5);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useGSAP(
    () => {
      const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduceMotion) return;

      gsap.fromTo(
        ".lp-home-hero__eyebrow, .lp-home-hero__flagbar, .lp-home-hero__body, .lp-home-hero__links, .lp-home-hero__legend",
        { autoAlpha: 0, y: 18 },
        { autoAlpha: 1, y: 0, duration: 0.72, stagger: 0.06, ease: "power3.out" },
      );

      gsap.fromTo(
        ".lp-home-hero__title-line",
        { autoAlpha: 0, y: 82, rotateX: -78, transformOrigin: "left bottom" },
        { autoAlpha: 1, y: 0, rotateX: 0, duration: 1.04, stagger: 0.1, ease: "back.out(1.55)" },
      );

      gsap.fromTo(
        ".lp-kpi-card",
        { autoAlpha: 0, y: 30, scale: 0.96 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.8, stagger: 0.08, ease: "power3.out" },
      );

      gsap.fromTo(
        ".lp-home-map",
        { autoAlpha: 0, x: 42, scale: 0.97 },
        { autoAlpha: 1, x: 0, scale: 1, duration: 0.94, ease: "power3.out" },
      );

      gsap.fromTo(
        ".lp-entry-card",
        { autoAlpha: 0, y: 36 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.82,
          stagger: 0.12,
          ease: "power3.out",
          scrollTrigger: {
            trigger: ".lp-entry-grid",
            start: "top 78%",
          },
        },
      );

      gsap.fromTo(
        ".lp-portfolio-card",
        { autoAlpha: 0, y: 42 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: ".lp-portfolio",
            start: "top 82%",
          },
        },
      );

      gsap.to(".lp-hero-orbit__line--yellow", {
        yPercent: -18,
        xPercent: 6,
        ease: "none",
        scrollTrigger: {
          trigger: ".lp-home-hero",
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });

      gsap.to(".lp-hero-orbit__line--blue", {
        yPercent: 14,
        xPercent: -5,
        ease: "none",
        scrollTrigger: {
          trigger: ".lp-home-hero",
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });

      gsap.to(".lp-hero-orbit__line--red", {
        yPercent: -10,
        xPercent: 4,
        ease: "none",
        scrollTrigger: {
          trigger: ".lp-home-hero",
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

  const mapTooltipData = useMemo(() => {
    return Object.fromEntries(
      overview.map.departments.map((department) => [
        department.geoName,
        {
          label: department.label,
          contractCount: department.contractCount,
          intensity: Math.round(department.avgRisk * 100),
          alerts:
            lang === "es"
              ? [
                  "Contratación directa sobre el patrón del territorio",
                  "Concentración proveedor–entidad por encima de la media",
                  "Mayor presión de revisión en este corte",
                ]
              : [
                  "Direct awards above the territory pattern",
                  "Provider–entity concentration above the mean",
                  "Higher review pressure in this slice",
                ],
          clickHint: lang === "es" ? "Haz clic para entrar al corte" : "Click to open the slice",
        },
      ]),
    );
  }, [lang, overview.map.departments]);

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
        <section className="lp-home-hero lp-hero-shell lp-hero-shell--cinematic surface stripe-flag">
          <div className="lp-home-hero__backdrop" aria-hidden="true">
            <span className="lp-hero-orbit__line lp-hero-orbit__line--yellow" />
            <span className="lp-hero-orbit__line lp-hero-orbit__line--blue" />
            <span className="lp-hero-orbit__line lp-hero-orbit__line--red" />
            <span className="lp-home-hero__glow lp-home-hero__glow--yellow" />
            <span className="lp-home-hero__glow lp-home-hero__glow--blue" />
            <span className="lp-home-hero__glow lp-home-hero__glow--red" />
          </div>

          <div className="lp-home-hero__grid">
            <div className="lp-home-hero__copy">
              <p className="eyebrow lp-home-hero__eyebrow">
              {lang === "es"
                ? "VeedurIA · contratos, promesas y redes públicas"
                : "VeedurIA · contracts, promises, and public networks"}
              </p>

              <div className="lp-home-hero__flagbar" aria-hidden="true">
                <span className="is-yellow" />
                <span className="is-blue" />
                <span className="is-red" />
              </div>

              <h1 className="lp-home-hero__title lp-hero-title">
                <span className="lp-home-hero__title-line">
                  {lang === "es" ? "Detecta " : "Detect "}
                  <span className="lp-home-hero__accent lp-home-hero__accent--tricolor">
                    {lang === "es" ? "la señal" : "the signal"}
                  </span>
                </span>
                <span className="lp-home-hero__title-line">{lang === "es" ? "antes de que" : "before it"}</span>
                <span className="lp-home-hero__title-line">
                  <span className="lp-home-hero__accent lp-home-hero__accent--primary">
                    {lang === "es" ? "se pierda" : "fades"}
                  </span>
                </span>
              </h1>

              <p className="lp-home-hero__body lp-hero-body">
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

              <div className="lp-home-hero__links">
                {features.map((feature) => (
                  <Link key={feature.title} href={feature.href} className={`lp-home-hero__chip lp-home-hero__chip--${feature.tone}`}>
                    <span>{feature.title}</span>
                    <ArrowRight size={14} />
                  </Link>
                ))}
              </div>

              <div className="lp-kpi-row stats-grid">
                <article className="lp-kpi-card lp-kpi-card--yellow">
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
                <article className="lp-kpi-card lp-kpi-card--blue">
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
                <article className="lp-kpi-card lp-kpi-card--red">
                  <span title={lang === "es" ? "Departamento con mayor intensidad visible" : "Department with the strongest visible intensity"}>
                    {lang === "es" ? "Territorio más encendido" : "Most active territory"}
                  </span>
                  <strong>{currentDepartmentData?.label ?? "Colombia"}</strong>
                  <p>{currentDepartmentData ? `${Math.round(currentDepartmentData.avgRisk * 100)}/100` : "—"}</p>
                </article>
              </div>

              <p className="lp-home-hero__legend lp-kpi-legend">
                {lang === "es"
                  ? "Fuente oficial, alertas listas y territorio más encendido en una sola lectura."
                  : "Official source, ready alerts, and the most active territory in one readout."}
              </p>
            </div>

            <aside className="lp-home-map">
              <div className="lp-home-map__header">
                <div>
                  <p className="eyebrow">{lang === "es" ? "Mapa de riesgo" : "Risk map"}</p>
                  <h2>{lang === "es" ? "Pulso territorial del corte" : "Territorial pulse of the slice"}</h2>
                </div>
                <p>
                  {lang === "es"
                    ? "Haz clic en un departamento para abrir ContratoLimpio con ese corte."
                    : "Click a department to open ContratoLimpio with that slice."}
                </p>
              </div>

              <div className="lp-home-map__frame lp-hero-signal__map">
                {geojson ? (
                  <ColombiaMap
                    geojson={geojson}
                    departments={overview.map.departments}
                    activeDepartment={activeDepartment}
                    onHoverChange={setHoveredDepartment}
                    onSelect={(department) => {
                      setActiveDepartment(department);
                      router.push(`/contrato-limpio?lang=${lang}&dept=${encodeURIComponent(department)}`);
                    }}
                    mode="hero"
                    showCaption={false}
                    showTooltip={false}
                    tooltipData={mapTooltipData}
                    className="lp-home-map__visual"
                  />
                ) : (
                  <div className="cv-map-placeholder">
                    <span className="cv-spinner" aria-hidden="true" />
                    <span className="label">{lang === "es" ? "Cargando territorio" : "Loading territory"}</span>
                  </div>
                )}
              </div>

              <div className="lp-home-map__footer">
                <div className={`lp-home-map__focus lp-home-map__focus--${focusTone}`}>
                  <span>{lang === "es" ? "Departamento activo" : "Active department"}</span>
                  <strong>{focusedDepartmentData?.label ?? "Colombia"}</strong>
                  <p>
                    {(focusedDepartmentData?.contractCount ?? 0).toLocaleString(lang === "es" ? "es-CO" : "en-US")}{" "}
                    {lang === "es" ? "contratos visibles" : "visible contracts"} ·{" "}
                    {Math.round((focusedDepartmentData?.avgRisk ?? 0) * 100)}/100
                  </p>
                </div>

                <div className="lp-home-map__meta">
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

                  <p className="lp-map-hint">
                    <Link href={`/contrato-limpio?lang=${lang}`} className="lp-inline-link">
                      {lang === "es" ? "Entrar al mapa completo de ContratoLimpio →" : "Open the full ContratoLimpio map →"}
                    </Link>
                  </p>
                </div>
              </div>
            </aside>
          </div>

          <div className="lp-entry-grid lp-entry-grid--landing-premium">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Link key={feature.title} href={feature.href} className={`lp-entry-card lp-entry-card--${feature.tone}`}>
                  <span className="lp-entry-card__mesh" aria-hidden="true" />
                  <div className="lp-entry-card__content">
                    <div className="lp-entry-card__top">
                      <span className="lp-entry-card__kicker">{feature.kicker}</span>
                      <span className={`lp-entry-card__icon lp-entry-card__icon--${feature.tone}`}>
                        <Icon size={18} />
                      </span>
                    </div>
                    <div className="lp-entry-card__row">
                      <strong>{feature.title}</strong>
                    </div>
                    <p>{feature.body}</p>
                  </div>
                  <div className="lp-entry-card__foot">
                    <span className={`lp-entry-card__signal lp-entry-card__signal--${feature.tone}`}>
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
                    <span className="lp-entry-card__cta">
                      {feature.cta}
                      <ArrowRight size={16} />
                    </span>
                  </div>
                </Link>
              );
            })}
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

      <div className={`lp-sticky-cta ${showStickyCta ? "is-visible" : ""}`}>
        <Link href={`/contrato-limpio?lang=${lang}`} className="btn-primary">
          {lang === "es" ? "Explorar contratos →" : "Explore contracts →"}
        </Link>
      </div>

      <SiteFooter lang={lang} />
    </div>
  );
}
