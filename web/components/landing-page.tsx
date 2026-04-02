"use client";

import Link from "next/link";
import { useRef } from "react";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { HeroField } from "@/components/hero-field";
import { SiteNav } from "@/components/site-nav";
import { landingCopy } from "@/lib/copy";
import type { Lang } from "@/lib/types";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export function LandingPage({ lang }: { lang: Lang }) {
  const copy = landingCopy[lang];
  const scope = useRef<HTMLDivElement | null>(null);

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

        ScrollTrigger.batch(".stat-graph__bar", {
          start: "top 90%",
          once: true,
          onEnter: (batch) => {
            gsap.fromTo(batch, { scaleY: 0.18 }, { scaleY: 1, duration: 0.72, stagger: 0.04, ease: "power3.out", transformOrigin: "center bottom" });
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
        <section className="hero-grid hero-stage" style={{ padding: "2.4rem 0 1.8rem", alignItems: "center" }}>
          <div>
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
            <div className="hero-meta" style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", margin: "1.15rem 0 0.95rem" }}>
              <span className="chip hero-chip hero-chip--blue" style={{ padding: "0.65rem 0.9rem" }}>
                <strong>IF</strong>&nbsp;{copy.heroPointA}
              </span>
              <span className="chip hero-chip hero-chip--yellow" style={{ padding: "0.65rem 0.9rem" }}>
                <strong>SHAP</strong>&nbsp;{copy.heroPointB}
              </span>
              <span className="chip hero-chip hero-chip--red" style={{ padding: "0.65rem 0.9rem" }}>
                <strong>SECOP</strong>&nbsp;{copy.heroPointC}
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
            <div className="scroll-cue" style={{ marginTop: "1rem" }}>
              {copy.heroPlay}
            </div>
          </div>
          <HeroField
            status={copy.heroPlay}
            title={copy.heroPlay}
            body={copy.heroPlayBody}
            legend={[copy.heroLegendFocus, copy.heroLegendModel, copy.heroLegendAlert]}
            graphLabel={copy.heroGraphLabel}
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

        <section className="stat-grid" style={{ marginBottom: "1.4rem" }}>
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
              <div className="stat-graph">
                {Array.from({ length: 5 }).map((_, barIndex) => (
                  <span
                    key={`${label}-${barIndex}`}
                    className={`stat-graph__bar stat-graph__bar--${index === 0 ? "blue" : index === 1 ? "yellow" : index === 2 ? "red" : "green"}`}
                    style={{ height: `${28 + ((barIndex + 1) * (index + 2) * 5) % 56}px` }}
                  />
                ))}
              </div>
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
      </main>

      <footer className="footer">{copy.footer}</footer>
    </div>
  );
}
