"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { HeroField } from "@/components/hero-field";
import { SiteNav } from "@/components/site-nav";
import { fetchOverview } from "@/lib/api";
import { landingCopy } from "@/lib/copy";
import type { Lang, OverviewPayload } from "@/lib/types";

gsap.registerPlugin(ScrollTrigger, useGSAP);

function renderStatVisual(index: number, copy: (typeof landingCopy)[Lang]) {
  if (index === 0) {
    return (
      <div className="metric-visual">
        <div className="label metric-visual__title">{copy.statVisualCoverage}</div>
        <div className="metric-rail">
          <span className="metric-rail__track" />
          <span className="metric-rail__fill metric-rail__fill--blue" data-meter style={{ width: "88%" }} />
        </div>
        <div className="metric-points">
          <span>2023</span>
          <span>2024</span>
          <span>2025</span>
        </div>
      </div>
    );
  }

  if (index === 1) {
    return (
      <div className="metric-visual">
        <div className="label metric-visual__title">{copy.statVisualSignals}</div>
        <div className="metric-tags">
          {["Monto", "Plazo", "Proveedor", "Oferentes", "Tiempo"].map((item, tagIndex) => (
            <span key={item} className={`metric-tag metric-tag--${tagIndex % 2 === 0 ? "yellow" : "blue"}`}>
              {item}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (index === 2) {
    return (
      <div className="metric-visual">
        <div className="label metric-visual__title">{copy.statVisualThreshold}</div>
        <div className="threshold-scale">
          <span className="threshold-scale__band threshold-scale__band--low">0–39</span>
          <span className="threshold-scale__band threshold-scale__band--mid">40–69</span>
          <span className="threshold-scale__band threshold-scale__band--high">70–100</span>
        </div>
      </div>
    );
  }

  return (
    <div className="metric-visual">
      <div className="label metric-visual__title">{copy.statVisualRoadmap}</div>
      <div className="road-steps">
        <span className="road-steps__dot road-steps__dot--active" />
        <span className="road-steps__line" />
        <span className="road-steps__dot road-steps__dot--mid" />
        <span className="road-steps__line" />
        <span className="road-steps__dot road-steps__dot--end" />
      </div>
    </div>
  );
}

export function LandingPage({
  lang,
  initialMeta,
  initialGeojson,
}: {
  lang: Lang;
  initialMeta?: OverviewPayload["meta"] | null;
  initialGeojson?: any | null;
}) {
  const copy = landingCopy[lang];
  const scope = useRef<HTMLDivElement | null>(null);
  const [freshness, setFreshness] = useState<OverviewPayload["meta"] | null>(initialMeta ?? null);
  const freshnessLabel = lang === "es" ? "Último corte visible" : "Latest visible contract";
  const pipelineLabel = lang === "es" ? "Pipeline" : "Pipeline";
  const loadingLabel = lang === "es" ? "cargando" : "loading";

  useEffect(() => {
    let alive = true;
    fetchOverview({ lang, full: false })
      .then((data) => {
        if (alive) setFreshness(data.meta);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [lang]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });

        heroTl
          .fromTo(".hero-pill, .hero-line > span", { autoAlpha: 0, y: 36 }, { autoAlpha: 1, y: 0, stagger: 0.07, duration: 0.72 })
          .fromTo(".hero-body, .hero-chip, .hero-cta, .scroll-cue", { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, stagger: 0.08, duration: 0.6 }, "-=0.36");

        gsap.to(".hero-field", {
          yPercent: 6,
          scrollTrigger: {
            trigger: ".hero-stage",
            start: "top top",
            end: "bottom top",
            scrub: 1.1,
          },
        });

        gsap.fromTo(
          ".hero-track__line",
          { scaleX: 0.2, autoAlpha: 0.1 },
          {
            scaleX: 1,
            autoAlpha: 1,
            duration: 1.2,
            stagger: 0.08,
            ease: "power2.out",
            transformOrigin: "left center",
            delay: 0.25,
          },
        );

        gsap.utils.toArray<HTMLElement>(".section-head").forEach((header) => {
          gsap.fromTo(
            header.children,
            { autoAlpha: 0, y: 32 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.76,
              stagger: 0.1,
              ease: "power3.out",
              scrollTrigger: {
                trigger: header,
                start: "top 88%",
                once: true,
              },
            },
          );
        });

        ScrollTrigger.batch(".stat-card", {
          start: "top 88%",
          once: true,
          onEnter: (batch) => {
            gsap.fromTo(
              batch,
              { autoAlpha: 0, y: 46, scale: 0.96, rotateX: 10 },
              { autoAlpha: 1, y: 0, scale: 1, rotateX: 0, duration: 0.75, stagger: 0.08, ease: "power3.out" },
            );
          },
        });

        ScrollTrigger.batch("[data-meter]", {
          start: "top 90%",
          once: true,
          onEnter: (batch) => {
            gsap.fromTo(
              batch,
              { scaleX: 0.24, autoAlpha: 0.45 },
              { scaleX: 1, autoAlpha: 1, duration: 0.72, stagger: 0.06, ease: "power3.out", transformOrigin: "left center" },
            );
          },
        });

        ScrollTrigger.batch(".mini-card, .flow-card, .phase-card", {
          start: "top 90%",
          once: true,
          onEnter: (batch) => {
            gsap.fromTo(
              batch,
              { autoAlpha: 0, y: 52, scale: 0.97 },
              { autoAlpha: 1, y: 0, scale: 1, duration: 0.78, stagger: 0.09, ease: "power3.out" },
            );
          },
        });

        gsap.fromTo(
          ".cta-surface",
          { autoAlpha: 0, y: 40, scale: 0.97 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: {
              trigger: ".cta-surface",
              start: "top 88%",
              once: true,
            },
          },
        );
      });

      return () => mm.revert();
    },
    { scope },
  );

  return (
    <div ref={scope} className="shell">
      <SiteNav
        lang={lang}
        links={[
          { href: `/?lang=${lang}#modelo`, label: copy.navModel },
          { href: `/?lang=${lang}#flujo`, label: copy.navFlow },
          { href: `/?lang=${lang}#plataforma`, label: copy.navPlatform },
        ]}
        ctaHref={`/contrato-limpio?lang=${lang}`}
        ctaLabel={copy.navPhase}
      />

      <main className="page">
        <section className="hero-grid hero-grid--landing hero-stage" style={{ padding: "1.2rem 0 1rem", alignItems: "center" }}>
          <div className="hero-copy">
            <div className="hero-pill eyebrow-pill">
              {copy.heroEyebrow}
            </div>
            <h1 className="hero-title">
              <span className="title-line hero-line">
                <span>{copy.heroTitleA}</span>
              </span>
              <span className="title-line hero-line">
                <span style={{ color: "var(--blue)" }}>{copy.heroTitleB}</span>
              </span>
              <span className="title-line hero-line">
                <span style={{ color: "var(--yellow)" }}>{copy.heroTitleC}</span>
              </span>
            </h1>
            <div className="hero-body">
              <p>{copy.heroBody}</p>
            </div>
            <div className="hero-meta" style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", margin: "1rem 0 0.85rem" }}>
              <span className="chip hero-chip hero-chip--blue" style={{ padding: "0.65rem 0.9rem" }}>
                <strong>IF</strong>&nbsp;{copy.heroPointA}
              </span>
              <span className="chip hero-chip hero-chip--yellow" style={{ padding: "0.65rem 0.9rem" }}>
                <strong>SHAP</strong>&nbsp;{copy.heroPointB}
              </span>
              <span className="chip hero-chip hero-chip--red" style={{ padding: "0.65rem 0.9rem" }}>
                <strong>SECOP</strong>&nbsp;{copy.heroPointC}
              </span>
              <span className="chip hero-chip" style={{ padding: "0.65rem 0.9rem", color: "var(--text-2)" }}>
                <strong>DATA</strong>&nbsp;{freshness?.latestContractDate ?? loadingLabel}
              </span>
            </div>
            <div className="hero-track">
              <div className="hero-track__line hero-track__line--yellow" />
              <div className="hero-track__line hero-track__line--blue" />
              <div className="hero-track__line hero-track__line--red" />
            </div>
            <div className="hero-cta" style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap" }}>
              <Link href={`/contrato-limpio?lang=${lang}`} className="btn-primary btn-primary--hero">
                {copy.heroPrimary}
              </Link>
              <a href="#modelo" className="btn-secondary btn-secondary--hero">
                {copy.heroSecondary}
              </a>
            </div>
            <div className="scroll-cue" style={{ marginTop: "0.8rem" }}>
              {copy.heroPlay}
            </div>
          </div>
          <HeroField
            status={copy.heroPlay}
            title={copy.heroPlay}
            body={copy.heroPlayBody}
            legend={[copy.heroLegendFocus, copy.heroLegendModel, copy.heroLegendAlert]}
            graphLabel={copy.heroGraphLabel}
            geojson={initialGeojson ?? null}
            notes={[
              {
                label: copy.heroCardSourceLabel,
                title: copy.heroCardSourceTitle,
                body: copy.heroCardSourceBody,
              },
              {
                label: copy.heroCardModelLabel,
                title: copy.heroCardModelTitle,
                body: copy.heroCardModelBody,
              },
              {
                label: copy.heroCardReviewLabel,
                title: copy.heroCardReviewTitle,
                body: copy.heroCardReviewBody,
              },
            ]}
          />
        </section>

        <section className="stat-grid" style={{ marginBottom: "1rem" }}>
          {copy.stats.map(([value, label, body], index) => (
            <article
              key={label}
              className={`stat-card reveal stripe-${index === 0 ? "blue" : index === 1 ? "yellow" : index === 2 ? "red" : "green"}`}
            >
              <div className="value" style={{ fontSize: "2.6rem", marginBottom: "0.3rem" }}>
                {value}
              </div>
              <div className="label" style={{ marginBottom: "0.45rem" }}>
                {label}
              </div>
              <div className="body-copy" style={{ fontSize: "0.84rem" }}>
                {body}
              </div>
              {renderStatVisual(index, copy)}
            </article>
          ))}
        </section>

        <section className="section" id="modelo" style={{ padding: "2rem 0 4rem" }}>
          <div className="two-col section-head" style={{ marginBottom: "1.6rem" }}>
            <div>
              <p className="eyebrow">{copy.modelEyebrow}</p>
              <h2 className="section-title">{copy.modelTitle}</h2>
            </div>
            <p className="section-copy">{copy.modelBody}</p>
          </div>
          <div className="mini-grid">
            {copy.modelCards.map(([mark, title, body], index) => (
              <article
                key={title}
                className={`mini-card stripe-${index === 0 ? "blue" : index === 1 ? "yellow" : index === 2 ? "blue" : "red"}`}
              >
                <div className="label" style={{ marginBottom: "0.55rem" }}>
                  {mark}
                </div>
                <h3 style={{ fontFamily: "Syne", margin: "0 0 0.4rem" }}>{title}</h3>
                <p className="body-copy" style={{ margin: 0, fontSize: "0.86rem" }}>
                  {body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="section" id="flujo" style={{ padding: "0 0 4rem" }}>
          <div className="two-col section-head" style={{ marginBottom: "1.6rem" }}>
            <div>
              <p className="eyebrow">{copy.flowEyebrow}</p>
              <h2 className="section-title">{copy.flowTitle}</h2>
            </div>
            <p className="section-copy">{copy.flowBody}</p>
          </div>
          <div className="phase-grid">
            {copy.flowCards.map(([mark, title, body], index) => (
              <article
                key={title}
                className={`phase-card flow-card stripe-${index === 0 ? "red" : index === 1 ? "blue" : "green"}`}
              >
                <div className="label" style={{ marginBottom: "0.55rem" }}>
                  {mark}
                </div>
                <h3 style={{ fontFamily: "Syne", margin: "0 0 0.4rem" }}>{title}</h3>
                <p className="body-copy" style={{ margin: 0, fontSize: "0.86rem" }}>
                  {body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="section" id="plataforma" style={{ padding: "0 0 4rem" }}>
          <div className="two-col section-head" style={{ marginBottom: "1.6rem" }}>
            <div>
              <p className="eyebrow">{copy.platformEyebrow}</p>
              <h2 className="section-title">{copy.platformTitle}</h2>
            </div>
            <p className="section-copy">{copy.platformBody}</p>
          </div>
          <div className="phase-grid">
            {copy.phases.map(([state, name, body], index) => (
              <article
                key={name}
                className={`phase-card reveal stripe-${index === 0 ? "blue" : index === 1 ? "yellow" : "red"}`}
              >
                <div className="label" style={{ marginBottom: "0.55rem" }}>
                  {state}
                </div>
                <h3 style={{ fontFamily: "Syne", margin: "0 0 0.4rem" }}>{name}</h3>
                <p className="body-copy" style={{ margin: 0, fontSize: "0.86rem" }}>
                  {body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <div className="surface stripe-flag cta-surface" style={{ padding: "2rem", display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
            <div>
              <h2 className="section-title" style={{ fontSize: "2.3rem", marginBottom: "0.5rem" }}>
                {copy.ctaTitle}
              </h2>
              <p className="section-copy" style={{ maxWidth: 720 }}>
                {copy.ctaBody}
              </p>
            </div>
            <Link href={`/contrato-limpio?lang=${lang}`} className="btn-primary">
              {copy.ctaButton}
            </Link>
          </div>
        </section>

        <section className="landing-foot">
          <div className="landing-foot__card surface-soft">
            <div>
              <div className="label" style={{ marginBottom: "0.45rem" }}>Autor</div>
              <strong>Daniel Steven Rodríguez Sandoval</strong>
            </div>
            <div>
              <div className="label" style={{ marginBottom: "0.45rem" }}>Repositorio</div>
              <a href="https://github.com/daniel-st3/veedurIA" target="_blank" rel="noreferrer" className="landing-foot__link">
                github.com/daniel-st3/veedurIA
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <span>{copy.footer}</span>
          <span>
            {freshnessLabel}: {freshness?.latestContractDate ?? loadingLabel} · {pipelineLabel}: {freshness?.lastRunTs?.slice(0, 10) ?? loadingLabel}
          </span>
        </div>
      </footer>
    </div>
  );
}
