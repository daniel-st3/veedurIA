"use client";

import { useRef } from "react";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";

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
};

const NODES = [
  { left: 18, top: 22, tone: "yellow" },
  { left: 33, top: 18, tone: "blue" },
  { left: 49, top: 28, tone: "blue" },
  { left: 65, top: 22, tone: "red" },
  { left: 77, top: 34, tone: "blue" },
  { left: 28, top: 52, tone: "blue" },
  { left: 48, top: 58, tone: "yellow" },
  { left: 67, top: 54, tone: "red" },
];

const LINKS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [1, 5],
  [2, 6],
  [3, 7],
  [5, 6],
  [6, 7],
];

const BARS = [0.3, 0.52, 0.78, 0.62, 0.94, 0.48];

export function HeroField({ status, title, body, legend, graphLabel, notes }: Props) {
  const scope = useRef<HTMLDivElement | null>(null);

  useGSAP(
    (_context, contextSafe) => {
      const root = scope.current;
      if (!root) return;
      const safe = contextSafe ?? ((fn: any) => fn);

      const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-node]"));
      const orbit = root.querySelector<HTMLElement>("[data-orbit]");
      const glow = root.querySelector<HTMLElement>("[data-glow]");
      const pointer = root.querySelector<HTMLElement>("[data-pointer]");
      const lines = Array.from(root.querySelectorAll<HTMLElement>("[data-link]"));
      const bars = Array.from(root.querySelectorAll<HTMLElement>("[data-bar]"));
      const chips = Array.from(root.querySelectorAll<HTMLElement>("[data-chip]"));

      gsap.fromTo(
        root,
        { autoAlpha: 0, y: 22, scale: 0.986 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.9, ease: "power3.out", delay: 0.16 },
      );

      gsap.fromTo(
        bars,
        { scaleY: 0.18, autoAlpha: 0.2 },
        { scaleY: 1, autoAlpha: 1, duration: 0.7, stagger: 0.05, ease: "power3.out", transformOrigin: "center bottom", delay: 0.22 },
      );

      gsap.fromTo(
        lines,
        { scaleX: 0.3, autoAlpha: 0 },
        { scaleX: 1, autoAlpha: 0.44, duration: 0.95, stagger: 0.03, ease: "power2.out", transformOrigin: "left center" },
      );

      gsap.to(nodes, {
        x: "random(-10,10)",
        y: "random(-12,12)",
        duration: "random(2.8,4.8)",
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        stagger: 0.06,
      });

      gsap.to(chips, {
        y: "random(-6,6)",
        duration: "random(3.2,4.6)",
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        stagger: 0.12,
      });

      gsap.to(orbit, {
        rotate: 360,
        duration: 18,
        repeat: -1,
        ease: "none",
      });

      const handleMove = safe((clientX: number, clientY: number) => {
        const rect = root.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const nx = x / rect.width - 0.5;
        const ny = y / rect.height - 0.5;

        gsap.to(pointer, {
          autoAlpha: 1,
          x,
          y,
          duration: 0.22,
          ease: "power3.out",
          overwrite: true,
        });

        gsap.to(glow, {
          x: nx * 46,
          y: ny * 34,
          duration: 0.32,
          ease: "power3.out",
          overwrite: true,
        });

        gsap.to(orbit, {
          x: nx * 22,
          y: ny * 18,
          rotateY: nx * 10,
          rotateX: ny * -10,
          duration: 0.45,
          ease: "power3.out",
          overwrite: true,
        });

        nodes.forEach((node, index) => {
          gsap.to(node, {
            x: nx * ((index % 3) - 1) * 18,
            y: ny * ((index % 2) ? 16 : -16),
            scale: 1 + Math.abs(nx) * 0.35,
            duration: 0.34,
            ease: "power3.out",
            overwrite: true,
          });
        });
      });

      const reset = safe(() => {
        gsap.to(pointer, { autoAlpha: 0, duration: 0.22, overwrite: true });
        gsap.to(glow, { x: 0, y: 0, duration: 0.45, ease: "power3.out", overwrite: true });
        gsap.to(orbit, { x: 0, y: 0, rotateY: 0, rotateX: 0, duration: 0.55, ease: "power3.out", overwrite: true });
        gsap.to(nodes, { x: 0, y: 0, scale: 1, duration: 0.45, ease: "power3.out", overwrite: true });
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

  return (
    <div ref={scope} className="surface hero-field hero-field--editorial stripe-flag">
      <div className="hero-field__topline">
        <span className="hero-field__status label">{status}</span>
        <span className="hero-field__graph label">{graphLabel}</span>
      </div>

      <div className="hero-field__ambient" data-glow />

      <div className="hero-field__stage" data-orbit>
        <div className="hero-field__ring hero-field__ring--outer" />
        <div className="hero-field__ring hero-field__ring--mid" />
        <div className="hero-field__ring hero-field__ring--inner" />
        <div className="hero-field__core">
          <span className="hero-field__core-dot" />
          <span className="hero-field__core-dot hero-field__core-dot--blue" />
          <span className="hero-field__core-dot hero-field__core-dot--red" />
        </div>
      </div>

      <div className="hero-field__network">
        {LINKS.map(([from, to], index) => {
          const a = NODES[from];
          const b = NODES[to];
          const dx = b.left - a.left;
          const dy = b.top - a.top;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          return (
            <div
              key={`${from}-${to}-${index}`}
              data-link
              className="hero-field__link"
              style={{
                left: `${a.left}%`,
                top: `${a.top}%`,
                width: `${length}%`,
                transform: `rotate(${angle}deg)`,
              }}
            />
          );
        })}

        {NODES.map((node, index) => (
          <span
            key={`${node.left}-${node.top}-${index}`}
            data-node
            className={`hero-field__node hero-field__node--${node.tone}`}
            style={{ left: `${node.left}%`, top: `${node.top}%` }}
          />
        ))}
      </div>

      <div className="hero-field__panel surface-soft" data-chip>
        <div className="label" style={{ marginBottom: "0.45rem" }}>
          {notes[1].label}
        </div>
        <h3>{notes[1].title}</h3>
        <p className="body-copy">{notes[1].body}</p>
      </div>

      <div className="hero-field__signal surface-soft" data-chip>
        <div className="label" style={{ marginBottom: "0.55rem" }}>
          {notes[0].label}
        </div>
        <div className="hero-field__bars">
          {BARS.map((value, index) => (
            <span key={`${value}-${index}`} className="hero-field__bar-wrap">
              <span
                data-bar
                className={`hero-field__bar hero-field__bar--${index % 3 === 0 ? "yellow" : index % 3 === 1 ? "blue" : "red"}`}
                style={{ height: `${Math.round(value * 100)}%` }}
              />
            </span>
          ))}
        </div>
      </div>

      <div className="hero-field__story surface" data-chip>
        <div className="label" style={{ marginBottom: "0.5rem" }}>
          {notes[2].label}
        </div>
        <h3>{title}</h3>
        <p className="body-copy" style={{ marginBottom: "0.9rem" }}>
          {body}
        </p>
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

      <div data-pointer className="hero-field__pointer" />
    </div>
  );
}
