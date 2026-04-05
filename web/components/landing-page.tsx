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
        ".lp-hero-word",
        { autoAlpha: 0, y: 100, rotateX: -90, transformOrigin: "center bottom" },
        { autoAlpha: 1, y: 0, rotateX: 0, duration: 1, stagger: 0.08, ease: "back.out(1.7)" },
      );

      gsap.fromTo(
        ".lp-hero-intro > *, .lp-kpi-card, .lp-entry-card, .lp-tool-card",
        { autoAlpha: 0, y: 28 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.82,
          stagger: 0.08,
          ease: "power3.out",
        },
      );
    },
    { scope, dependencies: [lang, overview.meta.sourceRows, overview.slice.redAlerts] },
  );

  const totalContracts = overview.meta.sourceRows || overview.meta.totalRows || overview.slice.totalContracts;
  const latestDate = overview.meta.sourceLatestContractDate ?? overview.meta.latestContractDate ?? "—";
  const currentDepartmentData =
    overview.map.departments.find((item) => item.geoName === activeDepartment) ?? overview.map.departments[0];
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
        <section className="lp-hero-shell lp-hero-shell--cinematic surface stripe-flag">
          <div className="lp-hero-intro">
            <p className="eyebrow">
              {lang === "es"
                ? "VeedurIA · contratos, promesas y redes públicas"
                : "VeedurIA · contracts, promises, and public networks"}
            </p>

            <h1 className="lp-hero-title lp-hero-title--centered">
              <span className="lp-hero-word">Detecta</span>{" "}
              <span className="lp-hero-word lp-hero-word--accent">
                {lang === "es" ? "la señal" : "the signal"}
              </span>{" "}
              <span className="lp-hero-word">
                {lang === "es" ? "antes de que" : "before it"}
              </span>{" "}
              <span className="lp-hero-word lp-hero-word--nowrap">
                {lang === "es" ? "se pierda" : "fades"}
              </span>
            </h1>

            <p className="lp-hero-body">
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
          <p className="lp-kpi-legend">
            {lang === "es"
              ? "Los colores del panel distinguen fuente oficial, alertas priorizadas y territorio con mayor intensidad visible."
              : "Panel colors distinguish official source, prioritized alerts, and the territory with the strongest visible intensity."}
          </p>

          <div className="lp-hero-signal">
            <div className="lp-hero-signal__meta">
              <div>
                <p className="eyebrow">{lang === "es" ? "Mapa de riesgo" : "Risk map"}</p>
                <h2>{lang === "es" ? "Riesgo de contratación por departamento" : "Procurement risk by department"}</h2>
              </div>
              <p>
                {lang === "es"
                  ? "Intensidad de alertas en contratación pública. Haz clic en un departamento para abrir su corte en ContratoLimpio."
                  : "Alert intensity across public procurement. Click a department to open its slice in ContratoLimpio."}
              </p>
            </div>
            <div className="lp-hero-signal__map">
              {geojson ? (
                <ColombiaMap
                  geojson={geojson}
                  departments={overview.map.departments}
                  activeDepartment={activeDepartment}
                  onSelect={(department) => {
                    setActiveDepartment(department);
                    router.push(`/contrato-limpio?lang=${lang}&dept=${encodeURIComponent(department)}`);
                  }}
                  mode="hero"
                  showCaption={false}
                  tooltipData={mapTooltipData}
                />
              ) : (
                <div className="cv-map-placeholder">
                  <span className="cv-spinner" aria-hidden="true" />
                  <span className="label">{lang === "es" ? "Cargando territorio" : "Loading territory"}</span>
                </div>
              )}
            </div>
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
                {lang === "es" ? "Explora el corte completo en ContratoLimpio →" : "Explore the full slice in ContratoLimpio →"}
              </Link>
            </p>
          </div>

          <div className="lp-entry-grid">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Link key={feature.title} href={feature.href} className={`lp-entry-card lp-entry-card--${feature.tone}`}>
                  <div className="lp-entry-card__content">
                    <span className="lp-entry-card__kicker">{feature.kicker}</span>
                    <div className="lp-entry-card__row">
                      <strong>{feature.title}</strong>
                      <Icon size={18} />
                    </div>
                    <p>{feature.body}</p>
                  </div>
                  <span className="lp-entry-card__cta">
                    {feature.cta}
                    <ArrowRight size={16} />
                  </span>
                </Link>
              );
            })}
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
