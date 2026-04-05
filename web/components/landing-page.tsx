"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, ChevronDown, FileSearch, Radar, Waypoints } from "lucide-react";

import { ColombiaMap } from "@/components/colombia-map";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { fetchGeoJson, fetchOverview } from "@/lib/api";
import type { Lang, OverviewPayload } from "@/lib/types";

gsap.registerPlugin(ScrollTrigger);

type FeatureTone = "yellow" | "blue" | "red";

const HERO_LINES = {
  es: ["Detecta la señal", "antes de que", "se pierda"],
  en: ["Detect the signal", "before it fades"],
} as const;

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
        ".lp-hero-line",
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

      const counters = gsap.utils.toArray<HTMLElement>(".lp-counter");
      counters.forEach((node) => {
        const finalValue = Number(node.dataset.value ?? 0);
        const counter = { value: 0 };
        gsap.to(counter, {
          value: finalValue,
          duration: 2.5,
          ease: "power2.out",
          scrollTrigger: {
            trigger: node,
            start: "top 85%",
            once: true,
          },
          onUpdate: () => {
            node.textContent = Math.round(counter.value).toLocaleString(lang === "es" ? "es-CO" : "en-US");
          },
        });
      });

      gsap.to(".lp-scroll-hint", {
        y: 8,
        repeat: -1,
        yoyo: true,
        duration: 1.2,
        ease: "sine.inOut",
      });
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
              {HERO_LINES[lang].map((line, index) => (
                <span key={line} className={`lp-hero-line ${index === HERO_LINES[lang].length - 1 ? "lp-hero-line--accent" : ""}`}>
                  {line}
                </span>
              ))}
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
              <span>{lang === "es" ? "Registros oficiales hoy" : "Official records today"}</span>
              <strong className="lp-counter" data-value={totalContracts}>0</strong>
              <p>{lang === "es" ? `fuente visible al ${latestDate}` : `source visible through ${latestDate}`}</p>
            </article>
            <article className="lp-kpi-card lp-kpi-card--blue">
              <span>{lang === "es" ? "Alertas listas" : "Alerts ready"}</span>
              <strong className="lp-counter" data-value={overview.slice.redAlerts}>0</strong>
              <p>{lang === "es" ? "casos priorizados para abrir primero" : "cases prioritized for first review"}</p>
            </article>
            <article className="lp-kpi-card lp-kpi-card--red">
              <span>{lang === "es" ? "Territorio más encendido" : "Most active territory"}</span>
              <strong>{currentDepartmentData?.label ?? "Colombia"}</strong>
              <p>{currentDepartmentData ? `${Math.round(currentDepartmentData.avgRisk * 100)}/100` : "—"}</p>
            </article>
          </div>

          <div className="lp-hero-signal">
            <div className="lp-hero-signal__header">
              <span>{lang === "es" ? "Empieza por aquí" : "Start here"}</span>
              <strong>{lang === "es" ? "Tres entradas claras, una sola lectura" : "Three clear entries, one clean read"}</strong>
            </div>

            <div className="lp-hero-signal__map surface-soft">
              {geojson ? (
                <ColombiaMap
                  geojson={geojson}
                  departments={overview.map.departments}
                  activeDepartment={activeDepartment}
                  onSelect={(department) => setActiveDepartment(department)}
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

              <div className="lp-hero-signal__chips">
                <p className="lp-hero-signal__note">
                  {lang === "es"
                    ? "Haz clic en el mapa para cambiar el foco territorial."
                    : "Click the map to switch the territorial focus."}
                </p>
              </div>
            </div>
          </div>

          <div className="lp-entry-grid">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Link key={feature.title} href={feature.href} className={`lp-entry-card lp-entry-card--${feature.tone}`}>
                  <span className="lp-entry-card__kicker">{feature.kicker}</span>
                  <div className="lp-entry-card__row">
                    <strong>{feature.title}</strong>
                    <Icon size={18} />
                  </div>
                  <p>{feature.body}</p>
                  <span className="lp-entry-card__cta">
                    {feature.cta}
                    <ArrowRight size={16} />
                  </span>
                </Link>
              );
            })}
          </div>

          <a href="#modulos" className="lp-scroll-hint" aria-label={lang === "es" ? "Explorar módulos" : "Explore modules"}>
            <span>{lang === "es" ? "Explorar más" : "Explore more"}</span>
            <ChevronDown size={18} />
          </a>
        </section>

        <section className="lp-tool-grid" id="modulos">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Link key={feature.title} href={feature.href} className="lp-tool-card">
                <div className="lp-tool-card__head">
                  <div className="lp-tool-card__index">{String(index + 1).padStart(2, "0")}</div>
                  <div>
                    <p className="lp-tool-card__eyebrow">{feature.kicker}</p>
                    <h2>{feature.title}</h2>
                  </div>
                </div>
                <p className="lp-tool-card__description">{feature.body}</p>
                <div className="lp-tool-card__detailband">
                  <span>
                    {feature.title === "ContratoLimpio"
                      ? lang === "es"
                        ? "Territorio, filtros, dashboard y expediente oficial"
                        : "Territory, filters, dashboard, and official record"
                      : feature.title === "VotóMeter"
                        ? lang === "es"
                          ? "Votaciones nominales, gacetas y coherencia por tema"
                          : "Nominal votes, gazettes, and topic coherence"
                        : lang === "es"
                          ? "Vista previa del frente relacional"
                          : "Preview of the relationship layer"}
                  </span>
                </div>
                <div className="lp-tool-card__cta">
                  <Icon size={16} />
                  <span>{feature.cta}</span>
                  <ArrowRight size={16} />
                </div>
              </Link>
            );
          })}
        </section>
      </main>

      <SiteFooter lang={lang} />
    </div>
  );
}
