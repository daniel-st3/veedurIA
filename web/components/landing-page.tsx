"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ArrowRight, FileSearch, Radar, Waypoints } from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { fetchOverview } from "@/lib/api";
import type { Lang, OverviewPayload } from "@/lib/types";

type FeatureTone = "yellow" | "blue" | "red";

const FEATURES = (lang: Lang, totalContracts: number, redAlerts: number) => [
  {
    index: "01",
    title: "ContratoLimpio",
    tone: "yellow" as FeatureTone,
    eyebrow: lang === "es" ? "Contratación pública" : "Public procurement",
    description:
      lang === "es"
        ? "Busca por entidad, territorio, fechas y modalidad; abre casos guía y vuelve directo al expediente en SECOP II."
        : "Search by entity, territory, date, and modality; open guide cases and jump back to the record in SECOP II.",
    detail:
      lang === "es"
        ? `${totalContracts.toLocaleString("es-CO")} contratos en el universo cargado`
        : `${totalContracts.toLocaleString("en-US")} contracts in the loaded universe`,
    href: `/contrato-limpio?lang=${lang}`,
    cta: lang === "es" ? "Abrir módulo" : "Open module",
    icon: FileSearch,
  },
  {
    index: "02",
    title: "Promesómetro",
    tone: "blue" as FeatureTone,
    eyebrow: lang === "es" ? "Promesas y evidencia" : "Promises and evidence",
    description:
      lang === "es"
        ? "Compara lo prometido, la fuente original y la acción pública observada en una sola lectura, con cortes por periodo político."
        : "Compare the original pledge, the source document, and the observed public action in one read, by political cycle.",
    detail:
      lang === "es" ? "Seguimiento ejecutivo, Senado, Cámara y radar presidencial" : "Executive, Senate, House, and presidential watch",
    href: `/promesmetro?lang=${lang}`,
    cta: lang === "es" ? "Ver seguimiento" : "View tracker",
    icon: Radar,
  },
  {
    index: "03",
    title: "SigueElDinero",
    tone: "red" as FeatureTone,
    eyebrow: lang === "es" ? "Relaciones y trazabilidad" : "Networks and traceability",
    description:
      lang === "es"
        ? "La siguiente capa unirá contratistas, donaciones y redes de poder para pasar del caso aislado al patrón persistente."
        : "The next layer connects contractors, donations, and power networks to move from isolated cases to persistent patterns.",
    detail:
      lang === "es"
        ? `${redAlerts.toLocaleString("es-CO")} alertas altas ya sirven de semilla`
        : `${redAlerts.toLocaleString("en-US")} high-signal alerts already seed the graph`,
    href: `/sigue-el-dinero?lang=${lang}`,
    cta: lang === "es" ? "Entrar al mapa relacional" : "Open relationship map",
    icon: Waypoints,
  },
];

const ENTRY_POINTS = (lang: Lang) => [
  {
    title: lang === "es" ? "Rastrea compras públicas" : "Trace public procurement",
    body:
      lang === "es"
        ? "Abre el corte, toca un departamento y entra directo al contrato que conviene revisar primero."
        : "Open the slice, tap a department, and jump straight into the contract worth reviewing first.",
    href: `/contrato-limpio?lang=${lang}`,
    tone: "yellow" as FeatureTone,
  },
  {
    title: lang === "es" ? "Contrasta promesas y hechos" : "Contrast promises and facts",
    body:
      lang === "es"
        ? "Escoge el periodo, el actor y el tema para ver qué prometió, qué sí aparece y qué sigue sin evidencia."
        : "Choose the cycle, actor, and theme to see what was promised, what already appears, and what still lacks evidence.",
    href: `/promesmetro?lang=${lang}`,
    tone: "blue" as FeatureTone,
  },
  {
    title: lang === "es" ? "Conecta redes de poder" : "Connect power networks",
    body:
      lang === "es"
        ? "Pasa del caso aislado a la relación entre contratistas, entidades, donaciones y señales repetidas."
        : "Move from the isolated case to the relationship between contractors, entities, donations, and repeated signals.",
    href: `/sigue-el-dinero?lang=${lang}`,
    tone: "red" as FeatureTone,
  },
];

const MARQUEE_ITEMS = (lang: Lang, totalContracts: number, latestDate: string, redAlerts: number) => [
  {
    label:
      lang === "es"
        ? `${totalContracts.toLocaleString("es-CO")} contratos visibles`
        : `${totalContracts.toLocaleString("en-US")} visible contracts`,
    href: `/contrato-limpio?lang=${lang}`,
  },
  {
    label: lang === "es" ? `fuente oficial al ${latestDate}` : `official source through ${latestDate}`,
    href: `/contrato-limpio?lang=${lang}`,
  },
  {
    label:
      lang === "es"
        ? `${redAlerts.toLocaleString("es-CO")} alertas listas para revisar`
        : `${redAlerts.toLocaleString("en-US")} alerts ready to review`,
    href: `/contrato-limpio?lang=${lang}`,
  },
  {
    label:
      lang === "es" ? "promesas con evidencia por periodo político" : "promises with evidence by political cycle",
    href: `/promesmetro?lang=${lang}`,
  },
  {
    label:
      lang === "es" ? "rutas directas a contratación, promesas y redes" : "direct routes to contracts, promises, and networks",
    href: `/sigue-el-dinero?lang=${lang}`,
  },
];

export function LandingPage({
  lang,
  initialOverview,
}: {
  lang: Lang;
  initialOverview: OverviewPayload;
}) {
  const [overview, setOverview] = useState<OverviewPayload>(initialOverview);
  const [scrollShift, setScrollShift] = useState(0);

  useEffect(() => {
    let alive = true;
    fetchOverview({ lang, full: false })
      .then((data) => {
        if (alive) setOverview(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [lang]);

  useEffect(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>("[data-reveal]")];
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -10% 0px" },
    );

    nodes.forEach((node, index) => {
      node.style.setProperty("--reveal-delay", `${index * 80}ms`);
      observer.observe(node);
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0;

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        setScrollShift(window.scrollY);
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const totalContracts = overview.meta.sourceRows || overview.meta.totalRows || overview.slice.totalContracts;
  const redAlerts = overview.slice.redAlerts;
  const latestDate = overview.meta.sourceLatestContractDate ?? overview.meta.latestContractDate ?? "—";
  const features = FEATURES(lang, totalContracts, redAlerts);
  const entryPoints = ENTRY_POINTS(lang);
  const marqueeItems = MARQUEE_ITEMS(lang, totalContracts, latestDate, redAlerts);

  return (
    <div className="shell">
      <SiteNav
        lang={lang}
        links={[
          { href: `/contrato-limpio?lang=${lang}`, label: "ContratoLimpio" },
          { href: `/promesmetro?lang=${lang}`, label: "Promesómetro" },
          { href: `/sigue-el-dinero?lang=${lang}`, label: "SigueElDinero" },
        ]}
      />

      <main className="page lp-page">
        <section className="lp-hero-shell lp-hero-shell--open surface stripe-flag" data-reveal>
          <div className="lp-hero-orbit" aria-hidden="true">
            <span className="lp-hero-orbit__line lp-hero-orbit__line--yellow" style={{ transform: `translate3d(0, ${scrollShift * 0.03}px, 0)` }} />
            <span className="lp-hero-orbit__line lp-hero-orbit__line--blue" style={{ transform: `translate3d(0, ${scrollShift * 0.05}px, 0)` }} />
            <span className="lp-hero-orbit__line lp-hero-orbit__line--red" style={{ transform: `translate3d(0, ${scrollShift * 0.07}px, 0)` }} />
          </div>

          <div className="lp-hero-ghost" aria-hidden="true" style={{ transform: `translate3d(${scrollShift * 0.03}px, ${scrollShift * -0.04}px, 0)` }}>
            <span>{lang === "es" ? "CONTRATOS" : "CONTRACTS"}</span>
            <span>{lang === "es" ? "PROMESAS" : "PROMISES"}</span>
            <span>{lang === "es" ? "REDES" : "NETWORKS"}</span>
          </div>

          <div className="lp-hero-copy lp-hero-copy--single">
            <p className="eyebrow">
              {lang === "es"
                ? "VeedurIA · contratos, promesas y redes públicas en una sola entrada"
                : "VeedurIA · contracts, promises, and public networks in one entry point"}
            </p>

            <h1 className="lp-hero-title" style={{ transform: `translate3d(0, ${scrollShift * -0.06}px, 0)` }}>
              <span className="flag-yellow">{lang === "es" ? "Detecta" : "Detect"}</span>{" "}
              <span className="flag-blue">{lang === "es" ? "la señal" : "the signal"}</span>{" "}
              <span className="flag-red">{lang === "es" ? "antes de que se pierda" : "before it disappears"}</span>
            </h1>

            <p className="lp-hero-body">
              {lang === "es"
                ? "Entra por contratación, promesas o redes. Cada ruta arranca con un caso, una lectura corta y un clic directo a la fuente que importa."
                : "Start from procurement, promises, or networks. Each route begins with a useful case, a short read, and a direct click to the source that matters."}
            </p>

            <div className="lp-hero-tags">
              <span>{lang === "es" ? `${totalContracts.toLocaleString("es-CO")} registros visibles` : `${totalContracts.toLocaleString("en-US")} visible records`}</span>
              <span>{lang === "es" ? `fuente al ${latestDate}` : `source through ${latestDate}`}</span>
              <span>{lang === "es" ? `${redAlerts.toLocaleString("es-CO")} alertas altas` : `${redAlerts.toLocaleString("en-US")} high alerts`}</span>
            </div>

            <div className="lp-start-grid lp-start-grid--open">
              {entryPoints.map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  className={`lp-start-card lp-start-card--open lp-start-card--${item.tone}`}
                  style={{ transform: `translate3d(0, ${scrollShift * 0.01}px, 0)` }}
                >
                  <span className="lp-start-card__kicker">{lang === "es" ? "Empieza aquí" : "Start here"}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                  </div>
                  <ArrowRight size={18} />
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-marquee" data-reveal aria-label={lang === "es" ? "Accesos rápidos" : "Quick access"}>
          <div className="lp-marquee__track">
            {[...marqueeItems, ...marqueeItems].map((item, index) => (
              <Link key={`${item.href}-${index}`} href={item.href} className="lp-marquee__item">
                <span>{item.label}</span>
                <ArrowRight size={14} />
              </Link>
            ))}
          </div>
        </section>

        <section className="lp-modules" data-reveal>
          {features.map((feature) => {
            const Icon = feature.icon;

            const content = (
              <>
                <div className="lp-module__head">
                  <div className={`lp-module__index lp-module__index--${feature.tone}`}>{feature.index}</div>
                  <div>
                    <p className="lp-module__eyebrow">{feature.eyebrow}</p>
                    <h2>{feature.title}</h2>
                  </div>
                </div>

                <p className="lp-module__description">{feature.description}</p>

                <div className="lp-module__detailband">
                  <span>{feature.detail}</span>
                </div>

                <div className={`lp-module__cta lp-module__cta--${feature.tone}`}>
                  <Icon size={16} />
                  <span>{feature.cta}</span>
                  <ArrowRight size={16} />
                </div>
              </>
            );

            return (
              <Link key={feature.title} href={feature.href} className={`lp-module lp-module--${feature.tone}`}>
                {content}
              </Link>
            );
          })}
        </section>
      </main>
    </div>
  );
}
