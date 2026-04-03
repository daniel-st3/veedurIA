"use client";

import { useMemo, useRef, useState } from "react";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";

import { ColombiaMap } from "@/components/colombia-map";

type SignalCard = {
  label: string;
  title: string;
  body: string;
};

type Props = {
  status: string;
  title: string;
  body: string;
  legend: [string, string, string];
  graphLabel: string;
  notes: [SignalCard, SignalCard, SignalCard];
  geojson: any | null;
};

const HERO_DEPARTMENTS = [
  { key: "SANTAFE DE BOGOTA D.C", label: "Bogotá D.C.", geoName: "SANTAFE DE BOGOTA D.C", avgRisk: 0.78, contractCount: 18432 },
  { key: "ANTIOQUIA", label: "Antioquia", geoName: "ANTIOQUIA", avgRisk: 0.68, contractCount: 16218 },
  { key: "VALLE DEL CAUCA", label: "Valle del Cauca", geoName: "VALLE DEL CAUCA", avgRisk: 0.6, contractCount: 13742 },
  { key: "ATLANTICO", label: "Atlántico", geoName: "ATLANTICO", avgRisk: 0.55, contractCount: 8420 },
] as const;

const METER_VALUES = [0.3, 0.48, 0.72, 0.58, 0.9, 0.66, 0.42];

export function HeroField({ status, title, body, legend, graphLabel, notes, geojson }: Props) {
  const scope = useRef<HTMLDivElement | null>(null);
  const [activeDepartment, setActiveDepartment] = useState<string>(HERO_DEPARTMENTS[0].geoName);

  useGSAP(
    (_context, contextSafe) => {
      const root = scope.current;
      if (!root) return;
      const safe = contextSafe ?? ((fn: any) => fn);
      const panel = root.querySelector<HTMLElement>("[data-stage]");
      const glow = root.querySelector<HTMLElement>("[data-glow]");
      const pointer = root.querySelector<HTMLElement>("[data-pointer]");
      const chips = Array.from(root.querySelectorAll<HTMLElement>("[data-chip]"));
      const meters = Array.from(root.querySelectorAll<HTMLElement>("[data-meter]"));

      gsap.fromTo(
        root,
        { autoAlpha: 0, y: 22, scale: 0.986 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.92, ease: "power3.out", delay: 0.14 },
      );

      gsap.fromTo(
        chips,
        { autoAlpha: 0, y: 26 },
        { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08, ease: "power3.out", delay: 0.18 },
      );

      gsap.fromTo(
        meters,
        { scaleY: 0.16, autoAlpha: 0.25 },
        { scaleY: 1, autoAlpha: 1, duration: 0.8, stagger: 0.05, ease: "power3.out", transformOrigin: "center bottom", delay: 0.3 },
      );

      const handleMove = safe((clientX: number, clientY: number) => {
        const rect = root.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const nx = x / rect.width - 0.5;
        const ny = y / rect.height - 0.5;

        gsap.to(pointer, { autoAlpha: 1, x, y, duration: 0.22, ease: "power3.out", overwrite: true });
        gsap.to(glow, { x: nx * 56, y: ny * 38, duration: 0.38, ease: "power3.out", overwrite: true });
        gsap.to(panel, {
          x: nx * 12,
          y: ny * 14,
          rotateY: nx * 5,
          rotateX: ny * -5,
          duration: 0.46,
          ease: "power3.out",
          overwrite: true,
        });
      });

      const reset = safe(() => {
        gsap.to(pointer, { autoAlpha: 0, duration: 0.22, overwrite: true });
        gsap.to(glow, { x: 0, y: 0, duration: 0.42, ease: "power3.out", overwrite: true });
        gsap.to(panel, { x: 0, y: 0, rotateY: 0, rotateX: 0, duration: 0.5, ease: "power3.out", overwrite: true });
      });

      const onPointerMove = (event: PointerEvent) => handleMove(event.clientX, event.clientY);
      const onTouchMove = (event: TouchEvent) => {
        if (!event.touches[0]) return;
        handleMove(event.touches[0].clientX, event.touches[0].clientY);
      };

      root.addEventListener("pointermove", onPointerMove);
      root.addEventListener("pointerleave", reset);
      root.addEventListener("touchmove", onTouchMove, { passive: true });
      root.addEventListener("touchend", reset, { passive: true });

      return () => {
        root.removeEventListener("pointermove", onPointerMove);
        root.removeEventListener("pointerleave", reset);
        root.removeEventListener("touchmove", onTouchMove);
        root.removeEventListener("touchend", reset);
      };
    },
    { scope },
  );

  const currentDepartment = useMemo(
    () => HERO_DEPARTMENTS.find((item) => item.geoName === activeDepartment) ?? HERO_DEPARTMENTS[0],
    [activeDepartment],
  );

  return (
    <div ref={scope} className="surface hero-field hero-field--map stripe-flag">
      <div className="hero-field__topline">
        <span className="hero-field__status label">{status}</span>
        <span className="hero-field__graph label">{graphLabel}</span>
      </div>

      <div className="hero-field__ambient" data-glow />
      <div className="hero-field__pointer" data-pointer />

      <div className="hero-field__layout">
        <div className="hero-field__map-stage" data-stage>
          {geojson ? (
            <ColombiaMap
              geojson={geojson}
              departments={[...HERO_DEPARTMENTS]}
              activeDepartment={activeDepartment}
              onSelect={setActiveDepartment}
              mode="hero"
              showCaption={false}
            />
          ) : (
            <div className="hero-map-skeleton">
              <div className="hero-map-skeleton__blob" />
              <div className="hero-map-skeleton__outline" />
            </div>
          )}
          <div className="hero-field__map-badge surface-soft">
            <span className="label">{notes[0].label}</span>
            <strong>{currentDepartment.label}</strong>
          </div>
        </div>

        <div className="hero-field__sidebar">
          <div className="hero-field__panel surface-soft" data-chip>
            <div className="label" style={{ marginBottom: "0.45rem" }}>
              {notes[1].label}
            </div>
            <h3>{notes[1].title}</h3>
            <p className="body-copy">{notes[1].body}</p>
          </div>

          <div className="hero-field__story surface" data-chip>
            <div className="label" style={{ marginBottom: "0.45rem" }}>
              {notes[2].label}
            </div>
            <h3>{currentDepartment.label}</h3>
            <p className="body-copy" style={{ marginBottom: "0.8rem" }}>
              {body}
            </p>
            <div className="hero-field__story-meta">
              <span className="tiny-pill">{`${Math.round(currentDepartment.avgRisk * 100)} ${legend[2]}`}</span>
              <span className="tiny-pill">{`${currentDepartment.contractCount.toLocaleString()} ${graphLabel}`}</span>
            </div>
          </div>

          <div className="hero-field__signal surface-soft" data-chip>
            <div className="label" style={{ marginBottom: "0.55rem" }}>
              {title}
            </div>
            <div className="hero-field__bars">
              {METER_VALUES.map((value, index) => (
                <span key={`${value}-${index}`} className="hero-field__bar-wrap">
                  <span
                    data-meter
                    className={`hero-field__bar hero-field__bar--${index % 3 === 0 ? "yellow" : index % 3 === 1 ? "blue" : "red"}`}
                    style={{ height: `${Math.round(value * 100)}%` }}
                  />
                </span>
              ))}
            </div>
            <div className="hero-field__signal-meta">
              <span className="tiny-pill">{legend[0]}</span>
              <span className="tiny-pill">{legend[1]}</span>
              <span className="tiny-pill">{legend[2]}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="hero-field__legend-shell" data-chip>
        <div className="hero-field__legend-head">
          <div className="label">{status}</div>
          <div className="body-copy" style={{ fontSize: "0.8rem" }}>{body}</div>
        </div>
        <div className="hero-field__legend">
          <span className="label hero-field__legend-item">
            <span className="status-dot" style={{ background: "var(--yellow)" }} /> {legend[0]}
          </span>
          <span className="label hero-field__legend-item">
            <span className="status-dot" style={{ background: "var(--blue)" }} /> {legend[1]}
          </span>
          <span className="label hero-field__legend-item">
            <span className="status-dot" style={{ background: "var(--red)" }} /> {legend[2]}
          </span>
        </div>
      </div>
    </div>
  );
}
